import { Readable } from 'stream'

import { UserInputError } from '@vtex/api'

import type { ExportMetadata, ExportType } from './constants'
import {
  EXPORT_CSV_VBASE_TTL_SECONDS,
  EXPORT_STATUS,
  EXPORT_VBASE_BUCKET,
  getExportFilePath,
} from './constants'
import { convertXlsxToCsv } from './csvConverter'

export const getExportMetadata = async (ctx: Context, exportId: string) => {
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

export const hasConvertedFile = (metadata: ExportMetadata | null) =>
  Boolean(metadata?.convertedAt && metadata?.filename)

export const vbaseExportFileExists = async (ctx: Context, exportId: string) => {
  try {
    await ctx.clients.vbase.getFileMetadata(
      EXPORT_VBASE_BUCKET,
      getExportFilePath(exportId)
    )

    return true
  } catch {
    return false
  }
}

export const storeConvertedExport = async (
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
    totalRows: null,
  }

  const existingMetadata = await getExportMetadata(ctx, exportId)

  if (existingMetadata) {
    metadata.totalRows = existingMetadata.totalRows
  }

  await ctx.clients.vbase.saveFile(
    EXPORT_VBASE_BUCKET,
    filePath,
    Readable.from(csvBuffer),
    false,
    EXPORT_CSV_VBASE_TTL_SECONDS
  )
  await ctx.clients.vbase.saveJSON(EXPORT_VBASE_BUCKET, exportId, metadata)

  return metadata
}

export const ensureExportIsConverted = async (
  ctx: Context,
  exportId: string
) => {
  const metadata = await getExportMetadata(ctx, exportId)
  const fileExists = await vbaseExportFileExists(ctx, exportId)

  if (hasConvertedFile(metadata) && fileExists) {
    return metadata as ExportMetadata
  }

  if (!metadata?.exportType) {
    throw new UserInputError('Export metadata not found')
  }

  const statusResponse = await ctx.clients.bulkExport.getExportStatus(exportId)

  if (
    statusResponse.status !== EXPORT_STATUS.COMPLETED ||
    !statusResponse.linkToFile
  ) {
    throw new UserInputError('Export is not ready for download')
  }

  const xlsxBuffer = await ctx.clients.bulkExport.downloadFile(
    statusResponse.linkToFile
  )

  const { buffer, filename } = await convertXlsxToCsv(
    xlsxBuffer,
    metadata.exportType
  )

  return storeConvertedExport(
    ctx,
    exportId,
    metadata.exportType,
    buffer,
    filename
  )
}
