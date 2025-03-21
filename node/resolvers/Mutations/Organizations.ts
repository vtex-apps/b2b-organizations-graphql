import type { Seller } from '../../clients/sellers'
import {
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  ORGANIZATION_REQUEST_DATA_ENTITY,
  ORGANIZATION_REQUEST_FIELDS,
  ORGANIZATION_REQUEST_SCHEMA_VERSION,
  ORGANIZATION_SCHEMA_VERSION,
} from '../../mdSchema'
import type {
  B2BSettingsInput,
  Collection,
  DefaultCostCenterInput,
  NormalizedOrganizationInput,
  Organization,
  OrganizationInput,
  OrganizationRequest,
  PaymentTerm,
  Price,
} from '../../typings'
import {
  ORGANIZATION_REQUEST_STATUSES,
  ORGANIZATION_STATUSES,
} from '../../utils/constants'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import {
  sendOrganizationStatusMetric,
  sendUpdateOrganizationMetric,
} from '../../utils/metrics/organization'
import checkConfig from '../config'
import message from '../message'
import B2BSettings from '../Queries/Settings'
import CostCenterRepository from '../repository/CostCenterRepository'

const createUserAndAttachToOrganization = async ({
  storefrontPermissions,
  email,
  costCenterId,
  organizationId,
  firstName,
  lastName,
  logger,
}: any) => {
  // get roleId of org admin
  const roles = await storefrontPermissions.listRoles().then((result: any) => {
    return result.data.listRoles
  })

  const roleId = roles.find(
    (roleItem: any) => roleItem.slug === 'customer-admin'
  ).id

  // grant user org admin role, assign org and cost center
  return storefrontPermissions
    .saveUser({
      clId: null,
      costId: costCenterId,
      email,
      name: `${firstName} ${lastName}`,
      orgId: organizationId,
      roleId,
    })
    .then((result: any) => {
      return result.data.saveUser
    })
    .catch((error: any) => {
      logger.error({
        error,
        message: 'addUser-error',
      })
    })
}

const createOrganization = async (
  _: void,
  {
    id,
    name,
    tradeName,
    paymentTerms,
    priceTables,
    salesChannel,
    sellers,
    customFields,
    collections,
  }: OrganizationInput,
  ctx: Context
): Promise<{
  Id: string
  Href: string
  DocumentId: string
}> => {
  const {
    clients: { masterdata },
  } = ctx

  const organization = {
    id,
    name,
    ...(tradeName && { tradeName }),
    collections: [],
    created: new Date(),
    ...(paymentTerms?.length && { paymentTerms }),
    ...(priceTables?.length && { priceTables }),
    ...(salesChannel && { salesChannel }),
    ...(sellers && { sellers }),
    ...(collections && { collections }),
    customFields: customFields ?? [],
    status: ORGANIZATION_STATUSES.ACTIVE,
    permissions: { createQuote: true },
  }

  return masterdata.createDocument({
    dataEntity: ORGANIZATION_DATA_ENTITY,
    fields: organization,
    schema: ORGANIZATION_SCHEMA_VERSION,
  })
}

const findPaymentTerms = async (paymentTermNames: string[], ctx: Context) => {
  const {
    clients: { payments },
  } = ctx

  const paymentRules = await payments.getPaymentTerms()
  const paymentTerms = paymentTermNames
    ?.map((paymentTermName: string) => {
      const paymentTerm = paymentRules.find(
        (paymentRule: any) => paymentRule.name === paymentTermName
      )

      if (paymentTerm) {
        return {
          id: paymentTerm.id.toString(),
          name: paymentTerm.name,
        } as PaymentTerm
      }

      return null
    })
    .filter((paymentTerm: any) => paymentTerm !== null)

  return paymentTerms
}

const findSellers = async (sellerNames: string[], ctx: Context) => {
  const {
    clients: { sellers },
  } = ctx

  const availableSellers = (await sellers.getSellers())?.items
  const sellersFound = sellerNames
    ?.map((sellerName: string) => {
      const seller = availableSellers.find((s: any) => s.name === sellerName)

      if (seller) {
        return {
          id: seller.id,
          name: seller.name,
        } as Seller
      }

      return null
    })
    .filter((seller: any) => seller !== null)

  return sellersFound
}

const findCollections = async (collectionsNames: string[], ctx: Context) => {
  const {
    clients: { catalog },
  } = ctx

  const collectionsFound = collectionsNames
    .map(async (collectionName: string) => {
      const availableCollections = (
        await catalog.collectionsAvailable(collectionName)
      )?.items

      const collection = availableCollections.find(
        (c: any) => c.name === collectionName
      )

      if (collection) {
        return {
          id: collection.id.toString(),
          name: collection.name,
        } as Collection
      }

      return null
    })
    .filter((collection: any) => collection !== null)

  return Promise.all(collectionsFound)
}

const createOrganizationAndCostCenterWithAdminUser = async (
  _: void,
  organization: NormalizedOrganizationInput,
  ctx: Context
) => {
  const {
    clients: { storefrontPermissions, mail },
    vtex: { logger },
  } = ctx

  // create schema if it doesn't exist
  await checkConfig(ctx)

  try {
    // copy fields from NormalizedOrganizationInput to OrganizationInput
    // and transform fields that need transformation
    const organizationInput = {
      id: organization.id,
      name: organization.name,
      tradeName: organization.tradeName,
      b2bCustomerAdmin: organization.b2bCustomerAdmin,
      defaultCostCenter: organization.defaultCostCenter,
      costCenters: organization.costCenters,
      customFields: organization.customFields,
      permissions: { createQuote: true },
      paymentTerms: organization.paymentTerms
        ? await findPaymentTerms(organization.paymentTerms, ctx)
        : [],
      priceTables: organization.priceTables,
      salesChannel: organization.salesChannel,
      sellers: organization.sellers
        ? await findSellers(organization.sellers, ctx)
        : [],
      collections: organization.collections
        ? await findCollections(organization.collections, ctx)
        : [],
    } as OrganizationInput

    // create organization
    const createOrganizationResult = await createOrganization(
      _,
      organizationInput,
      ctx
    )

    const organizationId = createOrganizationResult.DocumentId

    const { defaultCostCenter, costCenters } = organization
    const { email, firstName, lastName } = organization.b2bCustomerAdmin

    const settings = (await B2BSettings.getB2BSettings(
      undefined,
      undefined,
      ctx
    )) as B2BSettingsInput

    if (costCenters?.length) {
      await Promise.all(
        costCenters?.map(async (costCenter: DefaultCostCenterInput) => {
          const addresses = costCenter.address ? [costCenter.address] : []

          const { id: costCenterId } =
            await CostCenterRepository.createCostCenter(
              _,
              organizationId,
              {
                addresses,
                ...costCenter,
              },
              ctx
            )

          const userToAdd = costCenter.user ?? {
            email,
            firstName,
            lastName,
          }

          createUserAndAttachToOrganization({
            costCenterId,
            email: userToAdd.email,
            firstName: userToAdd.firstName,
            lastName: userToAdd.lastName,
            logger,
            organizationId,
            storefrontPermissions,
          })
        })
      )
    }

    if (defaultCostCenter) {
      const addresses = defaultCostCenter.address
        ? [defaultCostCenter.address]
        : []

      const { id: costCenterId } = await CostCenterRepository.createCostCenter(
        _,
        organizationId,
        {
          addresses,
          ...defaultCostCenter,
        },
        ctx
      )

      await createUserAndAttachToOrganization({
        costCenterId,
        email,
        firstName,
        lastName,
        logger,
        organizationId,
        storefrontPermissions,
      })
    }

    if (settings?.transactionEmailSettings?.organizationCreated) {
      message({
        logger,
        mail,
        storefrontPermissions,
      }).organizationCreated(organizationInput.name)
    }

    return {
      href: createOrganizationResult.Href,
      id: organizationId,
      status: '',
    }
  } catch (error) {
    logger.error({
      error,
      message: 'createOrganization-error',
    })
    throw new GraphQLError(getErrorMessage(error))
  }
}

const Organizations = {
  createOrganization: async (
    _: void,
    {
      input: {
        name,
        tradeName,
        defaultCostCenter,
        costCenters,
        customFields,
        paymentTerms,
        priceTables,
        salesChannel,
        sellers,
      },
      notifyUsers = true,
    }: { input: OrganizationInput; notifyUsers?: boolean },
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions, mail },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const organization = {
        customFields,
        name,
        paymentTerms,
        priceTables,
        salesChannel,
        sellers,
        tradeName,
      } as OrganizationInput

      // create organization
      const createOrganizationResult = await createOrganization(
        _,
        organization,
        ctx
      )

      const organizationId = createOrganizationResult.DocumentId

      let costCenterResult: any[] = []

      if (!defaultCostCenter && costCenters?.length) {
        costCenterResult = await Promise.all(
          costCenters?.map(async (costCenter: any) => {
            const addresses = costCenter.address ? [costCenter.address] : []

            CostCenterRepository.createCostCenter(
              _,
              organizationId,
              {
                addresses,
                ...costCenter,
              },
              ctx
            )
          })
        )
      } else if (defaultCostCenter) {
        const addresses = defaultCostCenter.address
          ? [defaultCostCenter.address]
          : []

        costCenterResult = [
          await CostCenterRepository.createCostCenter(
            _,
            organizationId,
            {
              addresses,
              ...defaultCostCenter,
            },
            ctx
          ),
        ]
      }

      const settings = (await B2BSettings.getB2BSettings(
        undefined,
        undefined,
        ctx
      )) as B2BSettingsInput

      if (
        notifyUsers &&
        settings?.transactionEmailSettings?.organizationCreated
      ) {
        message({
          storefrontPermissions,
          logger,
          mail,
        }).organizationCreated(name)
      }

      return {
        costCenterId: costCenterResult[0].id,
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
      input: {
        b2bCustomerAdmin,
        costCenters,
        defaultCostCenter,
        customFields,
        name,
        tradeName,
        priceTables,
        salesChannel,
        paymentTerms,
        sellers,
      },
      notifyUsers = true,
    }: { input: OrganizationInput; notifyUsers?: boolean },
    ctx: Context
  ) => {
    const {
      clients: { masterdata, storefrontPermissions, mail },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const now = new Date()

    const settings = (await B2BSettings.getB2BSettings(
      undefined,
      undefined,
      ctx
    )) as B2BSettingsInput

    const status = ORGANIZATION_REQUEST_STATUSES.PENDING

    paymentTerms =
      paymentTerms ??
      (settings?.defaultPaymentTerms as unknown as PaymentTerm[])
    priceTables =
      priceTables ?? (settings?.defaultPriceTables as unknown as Price[])

    if (!defaultCostCenter && costCenters?.length) {
      defaultCostCenter = costCenters.shift()
    }

    const organizationRequest = {
      name,
      ...(tradeName && { tradeName }),
      ...(priceTables && { priceTables }),
      ...(salesChannel && { salesChannel }),
      ...(paymentTerms && { paymentTerms }),
      ...(sellers && { sellers }),
      b2bCustomerAdmin,
      costCenters,
      created: now,
      customFields: customFields ?? [],
      defaultCostCenter,
      notes: '',
      status,
    }

    try {
      const result = (await masterdata.createDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: organizationRequest,
        schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
      })) as any

      if (settings?.autoApprove) {
        await Organizations.updateOrganizationRequest(
          _,
          {
            id: result.DocumentId,
            notes: 'Auto approved',
            notifyUsers,
            status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
          },
          ctx
        )
      }

      if (settings?.transactionEmailSettings?.organizationRequestCreated) {
        message({
          logger,
          mail,
          storefrontPermissions,
        }).organizationRequestCreated(
          organizationRequest.name,
          b2bCustomerAdmin.firstName,
          b2bCustomerAdmin.email,
          ''
        )
      }

      return {
        href: result.Href,
        id: result.DocumentId,
        status: organizationRequest.status,
      }
    } catch (error) {
      logger.error({
        error,
        message: 'createOrganizationRequest-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  createOrganizationAndCostCentersWithId: async (
    _: void,
    { input }: { input: NormalizedOrganizationInput },
    ctx: Context
  ): Promise<{
    href: string
    id: string
  }> => {
    const {
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      // create organization
      const { href, id } = await createOrganizationAndCostCenterWithAdminUser(
        _,
        input,
        ctx
      )

      return {
        href,
        id,
      }
    } catch (error) {
      logger.error({
        error,
        message: 'createOrganizationWitId-error',
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
      salesChannel,
      sellers,
      notifyUsers = true,
      permissions,
    }: {
      id: string
      name: string
      tradeName?: string
      status: string
      collections: any[]
      paymentTerms: any[]
      priceTables: any[]
      customFields: any[]
      salesChannel?: string
      sellers?: any[]
      notifyUsers?: boolean
      permissions?: Permissions
    },
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions, mail, masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const settings = (await B2BSettings.getB2BSettings(
      undefined,
      undefined,
      ctx
    )) as B2BSettingsInput

    let currentOrganizationData: Organization | undefined

    try {
      currentOrganizationData = await masterdata.getDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: ORGANIZATION_FIELDS,
        id,
      })

      if (
        currentOrganizationData?.status !== status &&
        notifyUsers &&
        settings?.transactionEmailSettings?.organizationStatusChanged
      ) {
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
      const fields = {
        collections,
        ...((tradeName || tradeName === '') && { tradeName }),
        customFields,
        name,
        paymentTerms,
        priceTables,
        ...(salesChannel && { salesChannel }),
        ...(sellers && { sellers }),
        status,
        permissions,
      }

      await masterdata.updatePartialDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields,
        id,
      })

      sendUpdateOrganizationMetric(ctx, logger, {
        account: ctx.vtex.account,
        currentOrganizationData,
        updatedProperties: fields,
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
    {
      id,
      status,
      notes,
      notifyUsers = true,
    }: { id: string; status: string; notes: string; notifyUsers: boolean },
    ctx: Context
  ) => {
    const {
      clients: { masterdata, mail, storefrontPermissions },
      vtex: { logger },
    } = ctx

    const settings = (await B2BSettings.getB2BSettings(
      undefined,
      undefined,
      ctx
    )) as B2BSettingsInput

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

    // if we reach this block, status is declined
    try {
      if (status === ORGANIZATION_REQUEST_STATUSES.APPROVED) {
        try {
          // the following copy is fine as organizationRequest does not contain fields that need transformation
          const normalizedOrganizationRequest = {
            ...organizationRequest,
          } as unknown as NormalizedOrganizationInput

          const { id: organizationId } =
            await createOrganizationAndCostCenterWithAdminUser(
              _,
              normalizedOrganizationRequest,
              ctx
            )

          if (
            notifyUsers &&
            settings?.transactionEmailSettings?.organizationApproved
          ) {
            message({
              logger,
              mail,
              storefrontPermissions,
            }).organizationApproved(
              organizationRequest.name,
              firstName,
              email,
              notes
            )
          }

          await masterdata.updatePartialDocument({
            dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
            fields: { status, notes },
            id,
          })

          sendOrganizationStatusMetric(ctx, logger, {
            account: ctx.vtex.account,
            status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
          })

          return { status: 'success', message: '', id: organizationId }
        } catch (e) {
          logger.error({
            error: e,
            message: 'updateOrganizationRequest-error',
          })
          if (e.message) {
            throw new GraphQLError(e.message)
          } else if (e.response?.data?.message) {
            throw new GraphQLError(e.response.data.message)
          } else {
            throw new GraphQLError(e)
          }
        }
      }

      // update request status to declined
      await masterdata.updatePartialDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: { status, notes },
        id,
      })

      if (
        notifyUsers &&
        settings?.transactionEmailSettings?.organizationDeclined
      ) {
        message({ storefrontPermissions, logger, mail }).organizationDeclined(
          organizationRequest.name,
          firstName,
          email,
          notes
        )
      }

      sendOrganizationStatusMetric(ctx, logger, {
        account: ctx.vtex.account,
        status: ORGANIZATION_REQUEST_STATUSES.DECLINED,
      })

      return { status: 'success', message: '' }
    } catch (e) {
      throw new GraphQLError(getErrorMessage(e))
    }
  },
}

export default Organizations
