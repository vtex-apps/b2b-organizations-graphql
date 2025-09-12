import { MARKETING_TAGS } from '../../utils/constants'

const MarketingTags = {
  setMarketingTags: async (
    _: void,
    { costId, tags }: { costId: string; tags: string[] },
    ctx: Context
  ) => {
    const {
      clients: { vbase, audit, licenseManager },
      vtex: { logger, adminUserAuthToken },
      ip
    } = ctx


    const { profile } = await licenseManager.getTopbarData(adminUserAuthToken ?? '')

    if (!costId || !tags) {
      throw new Error('Invalid parameters')
    }

    try {
      await vbase.saveJSON(MARKETING_TAGS.VBASE_BUCKET, costId, {
        tags,
      })

      const result = { status: 'success', message: '', id: costId }

      await audit.sendEvent({
        subjectId: 'set-marketing-tags-event',
        operation: 'SET_MARKETING_TAGS',
        authorId: profile?.id || 'unknown',
        meta: {
          entityName: 'SetMarketingTags',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({
            costId,
            tags
          }),
          entityAfterAction: JSON.stringify(result),
        },
      }, {})

      return result
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
