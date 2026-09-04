import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { Metric } from '../../clients/analytics'
import { B2B_METRIC_NAME } from '../../clients/analytics'
import type { CallerDescription } from '../caller'

/**
 * Why the storefront was refused. One event kind with a discriminator rather
 * than one kind per throw site: every one of these surfaces to the shopper as
 * the same failed checkout step, and the open question is which of them
 * dominates - a question a single query has to be able to answer.
 */
export type StorefrontAccessDeniedReason =
  /** The cost center exists but belongs to another organization. */
  | 'cost-center-organization-mismatch'
  /** The session carried no `storefront-permissions` namespace at all. */
  | 'missing-storefront-permissions-namespace'
  /** The session named an organization whose status is not active. */
  | 'organization-not-active'
  /** No session data reached the resolver, and none could be fetched. */
  | 'no-session-data'
  /** The session named an organization Master Data does not return. */
  | 'organization-not-found'

export interface StorefrontAccessDeniedFields extends CallerDescription {
  reason: StorefrontAccessDeniedReason
  /** Namespace names only, to tell "not set" apart from "cannot read it". */
  sessionNamespaces: string[]
  /** The organization the session names right now. */
  sessionOrganization: string | null
  /** The cost center the session names right now. */
  sessionCostCenterId: string | null
  /** The cost center the caller asked for, when it asked for one. */
  requestedCostCenterId: string | null
  /** Which organization that cost center actually belongs to. */
  costCenterOrganization: string | null
  /** The organization id that was looked up and not found. */
  lookedUpOrganizationId: string | null
  /** `public.b2bCurrentCostCenter` - the shopper's last explicit selection. */
  pendingCostCenterId: string | null
  /**
   * True means the shopper had just selected exactly the rejected cost center
   * and the session had not caught up (the race). False means something asked
   * for one they never selected - a real permission failure, or a caller bug.
   * Only meaningful for `cost-center-organization-mismatch`.
   */
  matchesPendingSelection: boolean | null
}

const EMPTY_FIELDS: Omit<StorefrontAccessDeniedFields, 'reason'> = {
  callerApp: null,
  costCenterOrganization: null,
  lookedUpOrganizationId: null,
  matchesPendingSelection: null,
  operationName: null,
  pendingCostCenterId: null,
  requestedCostCenterId: null,
  sessionCostCenterId: null,
  sessionNamespaces: [],
  sessionOrganization: null,
}

type StorefrontAccessDenied = Metric & {
  fields: StorefrontAccessDeniedFields
}

class StorefrontAccessDeniedMetric implements StorefrontAccessDenied {
  public readonly description =
    'Storefront refused access to B2B organization data - Graphql'

  public readonly kind = 'storefront-access-denied-event'
  public readonly account: string
  public readonly fields: StorefrontAccessDeniedFields
  public readonly name = B2B_METRIC_NAME

  constructor(account: string, fields: StorefrontAccessDeniedFields) {
    this.account = account
    this.fields = fields
  }
}

/**
 * Emits one denial on both surfaces: the sampled log line for debugging an
 * individual case, and the unsampled analytics event for counting them.
 *
 * The log alone cannot answer "which reason dominates": the IO pipeline
 * samples every line at 1:20 independently - `warn` and `error` alike, per
 * line rather than per request - so a rejection that fires three lines still
 * has only a ~5% chance of the diagnostic one surviving. At four to five
 * rejections a day that is roughly one captured sample every four days.
 * Verified on live traffic: two rejections produced one surviving line each,
 * and it was a different line each time.
 *
 * Fire-and-forget on purpose, matching `auditQueryEvent`. This runs on a
 * request that is about to be rejected, and `sendMetric` retries twice with a
 * one second gap - none of which the caller should wait for, and none of which
 * should turn a rejection into a different failure.
 *
 * Read it back with:
 *   SELECT * FROM vtex.schemaless.b2b_suite_buyerorg_data_raw
 *   WHERE payload LIKE '%storefront-access-denied-event%'
 */
export const reportStorefrontAccessDenied = (
  ctx: Context,
  logger: Logger,
  message: string,
  fields: Partial<StorefrontAccessDeniedFields> & {
    reason: StorefrontAccessDeniedReason
  }
) => {
  const {
    clients: { analytics },
    vtex: { account },
  } = ctx

  const complete: StorefrontAccessDeniedFields = { ...EMPTY_FIELDS, ...fields }

  // The debugging surface. Sampled 1:20 by the IO pipeline, so it shows
  // individual cases but cannot be counted.
  logger.warn({ ...complete, message })

  // The measuring surface: not sampled, lands in
  // vtex.schemaless.b2b_suite_buyerorg_data_raw.
  const metric = new StorefrontAccessDeniedMetric(account, complete)

  Promise.resolve(analytics.sendMetric(metric)).catch((error) => {
    logger.error({
      error,
      message: 'reportStorefrontAccessDenied-error',
    })
  })
}
