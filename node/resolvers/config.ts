import { schemas } from '../mdSchema'
import templates from '../templates'
import { toHash } from '../utils'
import { describeClientError } from '../utils/clientError'
import { getHttpStatus } from '../utils/httpError'

export interface Settings {
  schemaHash: string | null
  templateHash: string | null
}

const defaultSettings: Settings = {
  schemaHash: null,
  templateHash: null,
}

export const getAppId = (): string => {
  const app = process.env.VTEX_APP_ID
  const [appName] = String(app).split('@')

  return appName
}

export const getAppMajorVersion = (): string => {
  const appId = process.env.VTEX_APP_ID
  const [, version] = String(appId).split('@')

  if (!version) {
    return '0'
  }

  const [major] = version.split('.')

  return major ?? '0'
}

const getSchemaSettingsKey = (): string => {
  return `settings-v${getAppMajorVersion()}`
}

/**
 * Thrown by `checkConfig(ctx, { throwOnIncomplete: true })` when the sync did
 * not finish (settings unreadable, a schema or template failed, or the hash
 * could not be saved). The cause is already logged with its own key; the
 * throw only exists so `ensureConfigForQuery` does not cache "synced" for the
 * TTL and the next Query retries.
 */
export class CheckConfigIncompleteError extends Error {
  public readonly alreadyLogged = true

  constructor() {
    super('checkConfig.incomplete')
    this.name = 'CheckConfigIncompleteError'
  }
}

interface CheckConfigOptions {
  throwOnIncomplete?: boolean
}

const checkConfig = async (
  ctx: Context,
  { throwOnIncomplete = false }: CheckConfigOptions = {}
) => {
  const {
    vtex: { logger },
    clients: { mail, masterdata, vbase },
  } = ctx

  const settingsKey = getSchemaSettingsKey()
  let incomplete = false

  let storedSettings: Settings | null

  try {
    storedSettings = await vbase.getJSON<Settings>(
      'mdSchema',
      settingsKey,
      true
    )
  } catch (error) {
    if (getHttpStatus(error) !== 404) {
      // Not a first run: we cannot tell what is already synced, so do not
      // update schemas or overwrite the stored hashes blindly (same rule as
      // the 404-only guard of B2BTEAM-3969). The caller goes on.
      logger.error({
        entity: 'Settings',
        error: describeClientError(error),
        message: 'checkConfig.readSettingsError',
        operation: 'checkConfig',
        settingsKey,
      })

      if (throwOnIncomplete) {
        throw new CheckConfigIncompleteError()
      }

      return { ...defaultSettings }
    }

    storedSettings = null
  }

  let schemaChanged = false
  let templatesChanged = false

  // Copy: the hashes are assigned below and must never leak into the shared
  // default object.
  const settings: Settings =
    !storedSettings?.schemaHash || !storedSettings?.templateHash
      ? { ...defaultSettings }
      : { ...storedSettings }

  const currSchemaHash = toHash(schemas)
  const currTemplateHash = toHash(templates)

  if (!settings.schemaHash || settings.schemaHash !== currSchemaHash) {
    logger.info({
      message: 'checkConfig-updatingSchema',
    })

    const results = await Promise.all(
      schemas.map((schema) =>
        masterdata
          .createOrUpdateSchema({
            dataEntity: schema.name,
            schemaBody: schema.body,
            schemaName: schema.version,
          })
          .then(() => true)
          .catch((error: any) => {
            // 304: schema already up to date, that is a success.
            if (getHttpStatus(error) === 304) {
              return true
            }

            logger.error({
              dataEntity: schema.name,
              entity: 'Settings',
              error: describeClientError(error),
              message: 'checkConfig.schemaUpdateError',
              operation: 'checkConfig',
            })

            return false
          })
      )
    )

    if (results.every((res) => res === true)) {
      settings.schemaHash = currSchemaHash
      schemaChanged = true
    } else {
      incomplete = true
    }
  }

  if (!settings.templateHash || settings.templateHash !== currTemplateHash) {
    logger.info({
      message: 'checkConfig-updatingTemplates',
    })

    // A template failure must not fail the mutation that called checkConfig:
    // warn, do not save the hash, and try again on the next call.
    const results = await Promise.all(
      templates.map(async (template) => {
        try {
          const existingData = await mail
            .getTemplate(template.Name)
            .catch((error: any) => {
              // Template not there yet: publish it.
              if (getHttpStatus(error) === 404) {
                return null
              }

              throw error
            })

          if (!existingData) {
            await mail.publishTemplate(template)
          }

          return true
        } catch (error) {
          logger.warn({
            entity: 'Settings',
            error: describeClientError(error),
            message: 'checkConfig.templateError',
            operation: 'checkConfig',
            template: template.Name,
          })

          return false
        }
      })
    )

    if (results.every((res) => res === true)) {
      settings.templateHash = currTemplateHash
      templatesChanged = true
    } else {
      incomplete = true
    }
  }

  if (schemaChanged || templatesChanged) {
    try {
      await vbase.saveJSON('mdSchema', settingsKey, settings)
    } catch (error) {
      incomplete = true
      logger.error({
        entity: 'Settings',
        error: describeClientError(error),
        message: 'checkConfig.saveSettingsError',
        operation: 'checkConfig',
        settingsKey,
      })
    }
  }

  if (incomplete && throwOnIncomplete) {
    throw new CheckConfigIncompleteError()
  }

  return settings
}

export default checkConfig
