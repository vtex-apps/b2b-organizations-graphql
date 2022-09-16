import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_SCHEMA_VERSION,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  ORGANIZATION_REQUEST_DATA_ENTITY,
  ORGANIZATION_REQUEST_FIELDS,
  ORGANIZATION_REQUEST_SCHEMA_VERSION,
  ORGANIZATION_SCHEMA_VERSION,
} from '../../mdSchema'
import {
  ORGANIZATION_REQUEST_STATUSES,
  ORGANIZATION_STATUSES,
} from '../../utils/constants'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import checkConfig from '../config'
import message from '../message'
import B2BSettings from '../Queries/Settings'
import { updateOrganizationRequest } from '../../utils/updateOrganizationRequest'

const Organizations = {
  createOrganization: async (
    _: void,
    {
      input: { name, tradeName, defaultCostCenter },
    }: { input: OrganizationInput },
    ctx: Context
  ) => {
    const {
      clients: { masterdata, storefrontPermissions, mail },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const now = new Date()

    try {
      // create organization
      const organization = {
        name,
        ...(tradeName && { tradeName }),
        collections: [],
        costCenters: [],
        created: now,
        paymentTerms: [],
        priceTables: [],
        customFields: [],
        status: ORGANIZATION_STATUSES.ACTIVE,
      }

      const createOrganizationResult = await masterdata.createDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: organization,
        schema: ORGANIZATION_SCHEMA_VERSION,
      })

      const organizationId = createOrganizationResult.DocumentId

      // create cost center
      const costCenter = {
        addresses: [defaultCostCenter.address],
        name: defaultCostCenter.name,
        organization: organizationId,
        ...(defaultCostCenter.phoneNumber && {
          phoneNumber: defaultCostCenter.phoneNumber,
        }),
        ...(defaultCostCenter.businessDocument && {
          businessDocument: defaultCostCenter.businessDocument,
        }),
        ...(defaultCostCenter.customFields && {
          customFields: defaultCostCenter.customFields,
        }),
      }

      const costCenterResult = await masterdata.createDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: costCenter,
        schema: COST_CENTER_SCHEMA_VERSION,
      })

      message({ storefrontPermissions, logger, mail }).organizationCreated(name)

      return {
        costCenterId: costCenterResult.DocumentId,
        href: createOrganizationResult.Href,
        id: createOrganizationResult.DocumentId,
        status: '',
      }
    } catch (error) {
      logger.error({
        error,
        message: 'createOrganization-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },
  createOrganizationRequest: async (
    _: void,
    {
      input: { name, tradeName, b2bCustomerAdmin, defaultCostCenter },
    }: { input: OrganizationInput },
    ctx: Context
  ) => {
    const {
      clients: { masterdata, mail, storefrontPermissions },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const duplicate = await masterdata
      .searchDocumentsWithPaginationInfo({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: ORGANIZATION_REQUEST_FIELDS,
        pagination: {
          page: 1,
          pageSize: 1,
        },
        schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
        sort: `created DESC`,
        where: `b2bCustomerAdmin.email=${b2bCustomerAdmin.email} AND (status=pending OR status=approved)`,
      })
      .then((res: any) => {
        return res.data[0]?.status ?? ''
      })
      .catch(() => '')

    if (duplicate) {
      return { href: '', id: '', status: duplicate }
    }

    const now = new Date()

    const settings = (await B2BSettings.getB2BSettings(
      undefined,
      undefined,
      ctx
    )) as B2BSettingsInput

    const status = settings?.autoApprove
      ? ORGANIZATION_REQUEST_STATUSES.APPROVED
      : ORGANIZATION_REQUEST_STATUSES.PENDING

    const organizationRequest = {
      name,
      ...(tradeName && { tradeName }),
      b2bCustomerAdmin,
      status,
      notes: '',
      defaultCostCenter,
      created: now,
    }

    try {
      const result = (await masterdata.createDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: organizationRequest,
        schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
      })) as any

      if (settings?.autoApprove) {
        const { email, firstName } = organizationRequest.b2bCustomerAdmin

        updateOrganizationRequest(
          organizationRequest,
          masterdata,
          result.DocumentId,
          firstName,
          email,
          mail,
          organizationRequest.notes,
          status,
          storefrontPermissions,
          logger,
          (settings?.defaultPaymentTerms as unknown) as PaymentTerm[],
          (settings?.defaultPriceTables as unknown) as Price[],
          (settings?.organizationCustomFields as unknown) as CustomField[],
          Organizations,
          ctx
        )
      }

      return { href: result.Href, id: result.DocumentId, status: duplicate }
    } catch (error) {
      logger.error({
        error,
        message: 'createOrganizationRequest-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  deleteOrganizationRequest: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
    } = ctx

    try {
      await masterdata.deleteDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        id,
      })

      return { status: 'success', message: '' }
    } catch (e) {
      throw new GraphQLError(getErrorMessage(e))
    }
  },
  updateOrganization: async (
    _: void,
    {
      id,
      name,
      tradeName,
      status,
      collections,
      paymentTerms,
      priceTables,
      customFields,
    }: {
      id: string
      name: string
      tradeName?: string
      status: string
      collections: any[]
      paymentTerms: any[]
      priceTables: any[]
      customFields: any[]
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
        fields: ORGANIZATION_FIELDS,
        id,
      })

      if (currentData.status !== status) {
        await message({
          logger,
          mail,
          storefrontPermissions,
        }).organizationStatusChanged(name, id, status)
      }
    } catch (error) {
      logger.warn({
        error,
        message: 'updateOrganization-emailOnStatusChangeError',
      })
    }

    try {
      await masterdata.updatePartialDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: {
          name,
          ...((tradeName || tradeName === '') && { tradeName }),
          collections,
          paymentTerms,
          priceTables,
          customFields,
          status,
        },
        id,
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        error,
        message: 'updateOrganization-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },
  updateOrganizationRequest: async (
    _: void,
    { id, status, notes }: { id: string; status: string; notes: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata, mail, storefrontPermissions },
      vtex: { logger },
    } = ctx

    if (
      status !== ORGANIZATION_REQUEST_STATUSES.APPROVED &&
      status !== ORGANIZATION_REQUEST_STATUSES.DECLINED
    ) {
      throw new GraphQLError('Invalid status')
    }

    // create schema if it doesn't exist
    await checkConfig(ctx)

    let organizationRequest: OrganizationRequest

    try {
      // get organization request
      organizationRequest = await masterdata.getDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: ORGANIZATION_REQUEST_FIELDS,
        id,
      })
    } catch (error) {
      logger.error({
        error,
        message: 'getOrganizationRequest-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }

    // don't allow update if status is already approved or declined
    if (organizationRequest.status !== ORGANIZATION_REQUEST_STATUSES.PENDING) {
      throw new GraphQLError('Organization request already processed')
    }

    const { email, firstName } = organizationRequest.b2bCustomerAdmin

    updateOrganizationRequest(
      organizationRequest,
      masterdata,
      id,
      firstName,
      email,
      mail,
      notes,
      status,
      storefrontPermissions,
      logger,
      [],
      [],
      [],
      Organizations,
      ctx
    )

    // if we reach this block, status is declined
    try {
      // update request status to declined
      await masterdata.updatePartialDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: { status, notes },
        id,
      })

      message({ storefrontPermissions, logger, mail }).organizationDeclined(
        organizationRequest.name,
        firstName,
        email,
        notes
      )

      return { status: 'success', message: '' }
    } catch (e) {
      throw new GraphQLError(getErrorMessage(e))
    }
  },
}

export default Organizations
