import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { Metric } from '../../clients/analytics'
import { B2B_METRIC_NAME } from '../../clients/analytics'

export interface AuthAuditMetric {
  operation: string
  forwardedHost: string
  caller: string
  role?: string
  permissions?: string[]
  hasAdminToken: boolean
  hasStoreToken: boolean
  hasApiToken: boolean
}

export class AuthMetric implements Metric {
  public readonly description: string
  public readonly kind: string
  public readonly account: string
  public readonly fields: AuthAuditMetric
  public readonly name = B2B_METRIC_NAME

  constructor(account: string, fields: AuthAuditMetric) {
    this.account = account
    this.fields = fields
    this.kind = 'b2b-organization-auth-event'
    this.description = 'Auth metric event'
  }
}

const sendAuthMetric = async (
  ctx: Context,
  logger: Logger,
  authMetric: AuthMetric
) => {
  const {
    clients: { analytics },
  } = ctx

  try {
    await analytics.sendMetric(authMetric)
  } catch (error) {
    logger.error({
      error,
      message: `Error to send metrics from auth metric`,
    })
  }
}

export default sendAuthMetric
