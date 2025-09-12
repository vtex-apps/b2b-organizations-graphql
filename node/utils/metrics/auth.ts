import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { Metric } from '../../clients/analytics'
import { B2B_METRIC_NAME } from '../../clients/analytics'
import { transformOperation } from './transformOperation'

export interface AuthAuditMetric {
  operation: string
  forwardedHost: string
  caller: string
  userAgent: string
  role?: string
  permissions?: string[]
  hasAdminToken?: boolean
  hasValidAdminToken?: boolean
  hasStoreToken?: boolean
  hasCurrentValidStoreToken?: boolean
  hasValidStoreToken?: boolean
  hasApiToken?: boolean
  hasValidApiToken?: boolean
  hasAdminTokenOnHeader?: boolean
  hasValidAdminTokenOnHeader?: boolean
}

export class AuthMetric implements Metric {
  public readonly description: string
  public readonly kind: string
  public readonly account: string
  public readonly fields: AuthAuditMetric
  public readonly name = B2B_METRIC_NAME

  constructor(account: string, fields: AuthAuditMetric, description?: string) {
    this.account = account
    this.fields = fields
    this.kind = 'b2b-organizations-graphql-auth-event'
    this.description = description ?? 'Auth metric event'
  }
}

const sendAuthMetric = async (
  ctx: Context,
  logger: Logger,
  authMetric: AuthMetric,
  statusCode?: number,
  shouldSendMetrics: boolean = true
) => {
  const {
    clients: { analytics, audit },
    ip,
  } = ctx

  const { subjectId, operation, entityNameFirstLetter } = transformOperation(authMetric.fields.operation, statusCode);


  try {
    if (statusCode === 403) {
      await audit.sendEvent({
        subjectId: subjectId,
        operation: operation,
        authorId: "unknown",
        meta: {
          entityName: entityNameFirstLetter,
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      }, { logger })
    } else if (statusCode === 401) {
      await audit.sendEvent({
        subjectId: subjectId,
        operation: operation,
        authorId: "unknown",
        meta: {
          entityName: entityNameFirstLetter,
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      }, {})
    }
    
    if (shouldSendMetrics) {
      await analytics.sendMetric(authMetric)
    }
  } catch (error) {
    logger.error({
      error,
      message: `Error to send metrics from auth metric`,
    })
  }
}

export default sendAuthMetric
