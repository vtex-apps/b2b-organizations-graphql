import { B2B_SETTINGS_DATA_ENTITY } from '../../mdSchema'
import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'

const B2BSettings = {
  getB2BSettings: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { vbase },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    let settings = null

    try {
      settings = await vbase.getJSON<B2BSettingsInput | null>(
        B2B_SETTINGS_DATA_ENTITY,
        'settings',
        true
      )
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
}

export default B2BSettings
