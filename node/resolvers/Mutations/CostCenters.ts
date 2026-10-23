import {
  COST_CENTER_DATA_ENTITY,
  ORGANIZATION_DATA_ENTITY,
} from '../../mdSchema'
import type {
  AddressInput,
  CostCenterInput,
  CostCenterInputWithId,
} from '../../typings'
import GraphQLError, {
  getErrorMessage,
  withLogLevel,
} from '../../utils/GraphQLError'
import { describeClientError } from '../../utils/clientError'
import { getHttpStatus, isNotFoundError } from '../../utils/httpError'
import { sendMutationAudit } from '../../utils/sendMutationAudit'
import {
  invalidateCostCenterCache,
  invalidateOrganizationCache,
} from '../../services/organizationsCache'
import { loadOrganization } from '../../services/organizationDocuments'
import Organizations from '../Queries/Organizations'
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
      vtex: { logger },
      ip,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    if (!organizationId) {
      // get user's organization from session
      const { sessionData } = vtex as any

      if (!sessionData?.namespaces?.['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
      } = sessionData.namespaces?.['storefront-permissions'] ?? {
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

      await sendMutationAudit(ctx, {
        subjectId: 'create-cost-center-event',
        operation: 'CREATE_COST_CENTER',
        meta: {
          entityName: 'CostCenter',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(null),
          entityAfterAction: JSON.stringify(result),
        },
      })

      return result
    } catch (error) {
      logger.error({
        entity: 'CostCenter',
        entityId: id,
        error: describeClientError(error),
        message: 'createCostCenter.error',
        operation: 'createCostCenter',
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
      clients: { masterdata },
      vtex: { logger },
      ip,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    // check if organization exists. getOrganizationById throws (it never
    // resolves null) when the document is missing, so detect not-found here
    // to log it as an expected warn. The request-scoped cache in
    // loadOrganization makes the getOrganizationById call below free.
    try {
      await loadOrganization(ctx, organizationId)
    } catch (error) {
      if (error?.organizationNotFound) {
        logger.warn({
          message: 'createCostCenterWithId.organizationNotFound',
          operation: 'createCostCenterWithId',
          organizationId,
        })
        // Same error getOrganizationById would surface to the caller, marked
        // as warn so the GraphQL error middleware does not re-log it as error.
        throw withLogLevel(new GraphQLError(getErrorMessage(error)), 'warn')
      }
      // Any other failure: let getOrganizationById log and surface it as before.
    }

    await Organizations.getOrganizationById(_, { id: organizationId }, ctx)

    // Lookup by id without going through getCostCenterById (preserves HTTP status).
    let costCenter = null

    try {
      costCenter = await masterdata.getDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: ['id'],
        id,
      })
    } catch (error) {
      if (isNotFoundError(error)) {
        costCenter = null
      } else {
        logger.error({
          costId: id,
          entity: 'CostCenter',
          entityId: id,
          error: describeClientError(error),
          message: 'createCostCenterWithId.lookupError',
          operation: 'createCostCenterWithId',
          organizationId,
        })
        throw new GraphQLError(getErrorMessage(error), {
          status: getHttpStatus(error),
        })
      }
    }

    if (costCenter) {
      logger.warn({
        costId: id,
        message: 'createCostCenterWithId.alreadyExists',
        operation: 'createCostCenterWithId',
        organizationId,
      })
      // Expected outcome, already logged as warn above: mark it so the GraphQL
      // error middleware does not re-log it as error. Message unchanged.
      throw withLogLevel(new Error('Cost Center already exists'), 'warn')
    }

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

    let costCenterId: string

    try {
      const created = await CostCenterRepository.createCostCenter(
        _,
        organizationId,
        newCostCenter,
        ctx
      )

      costCenterId = created.id
    } catch (error) {
      logger.error({
        costId: id,
        entity: 'CostCenter',
        entityId: id,
        error: describeClientError(error),
        message: 'createCostCenterWithId.error',
        operation: 'createCostCenterWithId',
        organizationId,
      })
      throw new GraphQLError(getErrorMessage(error), {
        status: getHttpStatus(error),
      })
    }

    await sendMutationAudit(ctx, {
      subjectId: 'create-cost-center-with-id-event',
      operation: 'CREATE_COST_CENTER_WITH_ID',
      meta: {
        entityName: 'CostCenter',
        remoteIpAddress: ip,
        entityBeforeAction: JSON.stringify(null),
        entityAfterAction: JSON.stringify({
          id: costCenterId,
          organizationId,
          name,
          addresses,
          phoneNumber,
          businessDocument,
          stateRegistration,
          customFields,
          marketingTags,
          sellers,
          paymentTerms,
        }),
      },
    })

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
      ip,
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

      await invalidateCostCenterCache(ctx, costCenterId)

      await sendMutationAudit(ctx, {
        subjectId: 'create-cost-center-address-event',
        operation: 'CREATE_COST_CENTER_ADDRESS',
        meta: {
          entityName: 'CostCenterAddress',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(null),
          entityAfterAction: JSON.stringify({
            costCenterId,
            address,
          }),
        },
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        entity: 'CostCenter',
        entityId: costCenterId,
        error: describeClientError(error),
        message: 'createCostCenterAddress.error',
        operation: 'createCostCenterAddress',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  deleteCostCenter: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata },
      vtex: { logger },
      ip,
    } = ctx

    try {
      const costCenter = await masterdata.getDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        id,
        fields: ['_all'],
      })

      await masterdata.deleteDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        id,
      })

      await invalidateCostCenterCache(ctx, id)

      await sendMutationAudit(ctx, {
        subjectId: 'delete-cost-center-event',
        operation: 'DELETE_COST_CENTER',
        meta: {
          entityName: 'CostCenter',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(costCenter),
          entityAfterAction: JSON.stringify(null),
        },
      })

      return { status: 'success', message: '' }
    } catch (e) {
      if (isNotFoundError(e)) {
        logger.warn({
          entity: 'CostCenter',
          entityId: id,
          message: 'deleteCostCenter.notFound',
          operation: 'deleteCostCenter',
        })
      } else {
        logger.error({
          entity: 'CostCenter',
          entityId: id,
          error: describeClientError(e),
          message: 'deleteCostCenter.error',
          operation: 'deleteCostCenter',
        })
      }

      const graphQLError = new GraphQLError(getErrorMessage(e))

      throw isNotFoundError(e)
        ? withLogLevel(graphQLError, 'warn')
        : graphQLError
    }
  },

  deleteOrganization: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata },
      vtex: { logger },
      ip,
    } = ctx

    try {
      const organization = await masterdata.getDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        id,
        fields: ['_all'],
      })

      await masterdata.deleteDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        id,
      })

      await invalidateOrganizationCache(ctx, id)

      await sendMutationAudit(ctx, {
        subjectId: 'delete-organization-event',
        operation: 'DELETE_ORGANIZATION',
        meta: {
          entityName: 'Organization',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(organization),
          entityAfterAction: JSON.stringify(null),
        },
      })

      return { status: 'success', message: '' }
    } catch (e) {
      if (isNotFoundError(e)) {
        logger.warn({
          entity: 'Organization',
          entityId: id,
          message: 'deleteOrganization.notFound',
          operation: 'deleteOrganization',
        })
      } else {
        logger.error({
          entity: 'Organization',
          entityId: id,
          error: describeClientError(e),
          message: 'deleteOrganization.error',
          operation: 'deleteOrganization',
        })
      }

      const graphQLError = new GraphQLError(getErrorMessage(e))

      throw isNotFoundError(e)
        ? withLogLevel(graphQLError, 'warn')
        : graphQLError
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
      ip,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const currentCostCenter = await masterdata.getDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        id,
        fields: [
          'name',
          'addresses',
          'paymentTerms',
          'phoneNumber',
          'businessDocument',
          'stateRegistration',
          'customFields',
        ],
      })

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

      await invalidateCostCenterCache(ctx, id)

      await sendMutationAudit(ctx, {
        subjectId: 'update-cost-center-event',
        operation: 'UPDATE_COST_CENTER',
        meta: {
          entityName: 'CostCenter',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(currentCostCenter),
          entityAfterAction: JSON.stringify({
            id,
            name,
            addresses,
            paymentTerms,
            phoneNumber,
            businessDocument,
            stateRegistration,
            customFields,
          }),
        },
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        entity: 'CostCenter',
        entityId: id,
        error: describeClientError(error),
        message: 'updateCostCenter.error',
        operation: 'updateCostCenter',
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
      ip,
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

      await invalidateCostCenterCache(ctx, costCenterId)

      await sendMutationAudit(ctx, {
        subjectId: 'update-cost-center-address-event',
        operation: 'UPDATE_COST_CENTER_ADDRESS',
        meta: {
          entityName: 'CostCenterAddress',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({
            costCenterId,
            addresses: costCenter.addresses ?? [],
          }),
          entityAfterAction: JSON.stringify({
            costCenterId,
            addresses,
          }),
        },
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        entity: 'CostCenter',
        entityId: costCenterId,
        error: describeClientError(error),
        message: 'updateCostCenterAddress.error',
        operation: 'updateCostCenterAddress',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },
}

export default CostCenters
