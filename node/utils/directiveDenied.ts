/**
 * Denials from the `@validateAdminUserAccess` / `@validateStoreUserAccess`
 * directives (B2BTEAM-3986, SDD §4.2 and §5).
 *
 * These were already `warn`, but with free-text messages
 * (`ValidateAdminUserAccess: No token provided`, ...). They now share the
 * `auth.denied` key with a `reason`, keep every metric field they had, and
 * add `directive` so the two directives can still be told apart. The thrown
 * error (`AuthenticationError` / `ForbiddenError`) does not change.
 */
import type { AuthAuditMetric } from './metrics/auth'

export type DirectiveDeniedReason =
  | 'no-token'
  | 'invalid-token'
  | 'insufficient-role'

export type AuthDirective =
  | 'validateAdminUserAccess'
  | 'validateStoreUserAccess'

/**
 * `insufficient-role` when some token was valid for the account but lacked
 * the required License Manager role; `invalid-token` otherwise.
 */
export const getDirectiveDeniedReason = (
  fields: AuthAuditMetric
): Exclude<DirectiveDeniedReason, 'no-token'> =>
  (fields.hasValidAdminToken && !fields.hasValidAdminRole) ||
  (fields.hasValidAdminTokenOnHeader && !fields.hasValidAdminRoleOnHeader) ||
  (fields.hasValidApiToken && !fields.hasValidApiRole)
    ? 'insufficient-role'
    : 'invalid-token'

export const logDirectiveDenied = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  directive: AuthDirective,
  reason: DirectiveDeniedReason,
  metricFields: AuthAuditMetric,
  extra: Record<string, unknown> = {}
) => {
  logger.warn({
    ...metricFields,
    ...extra,
    directive,
    message: 'auth.denied',
    reason,
  })
}
