import {
  B2B_SETTINGS_DATA_ENTITY,
  B2B_SETTINGS_SCHEMA_VERSION,
} from '../../mdSchema'
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
      clients: { masterdata },
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

      const saveB2BSettingResult = await masterdata.createOrUpdateEntireDocument(
        {
          id: B2B_SETTINGS_DOCUMENT_ID,
          dataEntity: B2B_SETTINGS_DATA_ENTITY,
          fields: b2bSettings,
          schema: B2B_SETTINGS_SCHEMA_VERSION,
        }
      )

      return {
        href: saveB2BSettingResult.Href,
        id: saveB2BSettingResult.Id,
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
