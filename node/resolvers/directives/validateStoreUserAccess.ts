import { SchemaDirectiveVisitor } from 'graphql-tools'
import { AuthenticationError, ForbiddenError } from '@vtex/api'
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'

import type { AuthAuditMetric } from '../../utils/metrics/auth'
import sendAuthMetric, { AuthMetric } from '../../utils/metrics/auth'
import {
  validateAdminToken,
  validateAdminTokenOnHeader,
  validateApiToken,
  validateStoreToken,
} from './helper'

export class ValidateStoreUserAccess extends SchemaDirectiveVisitor {
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
      } = context

      // get metrics data
      const operation = field?.astNode?.name?.value ?? context?.request?.url
      const userAgent = context?.request?.headers['user-agent'] as string
      const caller = context?.request?.headers['x-vtex-caller'] as string
      const forwardedHost = context?.request?.headers[
        'x-forwarded-host'
      ] as string

      // set metric fields with initial data
      let metricFields: AuthAuditMetric = {
        operation,
        forwardedHost,
        caller,
        userAgent,
      }

      const { hasAdminToken, hasValidAdminToken } = await validateAdminToken(
        context,
        adminUserAuthToken as string
      )

      // add admin token metrics
      metricFields = {
        ...metricFields,
        hasAdminToken,
        hasValidAdminToken,
      }

      // allow access if has valid admin token
      if (hasValidAdminToken) {
        sendAuthMetric(
          context,
          logger,
          new AuthMetric(
            context?.vtex?.account,
            metricFields,
            'ValidateStoreUserAccessAudit'
          )
        )

        return resolve(root, args, context, info)
      }

      // If there's no valid admin token on context, search for it on header
      const { hasAdminTokenOnHeader, hasValidAdminTokenOnHeader } =
        await validateAdminTokenOnHeader(context)

      // add admin header token metrics
      metricFields = {
        ...metricFields,
        hasAdminTokenOnHeader,
        hasValidAdminTokenOnHeader,
      }

      // allow access if has valid admin token
      if (hasValidAdminTokenOnHeader) {
        // set adminUserAuthToken on context so it can be used later
        context.vtex.adminUserAuthToken = context?.headers
          .vtexidclientautcookie as string
        sendAuthMetric(
          context,
          logger,
          new AuthMetric(
            context?.vtex?.account,
            metricFields,
            'ValidateStoreUserAccessAudit'
          )
        )

        return resolve(root, args, context, info)
      }

      // If there's no valid admin token on context or header,
      // invalidate the adminUserAuthToken on context
      context.vtex.adminUserAuthToken = undefined

      const { hasApiToken, hasValidApiToken } = await validateApiToken(context)

      // add API token metrics
      metricFields = {
        ...metricFields,
        hasApiToken,
        hasValidApiToken,
      }

      // allow access if has valid API token
      if (hasValidApiToken) {
        sendAuthMetric(
          context,
          logger,
          new AuthMetric(
            context?.vtex?.account,
            metricFields,
            'ValidateStoreUserAccessAudit'
          )
        )

        return resolve(root, args, context, info)
      }

      const { hasStoreToken, hasValidStoreToken } = await validateStoreToken(
        context,
        storeUserAuthToken as string
      )

      // add store token metrics
      metricFields = {
        ...metricFields,
        hasStoreToken,
        hasValidStoreToken,
      }

      // allow access if has valid store token
      if (hasValidStoreToken) {
        sendAuthMetric(
          context,
          logger,
          new AuthMetric(
            context?.vtex?.account,
            metricFields,
            'ValidateStoreUserAccessAudit'
          )
        )

        return resolve(root, args, context, info)
      }

      // deny access if no tokens were provided
      if (!hasAdminToken && !hasApiToken && !hasStoreToken) {
        logger.warn({
          message: 'ValidateStoreUserAccess: No token provided',
          ...metricFields,
        })
        throw new AuthenticationError('No token was provided')
      }

      // deny access if no valid tokens were provided
      logger.warn({
        message: `ValidateStoreUserAccess: Invalid token`,
        ...metricFields,
      })
      throw new ForbiddenError('Unauthorized Access')
    }
  }
}
