/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  B2B_SETTINGS_CACHE_TTL_IN_MS,
  CHECK_CONFIG_CACHE_TTL_IN_MS,
  COST_CENTER_CACHE_MAX_SIZE_BYTES,
  ORGANIZATION_CACHE_TTL_IN_MINUTES,
  ORGANIZATION_CACHE_TTL_IN_MS,
} from '../utils/constants'
import { createCachedResource } from './cache'

/**
 * These are Master Data lookups on the GraphQL hot path (and B2B settings from
 * VBase). Warm pods do no I/O; cold pods read the entry a sibling already
 * populated in VBase (org/CC only) instead of paying the origin cost again.
 */
const cachedOrganization = createCachedResource<any>('organization', {
  maxEntries: 10000,
  memoryTtlMs: ORGANIZATION_CACHE_TTL_IN_MS,
  vbaseTtlMinutes: ORGANIZATION_CACHE_TTL_IN_MINUTES,
})

// Cost centers carry their addresses, so a single document can be far larger
// than the rest. Bounded by bytes so the footprint cannot swing with the data.
const cachedCostCenter = createCachedResource<any>('cost-center', {
  maxSizeBytes: COST_CENTER_CACHE_MAX_SIZE_BYTES,
  memoryTtlMs: ORGANIZATION_CACHE_TTL_IN_MS,
  vbaseTtlMinutes: ORGANIZATION_CACHE_TTL_IN_MINUTES,
})

// Slim documents for list/selector field resolvers (name/status). Kept separate
// from the full-document caches so a summary never shadows a full GET-by-id.
const cachedOrganizationSummary = createCachedResource<any>(
  'organization-summary',
  {
    maxEntries: 10000,
    memoryTtlMs: ORGANIZATION_CACHE_TTL_IN_MS,
    vbaseTtlMinutes: ORGANIZATION_CACHE_TTL_IN_MINUTES,
  }
)

const cachedCostCenterSummary = createCachedResource<any>(
  'cost-center-summary',
  {
    maxEntries: 10000,
    memoryTtlMs: ORGANIZATION_CACHE_TTL_IN_MS,
    vbaseTtlMinutes: ORGANIZATION_CACHE_TTL_IN_MINUTES,
  }
)

const cachedCheckConfig = createCachedResource<any>('check-config', {
  maxEntries: 100,
  memoryTtlMs: CHECK_CONFIG_CACHE_TTL_IN_MS,
})

const cachedB2BSettings = createCachedResource<any>('b2b-settings', {
  maxEntries: 100,
  memoryTtlMs: B2B_SETTINGS_CACHE_TTL_IN_MS,
})

export const getCachedOrganization = async (
  ctx: Context,
  orgId: string,
  fetcher: () => Promise<any>
): Promise<any> => cachedOrganization(ctx, orgId, fetcher)

export const getCachedCostCenter = async (
  ctx: Context,
  costId: string,
  fetcher: () => Promise<any>
): Promise<any> => cachedCostCenter(ctx, costId, fetcher)

export const getCachedOrganizationSummary = async (
  ctx: Context,
  orgId: string,
  fetcher: () => Promise<any>
): Promise<any> => cachedOrganizationSummary(ctx, orgId, fetcher)

export const getCachedCostCenterSummary = async (
  ctx: Context,
  costId: string,
  fetcher: () => Promise<any>
): Promise<any> => cachedCostCenterSummary(ctx, costId, fetcher)

export const getCachedCheckConfig = async (
  ctx: Context,
  fetcher: () => Promise<any>
): Promise<any> => cachedCheckConfig(ctx, 'synced', fetcher)

export const getCachedB2BSettings = async (
  ctx: Context,
  fetcher: () => Promise<any>
): Promise<any> => cachedB2BSettings(ctx, 'settings', fetcher)
