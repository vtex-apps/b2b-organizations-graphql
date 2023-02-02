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

const Organizations = {
  createOrganization: async (
    _: void,
    {
      input: {
        name,
        tradeName,
        defaultCostCenter,
        costCenters,
        paymentTerms,
        priceTables,
        salesChannel,
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

    try {
      // create organization
      const organization = {
        name,
        ...(tradeName && { tradeName }),
        collections: [],
        costCenters: [],
        created: now,
        ...(paymentTerms?.length && { paymentTerms }),
        ...(priceTables?.length && { priceTables }),
        ...(salesChannel && { salesChannel }),
        status: ORGANIZATION_STATUSES.ACTIVE,
      }

      const createOrganizationResult = await masterdata.createDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: organization,
        schema: ORGANIZATION_SCHEMA_VERSION,
      })

      const organizationId = createOrganizationResult.DocumentId

      const createCostCenter = async (data: any) => {
        // create cost center
        const costCenter = {
          addresses: [data?.address],
          name: data?.name,
          organization: organizationId,
          ...(data?.phoneNumber && {
            phoneNumber: data?.phoneNumber,
          }),
          ...(data?.businessDocument && {
            businessDocument: data?.businessDocument,
          }),
          ...(data?.stateRegistration && {
            stateRegistration: data?.stateRegistration,
          }),
        }

        return masterdata.createDocument({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: costCenter,
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      }

      let costCenterResult: any[] = []

      if (!defaultCostCenter && costCenters?.length) {
        costCenterResult = await Promise.all(
          costCenters?.map(async (costCenter: any) =>
            createCostCenter(costCenter)
          )
        )
      } else {
        costCenterResult = [await createCostCenter(defaultCostCenter)]
      }

      if (notifyUsers) {
        message({ storefrontPermissions, logger, mail }).organizationCreated(
          name
        )
      }

      return {
        costCenterId: costCenterResult[0].DocumentId,
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
        name,
        tradeName,
        priceTables,
        salesChannel,
        paymentTerms,
      },
      notifyUsers = true,
    }: { input: OrganizationInput; notifyUsers?: boolean },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
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
      ((settings?.defaultPaymentTerms as unknown) as PaymentTerm[])
    priceTables =
      priceTables ?? ((settings?.defaultPriceTables as unknown) as Price[])

    const organizationRequest = {
      name,
      ...(tradeName && { tradeName }),
      ...(priceTables && { priceTables }),
      ...(salesChannel && { salesChannel }),
      ...(paymentTerms && { paymentTerms }),
      b2bCustomerAdmin,
      costCenters,
      created: now,
      defaultCostCenter:
        defaultCostCenter ?? (costCenters?.length && costCenters[0]),
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
      salesChannel,
      sellers,
      notifyUsers = true,
    }: {
      id: string
      name: string
      tradeName?: string
      status: string
      collections: any[]
      paymentTerms: any[]
      priceTables: any[]
      salesChannel?: string
      sellers?: any[]
      notifyUsers?: boolean
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

      if (currentData.status !== status && notifyUsers) {
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
          ...(salesChannel && { salesChannel }),
          ...(sellers && { sellers }),
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

    const { email, firstName, lastName } = organizationRequest.b2bCustomerAdmin

    // if we reach this block, status is declined
    try {
      if (status === ORGANIZATION_REQUEST_STATUSES.APPROVED) {
        try {
          const {
            paymentTerms,
            priceTables,
            salesChannel,
            defaultCostCenter,
            name,
            tradeName,
          } = organizationRequest

          const {
            costCenterId,
            id: organizationId,
          } = await Organizations.createOrganization(
            _,
            {
              input: {
                ...(tradeName && {
                  tradeName,
                }),
                b2bCustomerAdmin: {
                  email,
                  firstName,
                  lastName,
                },
                defaultCostCenter: {
                  address: defaultCostCenter.address,
                  name: defaultCostCenter.name,
                  ...(defaultCostCenter.phoneNumber && {
                    phoneNumber: defaultCostCenter.phoneNumber,
                  }),
                  ...(defaultCostCenter.businessDocument && {
                    businessDocument: defaultCostCenter.businessDocument,
                  }),
                },
                name,
                paymentTerms,
                priceTables,
                salesChannel,
              },
              notifyUsers,
            },
            ctx
          )

          // get roleId of org admin
          const roles = await storefrontPermissions
            .listRoles()
            .then((result: any) => {
              return result.data.listRoles
            })

          const roleId = roles.find(
            (roleItem: any) => roleItem.slug === 'customer-admin'
          ).id

          // check if user already exists in CL
          let existingUser = {} as any
          const clId = await masterdata
            .searchDocuments({
              dataEntity: 'CL',
              fields: ['id'],
              pagination: {
                page: 1,
                pageSize: 1,
              },
              where: `email=${email}`,
            })
            .then((res: any) => {
              return res[0]?.id ?? undefined
            })
            .catch(() => undefined)

          // check if user already exists in storefront-permissions
          if (clId) {
            await storefrontPermissions
              .getUser(clId)
              .then((result: any) => {
                existingUser = result?.data?.getUser ?? {}
              })
              .catch(() => null)
          }

          // grant user org admin role, assign org and cost center
          const addUserResult = await storefrontPermissions
            .saveUser({
              ...existingUser,
              costId: costCenterId,
              email,
              name: existingUser?.name || firstName,
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

          if (addUserResult?.status === 'success' && notifyUsers) {
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
            fields: { status },
            id,
          })

          if (notifyUsers) {
            // notify sales admin
            message({
              storefrontPermissions,
              logger,
              mail,
            }).organizationCreated(organizationRequest.name)
          }

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

      if (notifyUsers) {
        message({ storefrontPermissions, logger, mail }).organizationDeclined(
          organizationRequest.name,
          firstName,
          email,
          notes
        )
      }

      return { status: 'success', message: '' }
    } catch (e) {
      throw new GraphQLError(getErrorMessage(e))
    }
  },
}

export default Organizations
