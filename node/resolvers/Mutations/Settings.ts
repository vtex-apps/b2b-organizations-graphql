import GraphQLError from '../../utils/GraphQLError'
import checkConfig, { getAppId } from '../config'

export const B2B_SETTINGS_DOCUMENT_ID = 'b2bSettings'

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
  saveB2BSettings: async (
    _: void,
    {
      input: { autoApprove, defaultPaymentTerms, defaultPriceTables },
    }: {
      input: B2BSettingsInput
      page: number
      pageSize: number
    },
    ctx: Context
  ) => {
    const {
      clients: { vbase },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const B2B_SETTINGS_DATA_ENTITY = 'b2b_settings'

    try {
      const b2bSettings = {
        autoApprove,
        defaultPaymentTerms,
        defaultPriceTables,
      }

      await vbase.saveJSON(B2B_SETTINGS_DATA_ENTITY, 'settings', b2bSettings)

      return {
        status: 'success',
      }
    } catch (e) {
      logger.error({
        message: 'saveB2BSettings-error',
        error: e,
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
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
