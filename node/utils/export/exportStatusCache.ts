import type { BulkExportStatusResponse } from '../../clients/bulkExport'
import type { ExportMetadata, ExportStatusSnapshot } from './constants'
import { EXPORT_STATUS, EXPORT_VBASE_BUCKET } from './constants'

const SNAPSHOT_TTL_MS = 15 * 60 * 1000
const SNAPSHOT_WRITE_INTERVAL_MS = 30 * 1000
const SNAPSHOT_EXPORTED_ROWS_DELTA = 500

const memorySnapshots = new Map<string, ExportStatusSnapshot>()

const getCacheKey = (ctx: Context, exportId: string) =>
  `${ctx.vtex.account}:${exportId}`

const buildSnapshot = (
  statusResponse: BulkExportStatusResponse
): ExportStatusSnapshot => ({
  capturedAt: new Date().toISOString(),
  exportedRows: statusResponse.exportedRows ?? null,
  lastUpdate: statusResponse.lastUpdate ?? null,
  progressPercentage: statusResponse.progressPercentage ?? null,
  startDate: statusResponse.startDate ?? null,
  status: statusResponse.status,
})

export const isRecentSnapshot = (snapshot?: ExportStatusSnapshot) => {
  if (!snapshot?.capturedAt) {
    return false
  }

  return (
    Date.now() - new Date(snapshot.capturedAt).getTime() < SNAPSHOT_TTL_MS
  )
}

export const snapshotToStatusResponse = (
  exportId: string,
  snapshot: ExportStatusSnapshot
): BulkExportStatusResponse => ({
  exportId,
  exportedRows: snapshot.exportedRows ?? undefined,
  lastUpdate: snapshot.lastUpdate ?? undefined,
  progressPercentage: snapshot.progressPercentage ?? undefined,
  startDate: snapshot.startDate ?? undefined,
  status: snapshot.status,
})

export const getCachedStatusSnapshot = (
  ctx: Context,
  exportId: string,
  metadata?: ExportMetadata | null
) => {
  const memorySnapshot = memorySnapshots.get(getCacheKey(ctx, exportId))

  if (memorySnapshot && isRecentSnapshot(memorySnapshot)) {
    return memorySnapshot
  }

  const storedSnapshot = metadata?.lastStatusSnapshot

  if (storedSnapshot && isRecentSnapshot(storedSnapshot)) {
    return storedSnapshot
  }

  return null
}

const shouldPersistSnapshot = (
  previous: ExportStatusSnapshot | undefined,
  statusResponse: BulkExportStatusResponse
) => {
  if (
    statusResponse.status === EXPORT_STATUS.COMPLETED ||
    statusResponse.status === EXPORT_STATUS.FAILED
  ) {
    return true
  }

  if (!previous?.capturedAt) {
    return true
  }

  if (previous.status !== statusResponse.status) {
    return true
  }

  const elapsed = Date.now() - new Date(previous.capturedAt).getTime()

  if (elapsed >= SNAPSHOT_WRITE_INTERVAL_MS) {
    return true
  }

  const previousRows = previous.exportedRows ?? 0
  const nextRows = statusResponse.exportedRows ?? 0

  return Math.abs(nextRows - previousRows) >= SNAPSHOT_EXPORTED_ROWS_DELTA
}

export const saveStatusSnapshot = async (
  ctx: Context,
  exportId: string,
  statusResponse: BulkExportStatusResponse,
  metadata?: ExportMetadata | null
) => {
  const cacheKey = getCacheKey(ctx, exportId)
  const resolvedMetadata = metadata ?? null
  const previousSnapshot =
    memorySnapshots.get(cacheKey) ?? resolvedMetadata?.lastStatusSnapshot
  const snapshot = buildSnapshot(statusResponse)

  memorySnapshots.set(cacheKey, snapshot)

  if (!resolvedMetadata) {
    return
  }

  if (!shouldPersistSnapshot(previousSnapshot, statusResponse)) {
    return
  }

  try {
    await ctx.clients.vbase.saveJSON(EXPORT_VBASE_BUCKET, exportId, {
      ...resolvedMetadata,
      lastStatusSnapshot: snapshot,
    })
  } catch (error) {
    ctx.vtex.logger.warn({
      error,
      exportId,
      message: 'exportStatus.snapshotPersistSkipped',
    })
  }
}
