import { SchemaDirectiveVisitor } from 'graphql-tools'
import { AuthenticationError, ForbiddenError } from '@vtex/api'
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'

export class CheckAdminAccess extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      const {
        vtex: { adminUserAuthToken, logger },
        clients: { identity },
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

      if (!token) {
        throw new AuthenticationError('No token was provided')
      }

      try {
        await identity.validateToken({ token })
      } catch (err) {
        logger.warn({
          error: err,
          message: 'CheckAdminAccess: Invalid token',
          token,
        })
        throw new ForbiddenError('Unauthorized Access')
      }

      return resolve(root, args, context, info)
    }
  }
}
