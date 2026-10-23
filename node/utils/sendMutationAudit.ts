/**
 * Mutation-side audit: await the outbound call and fail the mutation on error
 * (SDD Q5 / B2BTEAM-3982). Queries must keep using fire-and-forget sendEvent.
 */
export const sendMutationAudit = async (
  ctx: Context,
  auditEntry: AuditEntry
): Promise<void> => {
  await ctx.clients.audit.sendEventStrict(auditEntry)
}
