/* eslint-disable @typescript-eslint/no-explicit-any */
import { describeClientError } from './clientError'

/**
 * GraphQL validation errors are caused by the caller's request (e.g. a
 * required variable missing), not by storefront-permissions being unhealthy.
 */
const CLIENT_VALIDATION_PATTERNS = [
  /^Variable "\$[^"]+" .*(was not provided|got invalid value|must not be null)/,
  /^Cannot query field/,
  /^Unknown argument/,
  /^Syntax Error/,
  /^Field "[^"]+" argument "[^"]+" of type .* is required/,
]

/**
 * Authentication/permission outcomes: the caller has no session or lacks the
 * permission (e.g. checkUserPermission from an admin token without storefront
 * session). storefront-permissions itself logs these as warn.
 */
const AUTH_DENIED_PATTERNS = [
  /^User not authenticated/i,
  /^(Access|Permission) denied/i,
  /^Forbidden\b/i,
  /operation-not-permitted/i,
  /^(User|Operation) not (allowed|authorized|permitted)/i,
]

type LogLevel = 'warn' | 'error'

const redactEmails = (value: string) =>
  value.replace(
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    '<redacted-email>'
  )

export const getGraphQLErrorMessages = (error: any): string[] => {
  const errors = error?.graphQLErrors ?? error?.response?.data?.errors

  if (!Array.isArray(errors)) {
    return []
  }

  return errors
    .map((e: any) => (typeof e?.message === 'string' ? e.message : null))
    .filter((m: string | null): m is string => !!m)
    .map(redactEmails)
}

const getRawGraphQLErrors = (error: any): any[] => {
  const errors = error?.graphQLErrors ?? error?.response?.data?.errors

  return Array.isArray(errors) ? errors : []
}

const asLevel = (value: unknown): LogLevel | null =>
  value === 'warn' || value === 'error' ? value : null

/**
 * Level storefront-permissions attached to its own GraphQL error. Its
 * GraphQLError sets `extensions.exception.level` (the field @vtex/api honors)
 * from `extensions.logLevel`; accept either.
 */
export const getUpstreamLevel = (graphQLError: any): LogLevel | null =>
  asLevel(graphQLError?.extensions?.exception?.level) ??
  asLevel(graphQLError?.extensions?.logLevel) ??
  asLevel(graphQLError?.extensions?.level)

const isAuthDeniedMessage = (message: string) =>
  AUTH_DENIED_PATTERNS.some((p) => p.test(message))

const isClientValidationMessage = (message: string) =>
  CLIENT_VALIDATION_PATTERNS.some((p) => p.test(message))

export const isAuthDeniedError = (error: any): boolean => {
  const messages = getGraphQLErrorMessages(error)

  return messages.length > 0 && messages.every(isAuthDeniedMessage)
}

/**
 * warn when every GraphQL error is an expected outcome: the upstream marked
 * it as warn, or it is a client validation / authentication error. An
 * explicit upstream 'error' always wins. Anything else (HTTP failures,
 * resolver errors) is error.
 */
export const getStorefrontPermissionsLogLevel = (error: any): LogLevel => {
  const errors = getRawGraphQLErrors(error)

  if (errors.length === 0) {
    return 'error'
  }

  const isExpected = (e: any) => {
    const upstream = getUpstreamLevel(e)

    if (upstream) {
      return upstream === 'warn'
    }

    const message = typeof e?.message === 'string' ? e.message : ''

    return isClientValidationMessage(message) || isAuthDeniedMessage(message)
  }

  return errors.every(isExpected) ? 'warn' : 'error'
}

export const isClientValidationError = (error: any): boolean => {
  const messages = getGraphQLErrorMessages(error)

  return messages.length > 0 && messages.every(isClientValidationMessage)
}

/** First selected field of a GraphQL document, used as the operation name. */
export const getOperationName = (document: string): string => {
  const match = /\{\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(document ?? '')

  return match?.[1] ?? 'unknown'
}

export const logStorefrontPermissionsError = (
  logger: { error: (d: any) => void; warn: (d: any) => void },
  operation: string,
  error: any
) => {
  const payload = {
    error: describeClientError(error),
    graphQLErrors: getGraphQLErrorMessages(error),
    message: 'storefrontPermissions.queryError',
    operation,
  }

  if (getStorefrontPermissionsLogLevel(error) === 'warn') {
    logger.warn(payload)
  } else {
    logger.error(payload)
  }
}
