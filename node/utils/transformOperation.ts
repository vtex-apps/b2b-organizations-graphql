export function transformOperation(operation: string, statusCode?: number) {
  const withoutPrefix = operation.replace(
    /^(get|post|put|patch|delete|create|update|list|fetch|Get|Post|Put|Patch|Delete|Create|Update|List|Fetch)/i,
    ''
  )

  const snakeCase: string = withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()

  const baseName: string = withoutPrefix
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')

  const entityNameFirstLetter: string =
    withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1)

  let subjectId = `${baseName}-unknown-error-event`
  let operationName = `${snakeCase}-UNKNOWN_ERROR`

  if (statusCode === 401) {
    subjectId = `${baseName}-unauthorized-error-event`
    operationName = `${snakeCase}-UNAUTHORIZED_ERROR`
  }

  if (statusCode === 403) {
    subjectId = `${baseName}-forbidden-error-event`
    operationName = `${snakeCase}-FORBIDDEN_ERROR`
  }

  return {
    subjectId,
    operation: operationName,
    entityNameFirstLetter,
  }
}
