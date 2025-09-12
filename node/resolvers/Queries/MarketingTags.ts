import { MARKETING_TAGS } from '../../utils/constants'

const MarketingTags = {
  getMarketingTags: async (
    _: void,
    { costId }: { costId: string },
    ctx: Context
  ) => {
    const {
      clients: { vbase, audit, licenseManager },
      vtex: { logger, adminUserAuthToken },
      ip
    } = ctx


    const { profile } = await licenseManager.getTopbarData(adminUserAuthToken ?? '')

    try {
      const result = await vbase.getJSON(MARKETING_TAGS.VBASE_BUCKET, costId)

      await audit.sendEvent({
        subjectId: 'get-marketing-tags-event',
        operation: 'GET_MARKETING_TAGS',
        authorId: profile.id || '',
        meta: {
          entityName: 'GetMarketingTags',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({ costId }),
          entityAfterAction: JSON.stringify({}),
        },
      }, { })

      return result
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
