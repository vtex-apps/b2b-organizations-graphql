export default class GraphQLError extends Error {
  public extensions: any

  constructor(message: string, details?: any) {
    super(message)
    this.extensions = { message, ...details }
  }
}

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
