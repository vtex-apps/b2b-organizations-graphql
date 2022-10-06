import { MARKETING_TAGS } from '../../utils/constants'

const MarketingTags = {
  setMarketingTags: async (
    _: void,
    { costId, tags }: { costId: string; tags: string[] },
    ctx: Context
  ) => {
    const {
      clients: { vbase },
      vtex: { logger },
    } = ctx

    if (!costId || !tags) {
      throw new Error('Invalid parameters')
    }

    try {
      await vbase.saveJSON(MARKETING_TAGS.VBASE_BUCKET, costId, {
        tags,
      })

      return { status: 'success', message: '', id: costId }
    } catch (error) {
      logger.error({
        error,
        message: 'setMarketingTags.error',
      })

      return { status: 'error', message: error }
    }
  },
}

export default MarketingTags
