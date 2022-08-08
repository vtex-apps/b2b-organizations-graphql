/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-params */
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export class WithPermissions extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      const {
        clients: { storefrontPermissions },
        vtex: { adminUserAuthToken, logger },
      } = context

      const appClients = context.vtex as any

      appClients.storefrontPermissions = await storefrontPermissions
        .checkUserPermission()
        .then((result: any) => {
          return result?.data?.checkUserPermission ?? null
        })
        .catch((error: any) => {
          if (!adminUserAuthToken) {
            logger.error({
              message: 'getPermissionsError',
              error,
            })
          }

          return null
        })

      return resolve(root, args, context, info)
    }
  }
}
