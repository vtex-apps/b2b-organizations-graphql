import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_SCHEMA_VERSION,
  ORGANIZATION_DATA_ENTITY,
} from '../../mdSchema'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import checkConfig from '../config'
import MarketingTags from './MarketingTags'

const CostCenters = {
  createCostCenter: async (
    _: void,
    {
      organizationId,
      input: {
        name,
        addresses,
        phoneNumber,
        businessDocument,
        stateRegistration,
        customFields,
        marketingTags,
        sellers,
      },
    }: { organizationId: string; input: CostCenterInput },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex,
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    if (!organizationId) {
      // get user's organization from session
      const { sessionData } = vtex as any

      if (!sessionData?.namespaces['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
      } = sessionData.namespaces['storefront-permissions'] ?? {
        organization: {
          value: null,
        },
      }

      organizationId = userOrganizationId
    }

    try {
      const costCenter = {
        addresses,
        name,
        organization: organizationId,
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
    } catch (error) {
      logger.error({
        error,
        message: 'createCostCenter-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  createCostCenterAddress: async (
    _: void,
    { costCenterId, address }: { costCenterId: string; address: AddressInput },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const costCenter: CostCenterInput = await masterdata.getDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: ['addresses'],
        id: costCenterId,
      })

      const addresses = costCenter.addresses ?? []

      addresses.push(address)

      await masterdata.updatePartialDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: {
          addresses,
        },
        id: costCenterId,
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        error,
        message: 'createCostCenterAddress-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  deleteCostCenter: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata },
    } = ctx

    try {
      await masterdata.deleteDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        id,
      })

      return { status: 'success', message: '' }
    } catch (e) {
      throw new GraphQLError(getErrorMessage(e))
    }
  },

  deleteOrganization: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata },
    } = ctx

    try {
      await masterdata.deleteDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        id,
      })

      return { status: 'success', message: '' }
    } catch (e) {
      throw new GraphQLError(getErrorMessage(e))
    }
  },

  updateCostCenter: async (
    _: void,
    {
      id,
      input: {
        name,
        addresses,
        paymentTerms,
        phoneNumber,
        businessDocument,
        stateRegistration,
        customFields,
      },
    }: { id: string; input: CostCenterInput },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      await masterdata.updatePartialDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: {
          name,
          ...(addresses?.length && { addresses }),
          ...(paymentTerms?.length && { paymentTerms }),
          ...((phoneNumber || phoneNumber === '') && { phoneNumber }),
          ...((stateRegistration || stateRegistration === '') && {
            stateRegistration,
          }),
          ...((businessDocument || businessDocument === '') && {
            businessDocument,
          }),
          ...((customFields || customFields === '') && {
            customFields,
          }),
        },
        id,
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        error,
        message: 'updateCostCenter-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  updateCostCenterAddress: async (
    _: void,
    { costCenterId, address }: { costCenterId: string; address: AddressInput },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)
    try {
      const costCenter: CostCenterInput = await masterdata.getDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: ['addresses'],
        id: costCenterId,
      })

      let addresses = costCenter.addresses ?? []

      addresses = addresses.map((current: AddressInput) => {
        if (address.addressId === current.addressId) {
          return address
        }

        return current
      })

      await masterdata.updatePartialDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: {
          addresses,
        },
        id: costCenterId,
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        error,
        message: 'updateCostCenterAddress-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },
}

export default CostCenters
