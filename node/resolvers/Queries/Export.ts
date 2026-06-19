import type { BulkExportStatusResponse } from '../../clients/bulkExport'
import {
  buildExportDownloadUrl,
  EXPORT_STATUS,
  EXPORT_STATUS_GRAPHQL,
} from '../../utils/export/constants'
import { getExportMetadata } from '../../utils/export/ensureConvertedExport'
import {
  getCachedStatusSnapshot,
  saveStatusSnapshot,
  snapshotToStatusResponse,
} from '../../utils/export/exportStatusCache'

const getRequestHost = (ctx: Context) => {
  const forwardedHost = ctx.headers['x-forwarded-host'] as string | undefined

  return ctx.vtex.host || forwardedHost || `${ctx.vtex.account}.myvtex.com`
}

const toGraphQLInt = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(Number(value))) {
    return null
  }

  return Math.round(Number(value))
}

const parseNumericValue = (value: unknown) => {
  if (value == null || value === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isNaN(parsed) ? null : parsed
}

const resolveProgressPercentage = (
  statusResponse: {
    exportedRows?: number
    percentage?: number | string
    progressPercentage?: number
    totalRows?: number
  },
  storedTotalRows?: number | null
) => {
  const rawResponse = statusResponse as typeof statusResponse &
    Record<string, unknown>

  let progress =
    parseNumericValue(statusResponse.progressPercentage) ??
    parseNumericValue(statusResponse.percentage) ??
    parseNumericValue(rawResponse.ProgressPercentage) ??
    parseNumericValue(rawResponse.Percentage)

  if (progress != null && progress > 0 && progress <= 1) {
    progress = Math.round(progress * 100)
  } else if (progress != null) {
    progress = Math.round(progress)
  }

  const exportedRows = parseNumericValue(statusResponse.exportedRows)
  const totalRows =
    parseNumericValue(statusResponse.totalRows) ??
    parseNumericValue(rawResponse.TotalRows) ??
    parseNumericValue(rawResponse.totalExportedRows) ??
    parseNumericValue(rawResponse.TotalExportedRows) ??
    storedTotalRows ??
    null

  if (
    (progress == null || progress === 0) &&
    exportedRows != null &&
    totalRows != null &&
    totalRows > 0
  ) {
    progress = Math.round((exportedRows / totalRows) * 100)
  }

  if (
    progress == null ||
    (progress === 0 && exportedRows != null && exportedRows > 0)
  ) {
    return null
  }

  return Math.min(100, Math.max(0, progress))
}

const Export = {
  exportStatus: async (
    _: void,
    { exportId }: { exportId: string },
    ctx: Context
  ) => {
    const {
      clients: { bulkExport },
      vtex: { logger },
    } = ctx

    const metadata = await getExportMetadata(ctx, exportId)
    let statusResponse: BulkExportStatusResponse

    try {
      statusResponse = await bulkExport.getExportStatus(exportId)
    } catch (error) {
      const snapshot = getCachedStatusSnapshot(ctx, exportId, metadata)

      if (snapshot) {
        logger.warn({
          error,
          exportId,
          message: 'exportStatus.usingCachedSnapshot',
        })
        statusResponse = snapshotToStatusResponse(exportId, snapshot)
      } else {
        throw error
      }
    }

    await saveStatusSnapshot(ctx, exportId, statusResponse, metadata)

    const mappedStatus =
      EXPORT_STATUS_GRAPHQL[
        statusResponse.status as keyof typeof EXPORT_STATUS_GRAPHQL
      ] ?? 'FAILED'

    const result = {
      exportId: statusResponse.exportId ?? exportId,
      exportedRows: toGraphQLInt(statusResponse.exportedRows),
      lastUpdate: statusResponse.lastUpdate ?? null,
      linkToFile: null as string | null,
      progressPercentage: resolveProgressPercentage(
        statusResponse,
        metadata?.totalRows
      ),
      startDate: statusResponse.startDate ?? null,
      status: mappedStatus,
    }

    if (statusResponse.status !== EXPORT_STATUS.COMPLETED) {
      return result
    }

    if (!metadata?.exportType) {
      logger.warn({
        exportId,
        message: 'exportStatus.missingExportType',
      })

      return result
    }

    if (!statusResponse.linkToFile) {
      logger.warn({
        exportId,
        message: 'exportStatus.missingLinkToFile',
      })

      return result
    }

    result.linkToFile = buildExportDownloadUrl(getRequestHost(ctx), exportId)

    return result
  },
}

export default Export
