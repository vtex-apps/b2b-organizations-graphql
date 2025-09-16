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
} from './helper'
import { LICENSE_MANAGER_ROLES } from '../../constants'

export class ValidateAdminUserAccess extends SchemaDirectiveVisitor {
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
      } = context

      // Get the admin permission from directive arguments, defaulting to VIEW permission
      const adminPermissionArg =
        this.args?.adminPermission || 'B2B_ORGANIZATIONS_VIEW'

      const requiredPermission =
        adminPermissionArg === 'B2B_ORGANIZATIONS_VIEW'
          ? LICENSE_MANAGER_ROLES.B2B_ORGANIZATIONS_VIEW
          : LICENSE_MANAGER_ROLES.B2B_ORGANIZATIONS_EDIT

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

      const { hasAdminToken, hasValidAdminToken, hasValidAdminRole } =
        await validateAdminToken(
          context,
          adminUserAuthToken as string,
          requiredPermission
        )

      // add admin token metrics
      metricFields = {
        ...metricFields,
        hasAdminToken,
        hasValidAdminToken,
        hasValidAdminRole,
      }

      // allow access if has valid admin token and valid admin role
      if (hasValidAdminToken && hasValidAdminRole) {
        sendAuthMetric(
          context,
          logger,
          new AuthMetric(
            context?.vtex?.account,
            metricFields,
            'ValidateAdminUserAccessAudit'
          )
        )

        return resolve(root, args, context, info)
      }

      // If there's no valid admin token on context, search for it on header
      const {
        hasAdminTokenOnHeader,
        hasValidAdminTokenOnHeader,
        hasValidAdminRoleOnHeader,
      } = await validateAdminTokenOnHeader(context, requiredPermission)

      // add admin header token metrics
      metricFields = {
        ...metricFields,
        hasAdminTokenOnHeader,
        hasValidAdminTokenOnHeader,
        hasValidAdminRoleOnHeader,
      }

      // allow access if has valid admin token and valid admin role
      if (hasValidAdminTokenOnHeader && hasValidAdminRoleOnHeader) {
        // set adminUserAuthToken on context so it can be used later
        context.vtex.adminUserAuthToken = context?.headers
          .vtexidclientautcookie as string
        sendAuthMetric(
          context,
          logger,
          new AuthMetric(
            context?.vtex?.account,
            metricFields,
            'ValidateAdminUserAccessAudit'
          )
        )

        return resolve(root, args, context, info)
      }

      const { hasApiToken, hasValidApiToken, hasValidApiRole } =
        await validateApiToken(context, requiredPermission)

      // add API token metrics
      metricFields = {
        ...metricFields,
        hasApiToken,
        hasValidApiToken,
        hasValidApiRole,
      }

      // allow access if has valid API token and valid API role
      if (hasValidApiToken && hasValidApiRole) {
        sendAuthMetric(
          context,
          logger,
          new AuthMetric(
            context?.vtex?.account,
            metricFields,
            'ValidateAdminUserAccessAudit'
          )
        )

        return resolve(root, args, context, info)
      }

      // deny access if no tokens were provided
      if (!hasAdminToken && !hasAdminTokenOnHeader && !hasApiToken) {
        logger.warn({
          message: 'ValidateAdminUserAccess: No token provided',
          ...metricFields,
        })
        throw new AuthenticationError('No token was provided')
      }

      // deny access if no valid tokens were provided or no valid role
      logger.warn({
        message:
          'ValidateAdminUserAccess: Invalid token or insufficient role permissions',
        requiredPermission,
        ...metricFields,
      })
      throw new ForbiddenError(`Unauthorized Access`)
    }
  }
}
