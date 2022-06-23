import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_SCHEMA_VERSION,
  ORGANIZATION_DATA_ENTITY,
} from '../../mdSchema'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import checkConfig from '../config'

const CostCenters = {
  createCostCenter: async (
    _: void,
    {
      organizationId,
      input: { name, addresses, phoneNumber, businessDocument },
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
      } = sessionData.namespaces['storefront-permissions']

      organizationId = userOrganizationId
    }

    try {
      const costCenter = {
        name,
        addresses,
        organization: organizationId,
        ...(phoneNumber && { phoneNumber }),
        ...(businessDocument && { businessDocument }),
      }

      const createCostCenterResult = await masterdata.createDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: costCenter,
        schema: COST_CENTER_SCHEMA_VERSION,
      })

      return {
        href: createCostCenterResult.Href,
        id: createCostCenterResult.DocumentId,
        status: '',
      }
    } catch (e) {
      logger.error({
        message: 'createCostCenter-error',
        error: e,
      })
      throw new GraphQLError(getErrorMessage(e))
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

    const costCenter: CostCenterInput = await masterdata.getDocument({
      dataEntity: COST_CENTER_DATA_ENTITY,
      fields: ['addresses'],
      id: costCenterId,
    })

    const addresses = costCenter.addresses ?? []

    addresses.push(address)

    try {
      await masterdata.updatePartialDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: {
          addresses,
        },
        id: costCenterId,
      })

      return { status: 'success', message: '' }
    } catch (e) {
      logger.error({
        message: 'createCostCenterAddress-error',
        error: e,
      })
      throw new GraphQLError(getErrorMessage(e))
    }
  },
  deleteCostCenter: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata },
    } = ctx

    try {
      await masterdata.deleteDocument({
        id,
        dataEntity: COST_CENTER_DATA_ENTITY,
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
        id,
        dataEntity: ORGANIZATION_DATA_ENTITY,
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
      input: { name, addresses, paymentTerms, phoneNumber, businessDocument },
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
        id,
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: {
          name,
          ...(addresses?.length && { addresses }),
          ...(paymentTerms?.length && { paymentTerms }),
          ...((phoneNumber || phoneNumber === '') && { phoneNumber }),
          ...((businessDocument || businessDocument === '') && {
            businessDocument,
          }),
        },
      })

      return { status: 'success', message: '' }
    } catch (e) {
      logger.error({
        message: 'updateCostCenter-error',
        error: e,
      })
      throw new GraphQLError(getErrorMessage(e))
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

    try {
      await masterdata.updatePartialDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: {
          addresses,
        },
        id: costCenterId,
      })

      return { status: 'success', message: '' }
    } catch (e) {
      logger.error({
        message: 'updateCostCenterAddress-error',
        error: e,
      })
      throw new GraphQLError(getErrorMessage(e))
    }
  },
}

export default CostCenters
