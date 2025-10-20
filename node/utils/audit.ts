import { transformOperation } from "./metrics/transformOperation";

const audit = async (
  ctx: Context,
  operationName: string,
  statusCode?: number,
) => {
  const {
    clients: { audit },
    ip,
  } = ctx

  const { subjectId, operation, entityNameFirstLetter } = transformOperation(operationName, statusCode);

  if (statusCode === 403) {
    await audit.sendEvent({
      subjectId: subjectId,
      operation: operation,
      authorId: "unknown",
      meta: {
        entityName: entityNameFirstLetter,
        remoteIpAddress: ip,
        entityBeforeAction: JSON.stringify({}),
        entityAfterAction: JSON.stringify({}),
      },
    })
  } else if (statusCode === 401) {
    await audit.sendEvent({
      subjectId: subjectId,
      operation: operation,
      authorId: "unknown",
      meta: {
        entityName: entityNameFirstLetter,
        remoteIpAddress: ip,
        entityBeforeAction: JSON.stringify({}),
        entityAfterAction: JSON.stringify({}),
      },
    })
  }
}

export default audit
