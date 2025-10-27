import { transformOperation } from "./transformOperation";

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

  if (statusCode === 401 || statusCode === 403) {
    await audit.sendEvent({
      subjectId,
      operation,
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
