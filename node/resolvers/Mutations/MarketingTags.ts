import { MARKETING_TAGS } from '../../utils/constants'

const MarketingTags = {
  setMarketingTags: async (
    _: void,
    { tags }: { tags: string[] },
    ctx: Context
  ) => {
    const {
      clients: { vbase },
      vtex: { logger },
    } = ctx

    try {
      await vbase.saveJSON(
        MARKETING_TAGS.VBASE_BUCKET,
        MARKETING_TAGS.VBASE_ID,
        {
          tags,
        }
      )

      return { status: 'success', message: '', id: MARKETING_TAGS.VBASE_ID }
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
