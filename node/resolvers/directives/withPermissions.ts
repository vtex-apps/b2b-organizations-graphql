/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-params */
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

const QUERIES = {
  getPermission: `query permissions {
    checkUserPermission @context(provider: "vtex.storefront-permissions"){
      role {
        id
        name
        slug
      }
      permissions
    }
  }`,
}

export class WithPermissions extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (root: any, args: any, context: any, info: any) => {
      const {
        clients: { graphQLServer },
        vtex: { adminUserAuthToken, logger },
      } = context

      context.vtex.storefrontPermissions = await graphQLServer
        .query(
          QUERIES.getPermission,
          {},
          {
            persistedQuery: {
              provider: 'vtex.storefront-permissions@1.x',
              sender: 'vtex.b2b-organizations@0.x',
            },
          }
        )
        .then((result: any) => {
          return result?.data?.checkUserPermission ?? null
        })
        .catch((error: any) => {
          console.error(error)
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
