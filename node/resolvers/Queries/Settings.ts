import {
    B2B_SETTINGS_DATA_ENTITY,
    B2B_SETTINGS_FIELDS
} from '../../mdSchema'
import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'

const B2BSettings = {
    getB2BSettings: async (_: void, {id}: {id: string}, ctx: Context) => {
        const {
            clients: { masterdata },
        } = ctx
        
        // create schema if it doesn't exist
        await checkConfig(ctx)

        try {
            const document = await masterdata.getDocument({
                dataEntity: B2B_SETTINGS_DATA_ENTITY,
                fields: B2B_SETTINGS_FIELDS,
                id
            })

            return {data: [document]}
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
