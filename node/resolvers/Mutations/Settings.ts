import {
    B2B_SETTINGS_DATA_ENTITY,
    B2B_SETTINGS_SCHEMA_VERSION
  } from '../../mdSchema'
  import GraphQLError from '../../utils/GraphQLError'
  import checkConfig from '../config'

  const B2BSettings = {
    saveB2BSettings: async (
      _: void,
      {
        organizationId,
        input: { autoApprove, defaultPaymentTerms, defaultPriceTables },
      }: { organizationId: string; input: B2BSettingsInput },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx
  
      // create schema if it doesn't exist
      await checkConfig(ctx)
  console.log(organizationId)
    //   if (!organizationId) {
    //     // get user's organization from session
    //     const { sessionData } = vtex as any
  
    //     if (!sessionData?.namespaces['storefront-permissions']) {
    //       throw new GraphQLError('organization-data-not-found')
    //     }
  
    //     const {
    //       organization: { value: userOrganizationId },
    //     } = sessionData.namespaces['storefront-permissions']
  
    //     organizationId = userOrganizationId
    //   }
  
      try {
        const b2bSettings = {
            autoApprove,
            defaultPaymentTerms, 
            defaultPriceTables
        }
        // const saveB2BSettingDocumentResult = await masterdata.getDocument({
        //     dataEntity: B2B_SETTINGS_DATA_ENTITY,
        //     fields: ['id'],
        //     id: organizationId,
        //   })
        // if (saveB2BSettingDocumentResult) {

        // }
        const saveB2BSettingResult = await masterdata.createDocument({
          dataEntity: B2B_SETTINGS_DATA_ENTITY,
          fields: b2bSettings,
          schema: B2B_SETTINGS_SCHEMA_VERSION,
        })
  
        return {
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
