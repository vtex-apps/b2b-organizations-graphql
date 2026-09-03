import GraphQLError from '../../utils/GraphQLError'
import { describeClientError } from '../../utils/clientError'
import {
  auditQueryEvent,
  ensureConfigForQuery,
} from '../../utils/queryObservability'
import { getCachedB2BSettings } from '../../services/organizationsCache'
import type { B2BSettingsInput } from '../../typings'
import type { GetSellersOpts } from '../../clients/sellers'

const B2B_SETTINGS_DATA_ENTITY = 'b2b_settings'

const B2BSettings = {
  getB2BSettings: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { vbase },
      ip,
    } = ctx

    ensureConfigForQuery(ctx)

    try {
      const settings = await getCachedB2BSettings(ctx, async () => {
        const raw = await vbase.getJSON<B2BSettingsInput | null>(
          B2B_SETTINGS_DATA_ENTITY,
          'settings',
          true
        )

        return {
          ...raw,
          costCenterCustomFields: raw?.costCenterCustomFields ?? [],
          organizationCustomFields: raw?.organizationCustomFields ?? [],
          transactionEmailSettings: raw?.transactionEmailSettings ?? {
            organizationApproved: true,
            organizationCreated: true,
            organizationDeclined: true,
            organizationRequestCreated: false,
            organizationStatusChanged: true,
          },
        }
      })

      auditQueryEvent(ctx, {
        subjectId: 'get-b2b-settings-event',
        operation: 'GET_B2B_SETTINGS',
        meta: {
          entityName: 'B2BSettings',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return settings
    } catch (e) {
      ctx.vtex.logger.error({
        error: describeClientError(e),
        message: 'getB2BSettings-error',
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
  getSellers: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { sellers },
      ip,
    } = ctx

    auditQueryEvent(ctx, {
      subjectId: 'get-sellers-event',
      operation: 'GET_SELLERS',
      meta: {
        entityName: 'Sellers',
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
      clients: { sellers },
      ip,
    } = ctx

    try {
      auditQueryEvent(ctx, {
        subjectId: 'get-sellers-paginated-event',
        operation: 'GET_SELLERS_PAGINATED',
        meta: {
          entityName: 'Sellers',
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
      clients: { lm },
      ip,
    } = ctx

    try {
      const result = await lm.getAccount()

      auditQueryEvent(ctx, {
        subjectId: 'get-account-event',
        operation: 'GET_ACCOUNT',
        meta: {
          entityName: 'Account',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return result
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
