import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import sendAuthMetric, { AuthMetric } from '../../utils/metrics/auth'
import {
  validateAdminToken,
  validateApiToken,
  validateStoreToken,
} from './helper'

export class AuditAccess extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      this.sendAuthMetric(field, context)

      return resolve(root, args, context, info)
    }
  }

  private async sendAuthMetric(field: GraphQLField<any, any>, context: any) {
    const {
      vtex: { adminUserAuthToken, storeUserAuthToken, logger },
    } = context

    const { hasAdminToken, hasValidAdminToken } = await validateAdminToken(
      context,
      adminUserAuthToken as string
    )

    const { hasApiToken, hasValidApiToken } = await validateApiToken(context)

    const { hasStoreToken, hasValidStoreToken } = await validateStoreToken(
      context,
      storeUserAuthToken as string
    )

    // now we emit a metric with all the collected data before we proceed
    const operation = field?.astNode?.name?.value ?? context?.request?.url
    const userAgent = context?.request?.headers['user-agent'] as string
    const caller = context?.request?.headers['x-vtex-caller'] as string
    const forwardedHost = context?.request?.headers[
      'x-forwarded-host'
    ] as string

    const auditMetric = new AuthMetric(context?.vtex?.account, {
      operation,
      forwardedHost,
      caller,
      userAgent,
      hasAdminToken,
      hasValidAdminToken,
      hasApiToken,
      hasValidApiToken,
      hasStoreToken,
      hasValidStoreToken,
    })

    await sendAuthMetric(context, logger, auditMetric)
  }
}
