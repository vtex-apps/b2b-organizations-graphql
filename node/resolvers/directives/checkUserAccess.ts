import { SchemaDirectiveVisitor } from 'graphql-tools'
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { AuthenticationError, ForbiddenError } from '@vtex/api'

export class CheckUserAccess extends SchemaDirectiveVisitor {
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
        clients: { identity, vtexId },
      } = context

      let token = adminUserAuthToken

      const apiToken = context?.headers['vtex-api-apptoken'] as string
      const appKey = context?.headers['vtex-api-appkey'] as string

      if (apiToken?.length && appKey?.length) {
        token = (
          await identity.getToken({ appkey: appKey, apptoken: apiToken })
        ).token
        context.cookies.set('VtexIdclientAutCookie', token)
        context.vtex.adminUserAuthToken = token
      }

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

      return resolve(root, args, context, info)
    }
  }
}
