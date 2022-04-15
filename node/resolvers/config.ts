import { schemas } from '../mdSchema'
import templates from '../templates'
import { toHash } from '../utils'

export interface Settings {
  schemaHash: string | null
  templateHash: string | null
}

const defaultSettings = {
  schemaHash: null,
  templateHash: null,
}

export const getAppId = (): string => {
  return process.env.VTEX_APP_ID ?? ''
}

const checkConfig = async (ctx: Context) => {
  const {
    vtex: { logger },
    clients: { mail, masterdata, vbase },
  } = ctx

  let settings: Settings = await vbase.getJSON('mdSchema', 'settings', true)

  let schemaChanged = false
  let templatesChanged = false

  if (!settings?.schemaHash || !settings?.templateHash) {
    settings = defaultSettings
  }

  const currSchemaHash = toHash(schemas)
  const currTemplateHash = toHash(templates)

  if (!settings?.schemaHash || settings.schemaHash !== currSchemaHash) {
    const updates: any = []

    logger.info({
      message: 'checkConfig-updatingSchema',
    })

    schemas.forEach(schema => {
      updates.push(
        masterdata
          .createOrUpdateSchema({
            dataEntity: schema.name,
            schemaName: schema.version,
            schemaBody: schema.body,
          })
          .then(() => true)
          .catch((e: any) => {
            if (e.response.status !== 304) {
              logger.error({
                message: 'checkConfig-createOrUpdateSchemaError',
                error: e,
              })

              return false
            }

            return true
          })
      )
    })

    await Promise.all(updates).then(results => {
      if (results.every(res => res === true)) {
        settings.schemaHash = currSchemaHash
        schemaChanged = true
      }
    })
  }

  if (!settings?.templateHash || settings.templateHash !== currTemplateHash) {
    const updates: any = []

    logger.info({
      message: 'checkConfig-updatingTemplates',
    })

    await Promise.all(
      templates.map(async template => {
        const existingData = await mail.getTemplate(template.Name)

        if (!existingData) {
          updates.push(mail.publishTemplate(template))
        }

        return null
      })
    )

    await Promise.all(updates)
      .then(() => {
        settings.templateHash = currTemplateHash
        templatesChanged = true
      })
      .catch(e => {
        logger.error({
          message: 'checkConfig-publishTemplateError',
          error: e,
        })
        throw new Error(e)
      })
  }

  if (schemaChanged || templatesChanged) {
    await vbase.saveJSON('mdSchema', 'settings', settings)
  }

  return settings
}

export default checkConfig
