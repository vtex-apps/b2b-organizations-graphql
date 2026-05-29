import { Readable } from 'stream'

import type { ExportMetadata, ExportType } from '../../utils/export/constants'
import {
  buildExportDownloadUrl,
  EXPORT_STATUS,
  EXPORT_STATUS_GRAPHQL,
  EXPORT_VBASE_BUCKET,
  getExportFilePath,
} from '../../utils/export/constants'
import { convertXlsxToCsv } from '../../utils/export/csvConverter'

const getRequestHost = (ctx: Context) => {
  const forwardedHost = ctx.headers['x-forwarded-host'] as string | undefined

  return ctx.vtex.host || forwardedHost || `${ctx.vtex.account}.myvtex.com`
}

const getExportMetadata = async (ctx: Context, exportId: string) => {
  try {
    return await ctx.clients.vbase.getJSON<ExportMetadata>(
      EXPORT_VBASE_BUCKET,
      exportId
    )
  } catch (error) {
    const { data } = (error as any).response ?? {}

    if (data?.code === 'FileNotFound') {
      return null
    }

    throw error
  }
}

const hasConvertedFile = (metadata: ExportMetadata | null) =>
  Boolean(metadata?.convertedAt && metadata?.filename)

const storeConvertedExport = async (
  ctx: Context,
  exportId: string,
  exportType: ExportType,
  csvBuffer: Buffer,
  filename: string
) => {
  const filePath = getExportFilePath(exportId)
  const metadata: ExportMetadata = {
    convertedAt: new Date().toISOString(),
    exportId,
    exportType,
    filename,
  }

  await ctx.clients.vbase.saveFile(
    EXPORT_VBASE_BUCKET,
    filePath,
    Readable.from(csvBuffer),
    true
  )
  await ctx.clients.vbase.saveJSON(EXPORT_VBASE_BUCKET, exportId, metadata)

  return metadata
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

    const statusResponse = await bulkExport.getExportStatus(exportId)
    const mappedStatus =
      EXPORT_STATUS_GRAPHQL[
        statusResponse.status as keyof typeof EXPORT_STATUS_GRAPHQL
      ] ?? 'FAILED'

    const result = {
      exportId: statusResponse.exportId ?? exportId,
      exportedRows: statusResponse.exportedRows ?? null,
      lastUpdate: statusResponse.lastUpdate ?? null,
      linkToFile: null as string | null,
      progressPercentage: statusResponse.progressPercentage ?? null,
      startDate: statusResponse.startDate ?? null,
      status: mappedStatus,
    }

    if (statusResponse.status !== EXPORT_STATUS.COMPLETED) {
      return result
    }

    const metadata = await getExportMetadata(ctx, exportId)

    if (hasConvertedFile(metadata)) {
      result.linkToFile = buildExportDownloadUrl(
        getRequestHost(ctx),
        exportId
      )

      return result
    }

    if (!statusResponse.linkToFile) {
      logger.warn({
        exportId,
        message: 'exportStatus.missingLinkToFile',
      })

      return result
    }

    if (!metadata?.exportType) {
      logger.warn({
        exportId,
        message: 'exportStatus.missingExportType',
      })

      return result
    }

    const xlsxBuffer = await bulkExport.downloadFile(statusResponse.linkToFile)
    const { buffer, filename } = await convertXlsxToCsv(
      xlsxBuffer,
      metadata.exportType
    )

    await storeConvertedExport(
      ctx,
      exportId,
      metadata.exportType,
      buffer,
      filename
    )

    result.linkToFile = buildExportDownloadUrl(getRequestHost(ctx), exportId)

    logger.info({
      exportId,
      filename,
      message: 'exportStatus.converted',
    })

    return result
  },
}

export default Export
