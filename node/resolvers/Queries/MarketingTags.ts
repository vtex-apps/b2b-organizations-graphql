import { MARKETING_TAGS } from '../../utils/constants'
import { describeClientError } from '../../utils/clientError'
import { auditQueryEvent } from '../../utils/queryObservability'

const MarketingTags = {
  getMarketingTags: async (
    _: void,
    { costId }: { costId: string },
    ctx: Context
  ) => {
    const {
      clients: { vbase },
      vtex: { logger },
      ip,
    } = ctx

    try {
      auditQueryEvent(ctx, {
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
          error: describeClientError(error),
          message: 'getMarketingTags.error',
        })
      }

      return { status: 'error', message: error }
    }
  },
}

export default MarketingTags
