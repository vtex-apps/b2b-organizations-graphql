import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'

const B2BSettings = {
  getB2BSettings: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { vbase },
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
      clients: { sellers },
    } = ctx

    return (await sellers.getSellers())?.items
  },
}

export default B2BSettings
