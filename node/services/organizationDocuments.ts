/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
} from '../mdSchema'
import { describeClientError } from '../utils/clientError'
import {
  getCachedCostCenter,
  getCachedOrganization,
} from './organizationsCache'

const ORGANIZATION_STATE_KEY = 'organizationsById'
const COST_CENTER_STATE_KEY = 'costCentersById'

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

/**
 * Load an organization via the application cache, and stash it on `ctx.state`
 * so field resolvers in the same request do not issue a duplicate GET.
 */
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

/**
 * Prefetch unique org/CC documents for a list of user-org rows so GraphQL
 * field resolvers (`organizationName`, `organizationStatus`, `costCenterName`)
 * hit `ctx.state` / the application cache instead of N+1 Master Data GETs.
 */
export const hydrateOrganizationsByEmail = async (
  ctx: Context,
  rows: Array<{ orgId?: string; costId?: string }>
): Promise<void> => {
  const orgIds = [
    ...new Set(
      rows.map((row) => row?.orgId).filter((id): id is string => Boolean(id))
    ),
  ]

  const costIds = [
    ...new Set(
      rows.map((row) => row?.costId).filter((id): id is string => Boolean(id))
    ),
  ]

  await Promise.all([
    ...orgIds.map((orgId) =>
      loadOrganization(ctx, orgId).catch(() => undefined)
    ),
    ...costIds.map((costId) =>
      loadCostCenter(ctx, costId).catch(() => undefined)
    ),
  ])
}
