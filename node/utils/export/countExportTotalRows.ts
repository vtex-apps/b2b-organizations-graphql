import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_SCHEMA_VERSION,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_SCHEMA_VERSION,
} from '../../mdSchema'
import type { ExportType } from './constants'

interface CostCenterAddressScrollItem {
  addresses?: unknown[]
}

const countMasterDataTotal = async (
  ctx: Context,
  dataEntity: string,
  schema: string
) => {
  const result = await ctx.clients.masterdata.searchDocumentsWithPaginationInfo(
    {
      dataEntity,
      fields: ['id'],
      pagination: { page: 1, pageSize: 1 },
      schema,
    }
  )

  return result.pagination?.total ?? null
}

const countAddressesTotal = async (ctx: Context) => {
  let total = 0
  let token: string | undefined
  let hasMore = true

  while (hasMore) {
    const {
      mdToken,
      data,
    } = (await ctx.clients.masterdata.scrollDocuments({
      dataEntity: COST_CENTER_DATA_ENTITY,
      fields: ['addresses'],
      mdToken: token,
      schema: COST_CENTER_SCHEMA_VERSION,
      size: 100,
    })) as unknown as {
      mdToken?: string
      data: CostCenterAddressScrollItem[]
    }

    if (!data.length && token) {
      hasMore = false
    }

    if (!token && mdToken) {
      token = mdToken
    }

    data.forEach((costCenter) => {
      total += costCenter.addresses?.length ?? 0
    })

    if (!mdToken || !data.length) {
      hasMore = false
    }
  }

  return total || null
}

export const countExportTotalRows = async (
  exportType: ExportType,
  ctx: Context
): Promise<number | null> => {
  switch (exportType) {
    case 'organizations':
      return countMasterDataTotal(
        ctx,
        ORGANIZATION_DATA_ENTITY,
        ORGANIZATION_SCHEMA_VERSION
      )

    case 'cost_centers':
      return countMasterDataTotal(
        ctx,
        COST_CENTER_DATA_ENTITY,
        COST_CENTER_SCHEMA_VERSION
      )

    case 'members': {
      try {
        const result = await ctx.clients.storefrontPermissions.listUsersPaginated(
          {
            page: 1,
            pageSize: 1,
          }
        )

        const total = result?.data?.listUsersPaginated?.pagination?.total

        return total != null ? total : null
      } catch {
        return null
      }
    }

    case 'addresses':
      try {
        return await countAddressesTotal(ctx)
      } catch {
        return null
      }

    default:
      return null
  }
}
