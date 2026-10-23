/**
 * Helpers for classifying client/Master Data failures without treating
 * infrastructure errors as "document does not exist".
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getHttpStatus = (error: any): number | undefined => {
  const status = error?.response?.status ?? error?.extensions?.status

  return typeof status === 'number' ? status : undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isNotFoundError = (error: any): boolean => {
  if (error?.costCenterNotFound || error?.organizationNotFound) {
    return true
  }

  return getHttpStatus(error) === 404
}
