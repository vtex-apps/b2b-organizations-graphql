import { B2B_SETTINGS_DATA_ENTITY, B2B_SETTINGS_FIELDS } from '../../mdSchema'
import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'
import { B2B_SETTINGS_DOCUMENT_ID } from '../Mutations/Settings'

const B2BSettings = {
  getB2BSettings: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { masterdata },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const document = await masterdata.getDocument({
        dataEntity: B2B_SETTINGS_DATA_ENTITY,
        fields: B2B_SETTINGS_FIELDS,
        id: B2B_SETTINGS_DOCUMENT_ID,
      })

      return document
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
