import { SchemaDirectiveVisitor } from 'graphql-tools'
import { AuthenticationError, ForbiddenError } from '@vtex/api'
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'

import sendAuthMetric, { AuthMetric } from '../../utils/metrics/auth'

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

      // send metric to collect data about caller and tokens used in the request
      const operation = field.astNode?.name?.value ?? context?.request?.url
      const metric = new AuthMetric(
        context?.vtex?.account,
        {
          caller: context?.request?.headers['x-vtex-caller'] as string,
          userAgent: context?.request?.headers['user-agent'] as string,
          forwardedHost: context?.request?.headers[
            'x-forwarded-host'
          ] as string,
          hasAdminToken: !!adminUserAuthToken,
          hasApiToken: !!context?.request?.headers['vtex-api-apptoken'],
          hasStoreToken: false,
          operation,
        },
        'CheckAdminAccess'
      )

      sendAuthMetric(context, logger, metric)

      let token =
        adminUserAuthToken ?? (context?.headers.vtexidclientautcookie as string)

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
