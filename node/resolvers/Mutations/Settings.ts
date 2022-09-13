import { B2B_SETTINGS_DATA_ENTITY } from '../../mdSchema'
import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'

export const B2B_SETTINGS_DOCUMENT_ID = 'b2bSettings'

const B2BSettings = {
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
}

export default B2BSettings
