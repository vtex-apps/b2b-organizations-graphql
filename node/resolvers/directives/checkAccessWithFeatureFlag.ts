import { AuthenticationError, ForbiddenError } from '@vtex/api'
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export class CheckAccessWithFeatureFlag extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      const {
        vtex: { adminUserAuthToken, storeUserAuthToken, logger },
        clients: { identity, vtexId, masterdata },
      } = context

      const config: { enable: boolean } = await masterdata.getDocument({
        dataEntity: 'auth_validation_config',
        fields: ['enable'],
        id: 'config',
      })

      if (config?.enable) {
        const token =
          adminUserAuthToken ??
          (context?.headers.vtexidclientautcookie as string)

        if (!token && !storeUserAuthToken) {
          throw new AuthenticationError('No admin or store token was provided')
        }

        if (token) {
          try {
            await identity.validateToken({ token })
          } catch (err) {
            logger.warn({
              error: err,
              message: 'CheckUserAccess: Invalid admin token',
              token,
            })
            throw new ForbiddenError('Unauthorized Access')
          }
        } else if (storeUserAuthToken) {
          let authUser = null

          try {
            authUser = await vtexId.getAuthenticatedUser(storeUserAuthToken)
            if (!authUser?.user) {
              authUser = null
            }
          } catch (err) {
            logger.warn({
              error: err,
              message: 'CheckUserAccess: Invalid store user token',
              token: storeUserAuthToken,
            })
            authUser = null
          }

          if (!authUser) {
            throw new ForbiddenError('Unauthorized Access')
          }
        }
      }

      return resolve(root, args, context, info)
    }
  }
}
