import type { CostCenterInput, Result } from '../../typings'
import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_SCHEMA_VERSION,
} from '../../mdSchema'
import MarketingTags from '../Mutations/MarketingTags'

const CostCenterRepository = {
  createCostCenter: async (
    _: void,
    organizationId: string,
    {
      addresses,
      id,
      name,
      paymentTerms,
      phoneNumber,
      businessDocument,
      stateRegistration,
      customFields,
      sellers,
      marketingTags,
    }: CostCenterInput,
    ctx: Context
  ): Promise<Result> => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    const costCenter = {
      addresses,
      id,
      name,
      organization: organizationId,
      ...(paymentTerms && { paymentTerms }),
      ...(phoneNumber && { phoneNumber }),
      ...(businessDocument && { businessDocument }),
      ...(stateRegistration && { stateRegistration }),
      ...(customFields && { customFields }),
      ...(sellers && { sellers }),
    }

    const createCostCenterResult = await masterdata.createDocument({
      dataEntity: COST_CENTER_DATA_ENTITY,
      fields: costCenter,
      schema: COST_CENTER_SCHEMA_VERSION,
    })

    if (marketingTags && marketingTags?.length > 0) {
      MarketingTags.setMarketingTags(
        _,
        { costId: createCostCenterResult.DocumentId, tags: marketingTags },
        ctx
      ).catch((error) => {
        logger.error({
          error,
          message: 'setMarketingTags-error',
        })
      })
    }

    return {
      href: createCostCenterResult.Href,
      id: createCostCenterResult.DocumentId,
      status: '',
    }
  },
}

export default CostCenterRepository
