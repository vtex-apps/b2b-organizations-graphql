export function transformOperation(operation: string, statusCode?: number) {
  const snakeCase = operation
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();

  const baseName = operation
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');

  const entityNameFirstLetter =
    operation.charAt(0).toUpperCase() + operation.slice(1);

  let subjectId = `${baseName}-unknown-error-event`;
  let operationName = `${snakeCase}-UNKNOWN_ERROR`;

  if (statusCode === 401) {
    subjectId = `${baseName}-unauthorized-error-event`;
    operationName = `${snakeCase}-UNAUTHORIZED_ERROR`;
  }

  if (statusCode === 403) {
    subjectId = `${baseName}-forbidden-error-event`;
    operationName = `${snakeCase}-FORBIDDEN_ERROR`;
  }

  return {
    subjectId,
    operation: operationName,
    entityNameFirstLetter,
  };
}
