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
        paymentTerms,
      },
    }: { organizationId: string; input: CostCenterInput },
    ctx: Context
  ) => {
    const {
      vtex,
      vtex: { logger, adminUserAuthToken },
      clients: { audit, licenseManager },
      ip,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const { profile } = await licenseManager.getTopbarData(
      adminUserAuthToken ?? ''
    )

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
        paymentTerms,
      }

      const result = await CostCenterRepository.createCostCenter(
        _,
        organizationId,
        costCenter,
        ctx
      )

      await audit.sendEvent(
        {
          subjectId: 'create-cost-center-event',
          operation: 'CREATE_COST_CENTER',
          authorId: profile?.id || 'unknown',
          meta: {
            entityName: 'CreateCostCenter',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify({
              organizationId,
              costCenter,
            }),
            entityAfterAction: JSON.stringify(result),
          },
        },
        {}
      )

      return result
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
        paymentTerms,
      },
    }: { organizationId: string; input: CostCenterInputWithId },
    ctx: Context
  ) => {
    const {
      vtex: { logger, adminUserAuthToken },
      clients: { audit, licenseManager },
      ip,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const { profile } = await licenseManager.getTopbarData(
      adminUserAuthToken ?? ''
    )

    try {
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
        paymentTerms,
      }

      const { id: costCenterId } = await CostCenterRepository.createCostCenter(
        _,
        organizationId,
        newCostCenter,
        ctx
      )

      await audit.sendEvent(
        {
          subjectId: 'create-cost-center-with-id-event',
          operation: 'CREATE_COST_CENTER_WITH_ID',
          authorId: profile?.id || 'unknown',
          meta: {
            entityName: 'CreateCostCenterWithId',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify({
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
                paymentTerms,
              },
            }),
            entityAfterAction: JSON.stringify({
              id: costCenterId,
            }),
          },
        },
        {}
      )

      return { id: costCenterId }
    } catch (error) {
      logger.error({
        error,
        message: 'createCostCenterWithId-error',
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
      clients: { masterdata, audit, licenseManager },
      vtex: { logger, adminUserAuthToken },
      ip,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const { profile } = await licenseManager.getTopbarData(
      adminUserAuthToken ?? ''
    )

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

      await audit.sendEvent(
        {
          subjectId: 'create-cost-center-address-event',
          operation: 'CREATE_COST_CENTER_ADDRESS',
          authorId: profile?.id || 'unknown',
          meta: {
            entityName: 'CreateCostCenterAddress',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify({
              costCenterId,
              address,
            }),
            entityAfterAction: JSON.stringify({
              costCenterId,
              status: 'success',
            }),
          },
        },
        {}
      )

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
      clients: { masterdata, audit, licenseManager },
      vtex: { adminUserAuthToken },
      ip,
    } = ctx

    const { profile } = await licenseManager.getTopbarData(
      adminUserAuthToken ?? ''
    )

    try {
      await masterdata.deleteDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        id,
      })

      await audit.sendEvent(
        {
          subjectId: 'delete-cost-center-event',
          operation: 'DELETE_COST_CENTER',
          authorId: profile.id || '',
          meta: {
            entityName: 'DeleteCostCenter',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify({ id }),
            entityAfterAction: JSON.stringify({ deleted: true, id }),
          },
        },
        {}
      )

      return { status: 'success', message: '' }
    } catch (e) {
      throw new GraphQLError(getErrorMessage(e))
    }
  },

  deleteOrganization: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata, audit, licenseManager },
      vtex: { adminUserAuthToken },
      ip,
    } = ctx

    const { profile } = await licenseManager.getTopbarData(
      adminUserAuthToken ?? ''
    )

    try {
      await masterdata.deleteDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        id,
      })

      await audit.sendEvent(
        {
          subjectId: 'delete-organization-event',
          operation: 'DELETE_ORGANIZATION',
          authorId: profile.id || '',
          meta: {
            entityName: 'DeleteOrganization',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify({ id }),
            entityAfterAction: JSON.stringify({ deleted: true, id }),
          },
        },
        {}
      )

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
      clients: { masterdata, audit, licenseManager },
      vtex: { logger, adminUserAuthToken },
      ip,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const { profile } = await licenseManager.getTopbarData(
      adminUserAuthToken ?? ''
    )

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

      await audit.sendEvent(
        {
          subjectId: 'update-cost-center-event',
          operation: 'UPDATE_COST_CENTER',
          authorId: profile?.id || 'unknown',
          meta: {
            entityName: 'UpdateCostCenter',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify({
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
            }),
            entityAfterAction: JSON.stringify({
              id,
              status: 'success',
            }),
          },
        },
        {}
      )

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
      clients: { masterdata, audit, licenseManager },
      vtex: { logger, adminUserAuthToken },
      ip,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)
    const { profile } = await licenseManager.getTopbarData(
      adminUserAuthToken ?? ''
    )

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

      await audit.sendEvent(
        {
          subjectId: 'update-cost-center-address-event',
          operation: 'UPDATE_COST_CENTER_ADDRESS',
          authorId: profile?.id || 'unknown',
          meta: {
            entityName: 'UpdateCostCenterAddress',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify({
              costCenterId,
              address,
            }),
            entityAfterAction: JSON.stringify({
              costCenterId,
              addresses,
              status: 'success',
            }),
          },
        },
        {}
      )

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
