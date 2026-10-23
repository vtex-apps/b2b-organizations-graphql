import { describeClientError } from '../../utils/clientError'
import { sendMutationAudit } from '../../utils/sendMutationAudit'
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
      ip,
    } = ctx

    if (!costId || !tags) {
      throw new Error('Invalid parameters')
    }

    try {
      let previousData: { tags?: string[] } | null = null

      try {
        previousData = await vbase.getJSON(MARKETING_TAGS.VBASE_BUCKET, costId)
      } catch {
        previousData = null
      }

      await vbase.saveJSON(MARKETING_TAGS.VBASE_BUCKET, costId, {
        tags,
      })

      await sendMutationAudit(ctx, {
        subjectId: 'set-marketing-tags-event',
        operation: 'SET_MARKETING_TAGS',
        meta: {
          entityName: 'MarketingTags',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({
            costId,
            tags: previousData?.tags ?? [],
          }),
          entityAfterAction: JSON.stringify({
            costId,
            tags,
          }),
        },
      })

      return { status: 'success', message: '', id: costId }
    } catch (error) {
      logger.error({
        entity: 'Settings',
        entityId: costId,
        error: describeClientError(error),
        message: 'setMarketingTags.error',
        operation: 'setMarketingTags',
      })

      return { status: 'error', message: error }
    }
  },
}

export default MarketingTags
