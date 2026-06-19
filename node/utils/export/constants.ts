export const EXPORT_VBASE_BUCKET = 'b2b_exports'

export const EXPORT_CSV_VBASE_TTL_SECONDS = 300

export const UTF8_BOM = '\uFEFF'

export const EXPORT_STATUS = {
  COMPLETED: 1,
  FAILED: 2,
  IN_PROGRESS: 0,
} as const

export const EXPORT_STATUS_GRAPHQL = {
  0: 'IN_PROGRESS',
  1: 'COMPLETED',
  2: 'FAILED',
} as const

export type ExportType =
  | 'organizations'
  | 'cost_centers'
  | 'members'
  | 'addresses'

export interface ExportStatusSnapshot {
  capturedAt: string
  exportedRows?: number | null
  lastUpdate?: string | null
  progressPercentage?: number | null
  startDate?: string | null
  status: number
}

export interface ExportMetadata {
  convertedAt: string
  exportId: string
  exportType: ExportType
  filename: string
  lastStatusSnapshot?: ExportStatusSnapshot
  totalRows?: number | null
}

export const getExportFilePath = (exportId: string) => `${exportId}.csv`

export const buildExportFilename = (exportType: ExportType) => {
  const date = new Date().toISOString().slice(0, 10)

  return `b2b-export-${exportType}-${date}.csv`
}

export const buildExportDownloadUrl = (host: string, exportId: string) =>
  `https://${host}/_v/private/b2b/export/${exportId}`
