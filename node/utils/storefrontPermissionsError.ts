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

export const isClientValidationError = (error: any): boolean => {
  const messages = getGraphQLErrorMessages(error)

  return (
    messages.length > 0 &&
    messages.every((m) => CLIENT_VALIDATION_PATTERNS.some((p) => p.test(m)))
  )
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

  if (isClientValidationError(error)) {
    logger.warn(payload)
  } else {
    logger.error(payload)
  }
}
