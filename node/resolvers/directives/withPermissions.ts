/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-params */
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import type StorefrontPermissions from '../../clients/storefrontPermissions'

export const getUserPermission = async (
  storefrontPermissions: StorefrontPermissions,
  app = 'vtex.b2b-organizations@2.x'
) => {
  const result = await storefrontPermissions.checkUserPermission(app)

  return result?.data?.checkUserPermission ?? null
}

export class WithPermissions extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (root: any, args: any, context: any, info: any) => {
      const {
        clients: { storefrontPermissions },
        vtex: { adminUserAuthToken, logger },
      } = context

      const appClients = context.vtex as any
      const sender =
        context?.graphql?.query?.senderApp ??
        context?.graphql?.query?.extensions?.persistedQuery?.sender ??
        context?.request?.header['x-b2b-senderapp'] ??
        undefined

      appClients.storefrontPermissions = await getUserPermission(
        storefrontPermissions,
        sender
      ).catch((error: any) => {
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
