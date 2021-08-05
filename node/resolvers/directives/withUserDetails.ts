/* eslint-disable max-params */
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export class WithUserDetails extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      const {
        vtex: { storeUserAuthToken },
        clients: { vtexId },
      } = context

      if (!storeUserAuthToken) {
        throw new Error('session_token_not_found')
      }

      const idResult = await vtexId.getAuthenticatedUser(storeUserAuthToken)

      if (!idResult) throw new Error('vtexId_token_lookup_failed')

      const newContext = {
        ...context,
        vtex: { ...context.vtex, userEmail: idResult.user },
      }

      return resolve(root, args, newContext, info)
    }
  }
}
