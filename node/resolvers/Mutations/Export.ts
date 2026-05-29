import { UserInputError } from '@vtex/api'

import type { ExportMetadata, ExportType } from '../../utils/export/constants'
import { EXPORT_VBASE_BUCKET } from '../../utils/export/constants'
import { countExportTotalRows } from '../../utils/export/countExportTotalRows'

const Export = {
  createExport: async (
    _: void,
    { exportType }: { exportType: ExportType },
    ctx: Context
  ) => {
    const {
      clients: { bulkExport, vbase },
      vtex: { logger },
    } = ctx

    const { exportId } = await bulkExport.createExport(exportType)

    if (!exportId) {
      throw new UserInputError('Unable to start export. Please try again.')
    }

    let totalRows: number | null = null

    try {
      totalRows = await countExportTotalRows(exportType, ctx)
    } catch (error) {
      logger.warn({
        error,
        exportId,
        exportType,
        message: 'createExport.countTotalRowsFailed',
      })
    }

    const metadata: ExportMetadata = {
      convertedAt: '',
      exportId,
      exportType,
      filename: '',
      totalRows,
    }

    await vbase.saveJSON(EXPORT_VBASE_BUCKET, exportId, metadata)

    return { exportId }
  },
}

export default Export
