/**
 * Which storefront app, and which named query, produced this request.
 *
 * Several distinct partner-side failures land on the same resolver, so a
 * denial event that does not say who asked cannot be attributed. The two
 * checkout errors under investigation - "Failed to fetch cost center
 * addresses" and "Failed to fetch ship-to accounts" - both reach
 * `getCostCenterByIdStorefront`, and the partner app discards the GraphQL
 * error before logging, so from our side they are indistinguishable without
 * this.
 *
 * `operationId` is not an option: it does not survive the hop into
 * storefront-permissions, and at this volume log sampling makes timestamp
 * proximity meaningless.
 *
 * Both fields are best-effort and may be null - an anonymous query carries no
 * operation name, and the sender header is only set by callers that bother to.
 * Null is reported as null rather than guessed at, so the data says which.
 */
export interface CallerDescription {
  /** The app that issued the query, if it identified itself. */
  callerApp: string | null
  /** The GraphQL operation name the caller declared, if any. */
  operationName: string | null
}

const nonEmpty = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

export const describeCaller = (ctx: Context): CallerDescription => {
  const anyCtx = ctx as any

  /**
   * Same resolution order the `withPermissions` directive already uses, so a
   * caller that identifies itself to one surface identifies itself to both.
   */
  const callerApp =
    nonEmpty(anyCtx?.graphql?.query?.senderApp) ??
    nonEmpty(anyCtx?.graphql?.query?.extensions?.persistedQuery?.sender) ??
    nonEmpty(anyCtx?.request?.header?.['x-b2b-senderapp']) ??
    nonEmpty(anyCtx?.request?.header?.['x-vtex-caller'])

  return {
    callerApp,
    operationName: nonEmpty(anyCtx?.graphql?.query?.operationName),
  }
}
