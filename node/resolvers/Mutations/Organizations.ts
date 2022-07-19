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
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import checkConfig from '../config'
import message from '../message'

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
      vtex: { logger, adminUserAuthToken },
    } = ctx

    if (!adminUserAuthToken) {
      throw new GraphQLError('operation-not-permitted')
    }

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
        status: 'active',
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
      }

      await masterdata.createDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: costCenter,
        schema: COST_CENTER_SCHEMA_VERSION,
      })

      message({ storefrontPermissions, logger, mail }).organizationCreated(name)

      return {
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
      clients: { masterdata },
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

    if (duplicate !== '') {
      return { href: '', id: '', status: duplicate }
    }

    const now = new Date()

    const organizationRequest = {
      name,
      ...(tradeName && { tradeName }),
      b2bCustomerAdmin,
      created: now,
      defaultCostCenter,
      notes: '',
      status: 'pending',
    }

    try {
      const result = await masterdata.createDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: organizationRequest,
        schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
      })

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
    }: {
      id: string
      name: string
      tradeName?: string
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

    if (status !== 'approved' && status !== 'declined') {
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
    if (organizationRequest.status !== 'pending') {
      throw new GraphQLError('Organization request already processed')
    }

    const { email, firstName } = organizationRequest.b2bCustomerAdmin

    if (status === 'approved') {
      const now = new Date()

      try {
        // update request status to approved
        await masterdata.updatePartialDocument({
          dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
          fields: { status },
          id,
        })

        // create organization
        const organization = {
          name: organizationRequest.name,
          ...(organizationRequest.tradeName && {
            tradeName: organizationRequest.tradeName,
          }),
          collections: [],
          costCenters: [],
          created: now,
          paymentTerms: [],
          priceTables: [],
          status: 'active',
        }

        const createOrganizationResult = await masterdata.createDocument({
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: organization,
          schema: ORGANIZATION_SCHEMA_VERSION,
        })

        const organizationId = createOrganizationResult.DocumentId

        // create cost center
        const costCenter = {
          addresses: [organizationRequest.defaultCostCenter.address],
          name: organizationRequest.defaultCostCenter.name,
          organization: organizationId,
          ...(organizationRequest.defaultCostCenter.phoneNumber && {
            phoneNumber: organizationRequest.defaultCostCenter.phoneNumber,
          }),
          ...(organizationRequest.defaultCostCenter.businessDocument && {
            businessDocument:
              organizationRequest.defaultCostCenter.businessDocument,
          }),
        }

        const createCostCenterResult = await masterdata.createDocument({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: costCenter,
          schema: COST_CENTER_SCHEMA_VERSION,
        })

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
            return res[0]?.id
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
            costId: createCostCenterResult.DocumentId,
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

        if (addUserResult?.status === 'success') {
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

        // notify sales admin
        message({ storefrontPermissions, logger, mail }).organizationCreated(
          organizationRequest.name
        )

        return { status: 'success', message: '', id: organizationId }
      } catch (error) {
        logger.error({
          error,
          message: 'updateOrganizationRequest-error',
        })
        throw new GraphQLError(getErrorMessage(error))
      }
    }

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
