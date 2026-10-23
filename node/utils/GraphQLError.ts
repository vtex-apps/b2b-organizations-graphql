export default class GraphQLError extends Error {
  public extensions: any

  constructor(message: string, details?: any) {
    super(message)
    this.extensions = { message, ...details }
  }
}

/**
 * Marks an error with the log level the @vtex/api GraphQL error middleware
 * should use when it logs the error again. The middleware only honors
 * `extensions.exception.level` ('warn' | 'error'), which it builds from the
 * error's own enumerable fields. Use it for expected outcomes (e.g. not found)
 * that are already logged as structured warns, so they are not re-logged as
 * errors. Message and code are unchanged.
 */
export const withLogLevel = <T extends Error>(
  error: T,
  level: 'warn' | 'error'
): T & { level: 'warn' | 'error' } => Object.assign(error, { level })

export const getErrorMessage = (e: any) => {
  const responseData = e.response?.data

  if (typeof responseData === 'string') {
    return responseData
  }

  if (responseData?.message) {
    return responseData.message
  }

  if (responseData?.Message) {
    return responseData.Message
  }

  if (Array.isArray(responseData) && responseData[0]?.Message) {
    return responseData[0].Message
  }

  return e.message ?? e
}
