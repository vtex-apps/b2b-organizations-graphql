import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { Metric } from '../../clients/analytics'
import { B2B_METRIC_NAME } from '../../clients/analytics'

export interface CostCenterOrganizationMismatchFields {
  /** The cost center the caller asked for. */
  requestedCostCenterId: string | null
  /** Which organization that cost center actually belongs to. */
  costCenterOrganization: string | null
  /** The organization the session names right now. */
  sessionOrganization: string | null
  /** The cost center the session names right now. */
  sessionCostCenterId: string | null
  /** `public.b2bCurrentCostCenter` - the shopper's last explicit selection. */
  pendingCostCenterId: string | null
  /**
   * The answer this metric exists for: true means the shopper had just selected
   * exactly the rejected cost center and the session had not caught up (the
   * race), false means something asked for one they never selected (a real
   * permission failure, or a caller bug).
   */
  matchesPendingSelection: boolean
  /** Namespace names only, to tell "not selected" from "cannot read it". */
  sessionNamespaces: string[]
}

type CostCenterOrganizationMismatch = Metric & {
  fields: CostCenterOrganizationMismatchFields
}

class CostCenterOrganizationMismatchMetric
  implements CostCenterOrganizationMismatch
{
  public readonly description =
    'Cost center rejected because it does not belong to the session organization - Graphql'

  public readonly kind = 'cost-center-organization-mismatch-event'
  public readonly account: string
  public readonly fields: CostCenterOrganizationMismatchFields
  public readonly name = B2B_METRIC_NAME

  constructor(account: string, fields: CostCenterOrganizationMismatchFields) {
    this.account = account
    this.fields = fields
  }
}

/**
 * Ships the mismatch diagnostics through analytics as well as the log line.
 *
 * The log alone cannot answer this question: the IO pipeline samples every line
 * at 1:20 independently - `warn` and `error` alike, per line rather than per
 * request - so a rejection that fires three lines still has only a ~5% chance of
 * the diagnostic one surviving. At the observed four to five rejections a day
 * that is roughly one captured sample every four days. Verified on live traffic:
 * two rejections produced one surviving line each, and it was a different line
 * each time. Analytics is not sampled, so this is the surface that can actually
 * be counted; the log stays as the debugging surface.
 *
 * Fire-and-forget on purpose, matching `auditQueryEvent`. This runs on a request
 * that is about to be rejected, and `sendMetric` retries twice with a one second
 * gap - none of which the caller should wait for, and none of which should turn
 * a rejection into a different failure.
 *
 * Read it back with:
 *   SELECT * FROM vtex.schemaless.b2b_suite_buyerorg_data_raw
 *   WHERE payload LIKE '%cost-center-organization-mismatch-event%'
 */
export const sendCostCenterMismatchMetric = (
  ctx: Context,
  logger: Logger,
  fields: CostCenterOrganizationMismatchFields
) => {
  const {
    clients: { analytics },
    vtex: { account },
  } = ctx

  const metric = new CostCenterOrganizationMismatchMetric(account, fields)

  Promise.resolve(analytics.sendMetric(metric)).catch((error) => {
    logger.error({
      error,
      message: 'sendCostCenterMismatchMetric-error',
    })
  })
}
