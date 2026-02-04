import { MARKETING_TAGS } from '../../utils/constants'

const MarketingTags = {
  getMarketingTags: async (
    _: void,
    { costId }: { costId: string },
    ctx: Context
  ) => {
    const {
      clients: { vbase, audit },
      vtex: { logger },
      ip,
    } = ctx

    try {
      await audit.sendEvent({
        subjectId: 'get-marketing-tags-event',
        operation: 'GET_MARKETING_TAGS',
        meta: {
          entityName: 'MarketingTags',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return await vbase.getJSON(MARKETING_TAGS.VBASE_BUCKET, costId)
    } catch (error) {
      const { data } = error.response as any

      if (data.code !== 'FileNotFound') {
        logger.error({
          error,
          message: 'getMarketingTags.error',
        })
      }

      return { status: 'error', message: error }
    }
  },
}

export default MarketingTags
