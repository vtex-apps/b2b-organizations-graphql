/**
 * Helpers for the HTTP routes in `resolvers/Routes` (B2BTEAM-3984, SDD §4.3).
 *
 * The @vtex/api HTTP error middleware re-logs every error a route throws,
 * using the error's own `level` ('warn' | 'error', default 'error'). Expected
 * outcomes (order not found, checkout refusing a cancellation with 4xx) are
 * already logged here as structured warns, so the rethrown error is marked
 * `level: 'warn'` to keep the runtime re-log at warn too.
 */

export type RouteName = 'orders' | 'order' | 'requestCancellation' | 'checkout'

/**
 * Same contract as `withLogLevel` in `utils/GraphQLError.ts` on the
 * B2BTEAM-3982 branch, kept here so this change does not depend on it. Once
 * both are merged, this can be replaced by that helper.
 */
export const withLogLevel = <T>(
  error: T,
  level: 'warn' | 'error'
): T & { level: 'warn' | 'error' } =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.assign(error as any, { level })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getResponseStatus = (error: any): number | undefined => {
  const status = error?.response?.status

  return typeof status === 'number' ? status : undefined
}
