import { AuthenticationError, ForbiddenError } from '@vtex/api'
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import sendAuthMetric, { AuthMetric } from '../../utils/metrics/auth'

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

      // send metric to collect data about caller and tokens used in the request
      const operation = field.astNode?.name?.value ?? context.request.url
      const metric = new AuthMetric(
        context.vtex.account,
        {
          caller: context.request.header['x-vtex-caller'] as string,
          userAgent: context.request.header['user-agent'] as string,
          forwardedHost: context.request.header['x-forwarded-host'] as string,
          hasAdminToken: !!adminUserAuthToken,
          hasApiToken: !!context.request.headers['vtex-api-apptoken'],
          hasStoreToken: !!storeUserAuthToken,
          operation,
        },
        'CheckUserAccess'
      )

      sendAuthMetric(context, logger, metric)

      let token = adminUserAuthToken

      const apiToken = context?.headers['vtex-api-apptoken'] as string
      const appKey = context?.headers['vtex-api-appkey'] as string

      // Add a condition to allow the caller storefront-permission call operations
      // because the app doesn't send the cookie header.
      if (
        context.headers?.['x-vtex-caller']?.indexOf(
          'vtex.storefront-permissions'
        ) !== -1 ||
        context.headers?.['x-vtex-caller']?.indexOf(
          'vtex.b2b-checkout-settings'
        ) !== -1
      ) {
        return resolve(root, args, context, info)
      }

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
