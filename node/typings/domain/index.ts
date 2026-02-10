type AuditEntry = {
  subjectId: string
  operation: string
  authorId?: string
  meta: {
    entityName: string
    remoteIpAddress: string
    entityBeforeAction: string
    entityAfterAction: string
  }
}
