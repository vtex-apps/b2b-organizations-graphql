import { UserInputError } from '@vtex/api'

import type { ExportMetadata, ExportType } from '../../utils/export/constants'
import { EXPORT_VBASE_BUCKET } from '../../utils/export/constants'

const Export = {
  createExport: async (
    _: void,
    { exportType }: { exportType: ExportType },
    ctx: Context
  ) => {
    const { exportId } = await ctx.clients.bulkExport.createExport(exportType)

    if (!exportId) {
      throw new UserInputError('Unable to start export. Please try again.')
    }

    const metadata: ExportMetadata = {
      convertedAt: '',
      exportId,
      exportType,
      filename: '',
    }

    await ctx.clients.vbase.saveJSON(EXPORT_VBASE_BUCKET, exportId, metadata)

    return { exportId }
  },
}

export default Export
