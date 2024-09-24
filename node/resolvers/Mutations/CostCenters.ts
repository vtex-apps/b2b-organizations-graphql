/* eslint-disable no-console */
import {
  COST_CENTER_DATA_ENTITY,
  ORGANIZATION_DATA_ENTITY,
} from '../../mdSchema'
import type {
  AddressInput,
  CostCenterInput,
  CostCenterInputWithId,
} from '../../typings'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import Organizations from '../Queries/Organizations'
import costCenters from '../Queries/CostCenters'
import checkConfig from '../config'
import CostCenterRepository from '../repository/CostCenterRepository'
import Users from '../Queries/Users'

const CostCenters = {
  createCostCenter: async (
    _: void,
    {
      organizationId,
      input: {
        id,
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
      const costCenter: CostCenterInput = {
        addresses,
        businessDocument,
        customFields,
        marketingTags,
        id,
        name,
        phoneNumber,
        sellers,
        stateRegistration,
      }

      return await CostCenterRepository.createCostCenter(
        _,
        organizationId,
        costCenter,
        ctx
      )
    } catch (error) {
      logger.error({
        error,
        message: 'createCostCenter-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  createCostCenterWithId: async (
    _: void,
    {
      organizationId,
      input: {
        id,
        name,
        addresses,
        phoneNumber,
        businessDocument,
        stateRegistration,
        customFields,
        marketingTags,
        sellers,
      },
    }: { organizationId: string; input: CostCenterInputWithId },
    ctx: Context
  ) => {
    // create schema if it doesn't exist
    await checkConfig(ctx)

    // check if organization exists
    const organization = (await Organizations.getOrganizationById(
      _,
      { id: organizationId },
      ctx
    )) as {
      status: string
    }

    if (!organization) {
      throw new Error('Organization not found')
    }

    // check if cost center id already exists
    let costCenter = null

    try {
      costCenter = await costCenters.getCostCenterById(_, { id }, ctx)
    } catch (error) {
      costCenter = null // cost center does not exist so we don't need to do anything
    }

    if (costCenter) {
      throw new Error('Cost Center already exists')
    }

    // create cost center
    const newCostCenter: CostCenterInput = {
      addresses,
      businessDocument,
      customFields,
      marketingTags,
      id,
      name,
      phoneNumber,
      sellers,
      stateRegistration,
    }

    const { id: costCenterId } = await CostCenterRepository.createCostCenter(
      _,
      organizationId,
      newCostCenter,
      ctx
    )

    return { id: costCenterId }
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
      const users = await Users.getUsers(
        _,
        { costCenterId: id, organizationId: '' },
        ctx
      )

      console.log('users', users)
      const usersDeleted = await Promise.all(
        users.map((user: any) =>
          masterdata.deleteDocument({
            dataEntity: 'b2b_users',
            id: user.id,
          })
        )
      )

      console.log('usersDeleted', usersDeleted)

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
