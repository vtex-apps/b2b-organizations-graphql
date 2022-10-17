import { getAppId } from '../config'

const Settings = {
  saveAppSettings: async (_: any, __: any, ctx: Context) => {
    const {
      clients: { vbase },
      vtex: { logger },
    } = ctx

    const app: string = getAppId()

    const newSettings = {}

    try {
      await vbase.saveJSON('b2borg', app, newSettings)

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        error,
        message: 'saveAppSettings-error',
      })

      return { status: 'error', message: error }
    }
  },
  saveSalesChannels: async (
    _: void,
    { channels }: { channels: any[] },
    ctx: Context
  ) => {
    const {
      clients: { vbase },
      vtex: { logger },
    } = ctx

    try {
      await vbase.saveJSON('b2borg', 'salesChannels', channels)
    } catch (error) {
      logger.error({
        error,
        message: 'saveSalesChannels-Error',
      })

      return { status: 'error', message: error }
    }

    return { status: 'success', message: '' }
  },
}

export default Settings
