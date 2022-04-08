import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_SCHEMA_VERSION,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
} from '../../mdSchema'
import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'
import message from '../message'

const CostCenters = {
  createCostCenter: async (
    _: void,
    {
      organizationId,
      input: { name, addresses, businessDocument },
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
      }
    } catch (e) {
      logger.error({
        message: 'createCostCenter-error',
        error: e,
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
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
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
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
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
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
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
    }
  },

  updateCostCenter: async (
    _: void,
    {
      id,
      input: { name, addresses, paymentTerms, businessDocument },
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
          ...(paymentTerms && { paymentTerms }),
          ...(businessDocument && { businessDocument }),
        },
      })

      return { status: 'success', message: '' }
    } catch (e) {
      logger.error({
        message: 'updateCostCenter-error',
        error: e,
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
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
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
    }
  },

  updateOrganization: async (
    _: void,
    {
      id,
      name,
      status,
      collections,
      paymentTerms,
      priceTables,
    }: {
      id: string
      name: string
      status: string
      collections: any[]
      paymentTerms: any[]
      priceTables: any[]
    },
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions, mail, masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const currentData: Organization = await masterdata.getDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        id,
        fields: ORGANIZATION_FIELDS,
      })

      if (currentData.status !== status) {
        await message({
          storefrontPermissions,
          logger,
          mail,
        }).organizationStatusChanged(name, id, status)
      }
    } catch (error) {
      logger.warn({
        message: 'updateOrganization-emailOnStatusChangeError',
        error,
      })
    }

    try {
      await masterdata.updatePartialDocument({
        id,
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: { name, status, collections, paymentTerms, priceTables },
      })

      return { status: 'success', message: '' }
    } catch (e) {
      logger.error({
        message: 'updateOrganization-error',
        error: e,
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
    }
  },
}

export default CostCenters
