export const ORGANIZATION_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_HOLD: 'on-hold',
  SUCCESS: 'success',
}

export const ORGANIZATION_REQUEST_STATUSES = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  PENDING: 'pending',
}

export const MARKETING_TAGS = {
  VBASE_BUCKET: 'b2b_marketing_tags',
}

/**
 * Application cache for hot GraphQL reads. Two rules of thumb:
 * - Add the cross-pod VBase layer only when the origin is expensive (Master
 *   Data, another app's GraphQL). For data that already lives in VBase, an
 *   in-memory layer is the only thing that helps.
 * - Keep the TTL short for anything an operator flips (org status, settings).
 */
export const VBASE_CACHE_BUCKET = 'b2b-orgs-cache'

/**
 * Organization and cost center data is admin-edited. TTLs are kept to a minute
 * because deactivating an organization should take effect quickly.
 *
 * This app is not the only cache in front of that data. `storefront-permissions`
 * keeps its own two-layer cache of the same organization documents with these
 * same numbers (`getCachedOrganization` in its `setProfile` path), and it reads
 * Master Data directly rather than through this app - so the two are siblings
 * over one origin, not a chain, and their windows do not add up. A status change
 * reaches each app within that app's own window.
 *
 * `status` is what drives the inactive-organization path in SFP's `setProfile`,
 * so tuning these here only fixes half the staleness a shopper can observe: the
 * mirrored constants on the other side have to move too.
 */
export const ORGANIZATION_CACHE_TTL_IN_MS = 60 * 1000
export const ORGANIZATION_CACHE_TTL_IN_MINUTES = 2

/**
 * Cost center documents were measured between roughly 400B and 29KB, so this
 * cache is bounded by bytes instead of by entry count.
 */
export const COST_CENTER_CACHE_MAX_SIZE_BYTES = 8 * 1024 * 1024

/** Schema/template sync flag — memory only (settings already live in VBase). */
export const CHECK_CONFIG_CACHE_TTL_IN_MS = 5 * 60 * 1000

/** B2B settings already live in VBase (`b2b_settings`); memory-only is enough. */
export const B2B_SETTINGS_CACHE_TTL_IN_MS = 5 * 60 * 1000

/** How often a hot Query may emit one `cacheStats` info line per pod. */
export const CACHE_STATS_INTERVAL_MS = 5 * 60 * 1000
