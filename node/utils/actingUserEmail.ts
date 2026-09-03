import { describeClientError } from './clientError'
import type { Timer } from './requestTimings'

/**
 * Where the acting user's email came from, ordered from the most explicit
 * source to the last resort. Logged alongside the queries that resolve it so
 * production shows how often each fallback is what saved the request.
 */
export type ActingUserEmailSource =
  | 'argument'
  | 'none'
  | 'session-authentication'
  | 'session-profile'
  | 'store-token'

export interface ActingUserEmail {
  email: string | null
  source: ActingUserEmailSource
}

/**
 * Email of the store user a request is acting as, as validated by VTEX ID.
 *
 * The auth directives already exchange the store token for the authenticated
 * user in order to authorize the request, so the answer is in hand before any
 * resolver runs. Stashing it here lets resolvers reuse it instead of paying a
 * second round trip. Keyed weakly by the request context, so entries disappear
 * with the request.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
const validatedStoreUserEmails = new WeakMap<object, string>()

export const setValidatedStoreUserEmail = (
  // eslint-disable-next-line @typescript-eslint/ban-types
  ctx: object,
  email?: string | null
) => {
  if (typeof email === 'string' && email.length > 0) {
    validatedStoreUserEmails.set(ctx, email)
  }
}

export const getValidatedStoreUserEmail = (
  // eslint-disable-next-line @typescript-eslint/ban-types
  ctx: object
): string | undefined => validatedStoreUserEmails.get(ctx)

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

/**
 * Whether the session is actively impersonating someone.
 *
 * `impersonate.canImpersonate` is a capability flag, not a state - a sales
 * representative carries it on every session, including their own. Only an
 * impersonated identity counts: `public.impersonate` (B2B, written by
 * storefront-permissions) or `impersonate.storeUserId` (telemarketing).
 */
const isImpersonating = (sessionData?: any): boolean => {
  const namespaces = sessionData?.namespaces

  return (
    !!nonEmpty(namespaces?.public?.impersonate?.value) ||
    !!nonEmpty(namespaces?.impersonate?.storeUserId?.value)
  )
}

/**
 * Last resort: ask VTEX ID who the store token belongs to.
 *
 * The token is never decoded locally. Its payload is attacker-controlled until
 * the signature is checked, and this email decides whose organizations are
 * returned - reading a claim out of an unverified token would let a caller name
 * any user they like. VTEX ID is the only thing that turns a token into an
 * identity here.
 *
 * In practice this rarely costs a request: the auth directive validated the
 * same token moments earlier and left the answer on the context.
 */
const resolveFromStoreToken = async (
  ctx: Context,
  timer?: Pick<Timer, 'track'>
): Promise<string | null> => {
  const stashed = nonEmpty(getValidatedStoreUserEmail(ctx))

  if (stashed) {
    return stashed
  }

  const {
    clients: { vtexId },
    vtex: { logger, storeUserAuthToken },
  } = ctx

  if (!storeUserAuthToken) {
    return null
  }

  try {
    const lookup = vtexId.getAuthenticatedUser(storeUserAuthToken)

    const authUser = await (timer
      ? timer.track('auth.getAuthenticatedUser', lookup)
      : lookup)

    const resolved = nonEmpty(authUser?.user)

    setValidatedStoreUserEmail(ctx, resolved)

    return resolved
  } catch (error) {
    logger.warn({
      error: describeClientError(error),
      message: 'resolveActingUserEmail.storeTokenError',
    })

    return null
  }
}

/**
 * Resolves which user a by-email query is about, trying every source the
 * request carries before giving up.
 *
 * The session is not one source but two, and neither is guaranteed: a session
 * token without private scope returns no `profile` namespace at all, which is
 * how a perfectly ordinary logged-in shopper ends up with no resolvable email.
 * The store token covers that gap, because it is scope-independent.
 *
 * Returns `email: null` rather than throwing so the caller decides what an
 * unidentifiable request means for it. What no caller should do is pass the
 * result downstream unchecked - `getOrganizationsByEmail(email: String!)`
 * rejects a missing variable before its resolver runs, which surfaces as an
 * INTERNAL_SERVER_ERROR in the neighbouring app rather than as a decision here.
 */
export const resolveActingUserEmail = async ({
  ctx,
  email,
  sessionData,
  timer,
}: {
  ctx: Context
  email?: string | null
  sessionData?: any
  timer?: Pick<Timer, 'track'>
}): Promise<ActingUserEmail> => {
  const fromArgument = nonEmpty(email)

  if (fromArgument) {
    return { email: fromArgument, source: 'argument' }
  }

  const namespaces = sessionData?.namespaces

  const fromProfile = nonEmpty(namespaces?.profile?.email?.value)

  if (fromProfile) {
    return { email: fromProfile, source: 'session-profile' }
  }

  const fromAuthentication = nonEmpty(
    namespaces?.authentication?.storeUserEmail?.value
  )

  if (fromAuthentication) {
    return { email: fromAuthentication, source: 'session-authentication' }
  }

  // The store token identifies whoever is *acting*, which during impersonation
  // is the operator and not the shopper the query is about. Answering with the
  // operator would quietly list the wrong person's organizations - worse than
  // failing, because it looks like an answer. Only the session can name an
  // impersonated shopper, and it already had its turn above.
  if (isImpersonating(sessionData)) {
    ctx.vtex.logger.warn({
      message: 'resolveActingUserEmail.impersonatedSessionWithoutEmail',
    })

    return { email: null, source: 'none' }
  }

  const fromStoreToken = await resolveFromStoreToken(ctx, timer)

  if (fromStoreToken) {
    return { email: fromStoreToken, source: 'store-token' }
  }

  return { email: null, source: 'none' }
}
