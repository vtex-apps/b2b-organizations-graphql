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
  const app = process.env.VTEX_APP_ID
  const [appName] = String(app).split('@')

  return appName
}

const checkConfig = async (ctx: Context) => {
  const {
    vtex: { logger },
    clients: { mail, vbase },
  } = ctx

  let settings: Settings = await vbase.getJSON('mdSchema', 'settings', true)

  let templatesChanged = false

  if (!settings?.templateHash) {
    settings = defaultSettings
  }

  const currTemplateHash = toHash(templates)

  if (!settings?.templateHash || settings.templateHash !== currTemplateHash) {
    const updates: any = []

    logger.info({
      message: 'checkConfig-updatingTemplates',
    })

    try {
      await Promise.all(
        templates.map(async (template) => {
          const existingData = await mail.getTemplate(template.Name)

          if (!existingData) {
            updates.push(mail.publishTemplate(template))
          }

          return null
        })
      )
    } catch (error) {
      logger.error({
        error,
        message: 'checkConfig-updatingTemplatesError',
      })
    }

    await Promise.all(updates)
      .then(() => {
        settings.templateHash = currTemplateHash
        templatesChanged = true
      })
      .catch((error) => {
        logger.error({
          error,
          message: 'checkConfig-publishTemplateError',
        })
        throw new Error(error)
      })
  }

  if (templatesChanged) {
    try {
      await vbase.saveJSON('mdSchema', 'settings', settings)
    } catch (error) {
      logger.error({
        error,
        message: 'checkConfig-saveSettingsError',
      })
    }
  }

  return settings
}

export default checkConfig
