/**
 * Mutation-side audit for idempotent writes (updates, deletes, save*): await
 * the outbound call and fail the mutation on error (SDD Q5 / B2BTEAM-3982).
 * A client retry after an audit failure re-applies the same state, so failing
 * closed is safe. Queries must keep using fire-and-forget sendEvent.
 */
export const sendMutationAudit = async (
  ctx: Context,
  auditEntry: AuditEntry
): Promise<void> => {
  await ctx.clients.audit.sendEventStrict(auditEntry)
}

/**
 * Mutation-side audit for non-idempotent writes (creates, addUser,
 * createUserWithEmail, impersonate*, request approval). The write already
 * happened, so failing the mutation on an audit error would invite a client
 * retry that duplicates the record. The event is dispatched detached and a
 * failure is logged as `audit.sendEventError` (by sendEventStrict) without
 * affecting the mutation's result.
 */
export const sendMutationAuditFireAndForget = (
  ctx: Context,
  auditEntry: AuditEntry
): void => {
  Promise.resolve()
    .then(() => ctx.clients.audit.sendEventStrict(auditEntry))
    .catch(() => {
      // Already logged as audit.sendEventError inside sendEventStrict.
    })
}
