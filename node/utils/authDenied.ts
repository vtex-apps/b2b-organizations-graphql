/**
 * Access denials (B2BTEAM-3985, SDD §4.2 and §5).
 *
 * A deny is an expected outcome, never an error: the caller lacks the session
 * organization, the permission, or its organization is inactive. Each deny
 * emits exactly one structured `warn` `auth.denied` and throws the same error
 * the resolvers threw before (same class, same message, same
 * `extensions.message`), marked `level: 'warn'` with `withLogLevel` so the
 * @vtex/api GraphQL error middleware re-logs it at warn instead of error.
 *
 * Gate test (vtex link, b2b3985, 21/10): the middleware only honors
 * `extensions.exception.level`. A plain `GraphQLError` and one with
 * `extensions.code: 'FORBIDDEN'` are both re-logged as error; `ForbiddenError`
 * is re-logged as warn but drops `extensions.message` and changes
 * `exception.name`/`code`/`status` in the response. Marking the existing
 * error keeps the payload unchanged apart from `exception.level: "warn"`.
 */
import { describeClientError } from './clientError'
import GraphQLError, { withLogLevel } from './GraphQLError'

export type AuthDeniedReason =
  | 'organization-data-not-found'
  | 'not-permitted'
  | 'inactive-organization'
  | 'no-session'

// The front reads these strings; they must not change.
const DENY_MESSAGE: Record<AuthDeniedReason, string> = {
  'inactive-organization': 'This organization is not active',
  'no-session': 'No session data for this current user',
  'not-permitted': 'operation-not-permitted',
  'organization-data-not-found': 'organization-data-not-found',
}

// Lets the callers that catch and re-log errors recognize a deny without
// adding an enumerable field (which would leak into the GraphQL response).
const deniedErrors = new WeakSet()

interface AuthDeniedParams {
  operation: string
  reason: AuthDeniedReason
  orgId?: string | null
  targetUserId?: string | null
}

export const authDenied = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  { operation, reason, orgId, targetUserId }: AuthDeniedParams
) => {
  logger.warn({
    message: 'auth.denied',
    operation,
    reason,
    ...(orgId ? { orgId } : {}),
    ...(targetUserId ? { targetUserId } : {}),
  })

  // `This organization is not active` and `No session data for this current
  // user` were always thrown as a plain Error; keep it that way so their
  // response shape does not change.
  const error =
    reason === 'inactive-organization' || reason === 'no-session'
      ? new Error(DENY_MESSAGE[reason])
      : new GraphQLError(DENY_MESSAGE[reason])

  deniedErrors.add(error)

  return withLogLevel(error, 'warn')
}

export const isAuthDenied = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && deniedErrors.has(error)

// Errors already logged as `error` where they were raised, so the callers
// that catch and re-log do not log them twice.
const loggedAccessErrors = new WeakSet()

export type AccessLookupFailure = 'role-lookup-failed' | 'user-lookup-failed'

interface AccessLookupFailedParams {
  entity?: string
  operation: string
  reason: AccessLookupFailure
  orgId?: string | null
  targetUserId?: string | null
}

/**
 * The lookup that decides access (storefront-permissions getUser/getRole)
 * failed. That is an infrastructure failure, not a deny, so it is logged as
 * `error` `<op>.checkUserIsAllowedError` with the real cause and never as
 * `auth.denied` (review on #240).
 */
export const logAccessLookupFailed = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  { entity, operation, reason, orgId, targetUserId }: AccessLookupFailedParams,
  error: unknown
) => {
  logger.error({
    ...(entity ? { entity } : {}),
    message: `${operation}.checkUserIsAllowedError`,
    operation,
    reason,
    ...(orgId ? { orgId } : {}),
    ...(targetUserId ? { targetUserId } : {}),
    error: describeClientError(error),
  })
}

/**
 * What the client gets when the access decision could not be made because
 * the lookup failed: the same `operation-not-permitted` it always got, left
 * at the default (error) level. Call it after `logAccessLookupFailed`.
 */
export const accessLookupFailedError = () => {
  const error = new GraphQLError(DENY_MESSAGE['not-permitted'])

  loggedAccessErrors.add(error)

  return error
}

/** A deny or a lookup failure already logged: callers must not re-log it. */
export const isAccessErrorLogged = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (deniedErrors.has(error) || loggedAccessErrors.has(error))

/**
 * `error` for a real failure while deciding access or right after it
 * (`<op>.checkUserIsAllowedError`, `impersonateB2BUser.error`), with
 * `describeClientError` instead of the raw error object.
 */
export const logAccessError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  message: string,
  fields: Record<string, unknown>,
  error: unknown
) => {
  logger.error({
    message,
    ...fields,
    error: describeClientError(error),
  })
}
