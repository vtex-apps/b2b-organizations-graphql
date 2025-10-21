import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'
import type { B2BSettingsInput } from '../../typings'
import type { GetSellersOpts } from '../../clients/sellers'

const B2BSettings = {
  getB2BSettings: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { vbase, audit },
      ip
    } = ctx

    const B2B_SETTINGS_DATA_ENTITY = 'b2b_settings'

    // create schema if it doesn't exist
    await checkConfig(ctx)

    let settings: Partial<B2BSettingsInput> | null = null

    try {
      settings = await vbase.getJSON<B2BSettingsInput | null>(
        B2B_SETTINGS_DATA_ENTITY,
        'settings',
        true
      )

      settings = {
        ...settings,
        // if custom fields are null, set to an empty array
        costCenterCustomFields: settings?.costCenterCustomFields ?? [],
        organizationCustomFields: settings?.organizationCustomFields ?? [],
        transactionEmailSettings: settings?.transactionEmailSettings ?? {
          organizationApproved: true,
          organizationCreated: true,
          organizationDeclined: true,
          organizationRequestCreated: false,
          organizationStatusChanged: true,
        },
      }

      await audit.sendEvent({
        subjectId: 'get-b2b-settings-event',
        operation: 'GET_B2B_SETTINGS',
        meta: {
          entityName: 'GetB2BSettings',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

    } catch (e) {
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
    }

    return settings
  },
  getSellers: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { sellers, audit },
      ip
    } = ctx

    await audit.sendEvent({
      subjectId: 'get-sellers-event',
      operation: 'GET_SELLERS',
      meta: {
        entityName: 'GetSellers',
        remoteIpAddress: ip,
        entityBeforeAction: JSON.stringify({}),
        entityAfterAction: JSON.stringify({}),
      },
    })

    return (await sellers.getSellers())?.items
  },
  getSellersPaginated: async (
    _: void,
    options: GetSellersOpts,
    ctx: Context
  ) => {
    const {
      clients: { sellers, audit },
      ip
    } = ctx

    try {

      await audit.sendEvent({
        subjectId: 'get-sellers-paginated-event',
        operation: 'GET_SELLERS_PAGINATED',
        meta: {
          entityName: 'GetSellersPaginated',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return await sellers.getSellersPaginated(options)
    } catch (e) {
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
    }
  },
  getAccount: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { lm, audit },
      ip
    } = ctx

    try {
      
      await audit.sendEvent({
        subjectId: 'get-account-event',
        operation: 'GET_ACCOUNT',
        meta: {
          entityName: 'GetAccount',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return await lm.getAccount()
    } catch (e) {
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
