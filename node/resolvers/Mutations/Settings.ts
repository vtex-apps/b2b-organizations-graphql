import {
  B2B_SETTINGS_DATA_ENTITY,
  B2B_SETTINGS_SCHEMA_VERSION,
  B2B_SETTINGS_FIELDS
} from '../../mdSchema'
import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'

const B2BSettings = {
  saveB2BSettings: async (
    _: void,
    {
      input: { autoApprove, defaultPaymentTerms, defaultPriceTables }, 
      page,
      pageSize
    }: {
      input: B2BSettingsInput, page: number
      pageSize: number
    },
    ctx: Context
  ) => {    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const b2bSettings = {
        autoApprove,
        defaultPaymentTerms,
        defaultPriceTables
      }
      
      const documentB2BSettingResult = await masterdata.searchDocuments({
        dataEntity: B2B_SETTINGS_DATA_ENTITY,
        fields: ['id', 'accountId' , ...B2B_SETTINGS_FIELDS],
        pagination: { page, pageSize },
        schema: B2B_SETTINGS_SCHEMA_VERSION,
      })

      if(!!documentB2BSettingResult.length) {
        const document = documentB2BSettingResult as any 

        await masterdata.updatePartialDocument({
          id: document[0].id,
          dataEntity: B2B_SETTINGS_DATA_ENTITY,
          fields: b2bSettings,
          schema: B2B_SETTINGS_SCHEMA_VERSION
        })
        
        return {
          status: 'success',
          message: 'Document Updated'
        }
      }

      const saveB2BSettingResult = await masterdata.createDocument({
        dataEntity: B2B_SETTINGS_DATA_ENTITY,
        fields: b2bSettings,
        schema: B2B_SETTINGS_SCHEMA_VERSION
      })

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
