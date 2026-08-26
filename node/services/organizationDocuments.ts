/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
  COST_CENTER_SUMMARY_FIELDS,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  ORGANIZATION_SUMMARY_FIELDS,
} from '../mdSchema'
import { describeClientError } from '../utils/clientError'
import {
  getCachedCostCenter,
  getCachedCostCenterSummary,
  getCachedOrganization,
  getCachedOrganizationSummary,
} from './organizationsCache'

const ORGANIZATION_STATE_KEY = 'organizationsById'
const COST_CENTER_STATE_KEY = 'costCentersById'
const ORGANIZATION_SUMMARY_STATE_KEY = 'organizationSummariesById'
const COST_CENTER_SUMMARY_STATE_KEY = 'costCenterSummariesById'

const getStateMap = (ctx: Context, key: string): Map<string, any> => {
  const state = ctx.state as Record<string, any>

  if (!state[key]) {
    state[key] = new Map<string, any>()
  }

  return state[key] as Map<string, any>
}

const fetchOrganizationDocument = (ctx: Context, orgId: string) => {
  const {
    clients: { masterDataExtended },
    vtex: { logger },
  } = ctx

  return getCachedOrganization(ctx, orgId, () =>
    masterDataExtended
      .getDocumentById(ORGANIZATION_DATA_ENTITY, orgId, ORGANIZATION_FIELDS)
      .then((document: any) => {
        if (!document) {
          const notFound: any = new Error('organizationNotFound')

          notFound.organizationNotFound = true
          throw notFound
        }

        return document
      })
      .catch((error: any) => {
        if (!error?.organizationNotFound) {
          logger.error({
            error: describeClientError(error),
            message: 'fetchOrganizationDocument-error',
          })
        }

        throw error
      })
  )
}

const fetchCostCenterDocument = (ctx: Context, costId: string) => {
  const {
    clients: { masterDataExtended },
    vtex: { logger },
  } = ctx

  return getCachedCostCenter(ctx, costId, () =>
    masterDataExtended
      .getDocumentById(COST_CENTER_DATA_ENTITY, costId, COST_CENTER_FIELDS)
      .then((document: any) => {
        if (!document) {
          const notFound: any = new Error('costCenterNotFound')

          notFound.costCenterNotFound = true
          throw notFound
        }

        return document
      })
      .catch((error: any) => {
        if (!error?.costCenterNotFound) {
          logger.error({
            error: describeClientError(error),
            message: 'fetchCostCenterDocument-error',
          })
        }

        throw error
      })
  )
}

/** Full organization document (GET-by-id hot path). */
export const loadOrganization = async (
  ctx: Context,
  orgId: string
): Promise<any> => {
  const byId = getStateMap(ctx, ORGANIZATION_STATE_KEY)

  if (byId.has(orgId)) {
    return byId.get(orgId)
  }

  const organization = await fetchOrganizationDocument(ctx, orgId)

  byId.set(orgId, organization)

  return organization
}

export const loadCostCenter = async (
  ctx: Context,
  costId: string
): Promise<any> => {
  const byId = getStateMap(ctx, COST_CENTER_STATE_KEY)

  if (byId.has(costId)) {
    return byId.get(costId)
  }

  const costCenter = await fetchCostCenterDocument(ctx, costId)

  byId.set(costId, costCenter)

  return costCenter
}

/** Slim org (id/name/status) for list/selector field resolvers. */
export const loadOrganizationSummary = async (
  ctx: Context,
  orgId: string
): Promise<any> => {
  const full = getStateMap(ctx, ORGANIZATION_STATE_KEY)

  if (full.has(orgId)) {
    return full.get(orgId)
  }

  const summaries = getStateMap(ctx, ORGANIZATION_SUMMARY_STATE_KEY)

  if (summaries.has(orgId)) {
    return summaries.get(orgId)
  }

  const summary = await getCachedOrganizationSummary(ctx, orgId, () =>
    ctx.clients.masterDataExtended
      .getDocumentById(
        ORGANIZATION_DATA_ENTITY,
        orgId,
        ORGANIZATION_SUMMARY_FIELDS
      )
      .then((document: any) => {
        if (!document) {
          const notFound: any = new Error('organizationNotFound')

          notFound.organizationNotFound = true
          throw notFound
        }

        return document
      })
  )

  summaries.set(orgId, summary)

  return summary
}

export const loadCostCenterSummary = async (
  ctx: Context,
  costId: string
): Promise<any> => {
  const full = getStateMap(ctx, COST_CENTER_STATE_KEY)

  if (full.has(costId)) {
    return full.get(costId)
  }

  const summaries = getStateMap(ctx, COST_CENTER_SUMMARY_STATE_KEY)

  if (summaries.has(costId)) {
    return summaries.get(costId)
  }

  const summary = await getCachedCostCenterSummary(ctx, costId, () =>
    ctx.clients.masterDataExtended
      .getDocumentById(
        COST_CENTER_DATA_ENTITY,
        costId,
        COST_CENTER_SUMMARY_FIELDS
      )
      .then((document: any) => {
        if (!document) {
          const notFound: any = new Error('costCenterNotFound')

          notFound.costCenterNotFound = true
          throw notFound
        }

        return document
      })
  )

  summaries.set(costId, summary)

  return summary
}

export const getOrganizationStatusFromState = (
  ctx: Context,
  orgId: string
): string | undefined => {
  const full = getStateMap(ctx, ORGANIZATION_STATE_KEY).get(orgId)
  const summary = getStateMap(ctx, ORGANIZATION_SUMMARY_STATE_KEY).get(orgId)

  return full?.status ?? summary?.status
}

/**
 * Resolve summaries from memory cache first; batch-search Master Data for the
 * remainder (one search per chunk instead of N GET-by-id on a cold pod).
 */
const hydrateSummaryBatch = async (params: {
  ctx: Context
  ids: string[]
  dataEntity: string
  fields: string[]
  stateKey: string
  getCached: (
    ctx: Context,
    id: string,
    fetcher: () => Promise<any>
  ) => Promise<any>
}) => {
  const { ctx, ids, dataEntity, fields, stateKey, getCached } = params
  const byId = getStateMap(ctx, stateKey)
  const missingFromState = ids.filter((id) => !byId.has(id))

  if (missingFromState.length === 0) {
    return
  }

  const needOrigin: string[] = []

  await Promise.all(
    missingFromState.map(async (id) => {
      try {
        const cached = await getCached(ctx, id, async () => {
          const miss: any = new Error('summaryCacheMiss')

          miss.summaryCacheMiss = true
          throw miss
        })

        byId.set(id, cached)
      } catch (error) {
        if (error?.summaryCacheMiss) {
          needOrigin.push(id)

          return
        }

        // Real origin/cache errors: leave the id unresolved; field resolvers retry.
        ctx.vtex.logger.error({
          error: describeClientError(error),
          message: 'hydrateSummaryBatch-cacheError',
        })
      }
    })
  )

  if (needOrigin.length === 0) {
    return
  }

  try {
    const docs = await ctx.clients.masterDataExtended.getDocumentsByIds<any>({
      dataEntity,
      fields,
      ids: needOrigin,
    })

    for (const doc of docs) {
      if (!doc?.id) {
        continue
      }

      byId.set(doc.id, doc)
    }

    await Promise.all(
      docs
        .filter((doc) => doc?.id)
        .map((doc) => getCached(ctx, doc.id, async () => doc))
    )
  } catch (error) {
    ctx.vtex.logger.error({
      error: describeClientError(error),
      message: 'hydrateSummaryBatch-searchError',
    })

    // Fall back to per-id GET so a search failure does not blank the list.
    await Promise.all(
      needOrigin.map((id) =>
        getCached(ctx, id, () =>
          ctx.clients.masterDataExtended.getDocumentById(dataEntity, id, fields)
        )
          .then((doc) => {
            if (doc) {
              byId.set(id, doc)
            }
          })
          .catch(() => undefined)
      )
    )
  }
}

export interface HydrateOrganizationsOptions {
  /** Default true. Set false after filtering active orgs to skip inactive CCs. */
  costCenters?: boolean
  /** Default true. */
  organizations?: boolean
}

/**
 * Prefetch unique org/CC summaries for list rows. Uses slim `_fields` and
 * batched Master Data search on cache miss.
 */
export const hydrateOrganizationsByEmail = async (
  ctx: Context,
  rows: Array<{ orgId?: string; costId?: string }>,
  options: HydrateOrganizationsOptions = {}
): Promise<void> => {
  const loadOrganizations = options.organizations !== false
  const loadCostCenters = options.costCenters !== false

  const orgIds = loadOrganizations
    ? [
        ...new Set(
          rows
            .map((row) => row?.orgId)
            .filter((id): id is string => Boolean(id))
        ),
      ]
    : []

  const costIds = loadCostCenters
    ? [
        ...new Set(
          rows
            .map((row) => row?.costId)
            .filter((id): id is string => Boolean(id))
        ),
      ]
    : []

  await Promise.all([
    hydrateSummaryBatch({
      ctx,
      ids: orgIds,
      dataEntity: ORGANIZATION_DATA_ENTITY,
      fields: ORGANIZATION_SUMMARY_FIELDS,
      stateKey: ORGANIZATION_SUMMARY_STATE_KEY,
      getCached: getCachedOrganizationSummary,
    }),
    hydrateSummaryBatch({
      ctx,
      ids: costIds,
      dataEntity: COST_CENTER_DATA_ENTITY,
      fields: COST_CENTER_SUMMARY_FIELDS,
      stateKey: COST_CENTER_SUMMARY_STATE_KEY,
      getCached: getCachedCostCenterSummary,
    }),
  ])
}
