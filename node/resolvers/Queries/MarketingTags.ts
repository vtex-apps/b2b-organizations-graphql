import { MARKETING_TAGS } from '../../utils/constants'

const MarketingTags = {
  getMarketingTags: async (_: void, __: any, ctx: Context) => {
    const {
      clients: { vbase },
      vtex: { logger },
    } = ctx

    try {
      const data = await vbase.getJSON(
        MARKETING_TAGS.VBASE_BUCKET,
        MARKETING_TAGS.VBASE_ID
      )

      return data
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
