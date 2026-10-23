/**
 * Names sent in a mutation input that matched nothing (B2BTEAM-3986, SDD §5).
 *
 * `createOrganization` / `updateOrganization` resolve payment terms, sellers
 * and collections by exact name and silently drop the ones that do not match.
 * The mutation still succeeds, so this is a `warn`: it lets support explain
 * why a payment term, seller or collection is missing from an organization.
 * Names are catalog/payment configuration, not PII (SDD Q8).
 */
export type UnmatchedNamesKey =
  | 'findPaymentTerms.unmatched'
  | 'findSellers.unmatched'
  | 'findCollections.unmatched'

interface UnmatchedNamesParams {
  operation: string
  entity: 'PaymentTerm' | 'Seller' | 'Collection'
  unmatchedNames: string[]
}

export const logUnmatchedNames = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger: any,
  message: UnmatchedNamesKey,
  { operation, entity, unmatchedNames }: UnmatchedNamesParams
) => {
  const unique = Array.from(new Set(unmatchedNames))

  if (!unique.length) {
    return
  }

  logger.warn({
    message,
    operation,
    entity,
    unmatchedNames: unique,
    unmatchedCount: unique.length,
  })
}
