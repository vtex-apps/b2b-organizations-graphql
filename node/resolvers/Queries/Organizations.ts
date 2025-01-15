import {
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  ORGANIZATION_REQUEST_DATA_ENTITY,
  ORGANIZATION_REQUEST_FIELDS,
  ORGANIZATION_REQUEST_SCHEMA_VERSION,
  ORGANIZATION_SCHEMA_VERSION,
} from '../../mdSchema'
import type {
  GetOrganizationsByEmailWithStatus,
  Organization,
} from '../../typings'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import checkConfig from '../config'
import { organizationStatus } from '../fieldResolvers'

const getWhereByStatus = ({ status }: { status: string[] }) => {
  const whereArray = []

  if (status?.length) {
    const statusArray = [] as string[]

    status.forEach((stat) => {
      statusArray.push(`status=${stat}`)
    })
    const statuses = `(${statusArray.join(' OR ')})`

    whereArray.push(statuses)
  }

  return whereArray
}

const Organizations = {
  checkOrganizationIsActive: async (
    _: void,
    params: { id: string } | null,
    ctx: Context
  ) => {
    const {
      clients: { session },
      vtex: { logger, sessionToken, adminUserAuthToken },
    } = ctx

    const sessionData = await session
      .getSession(sessionToken as string, ['*'])
      .then((currentSession: any) => {
        return currentSession.sessionData
      })
      .catch((error: any) => {
        logger.warn({
          error,
          message: 'checkOrganizationIsActive-error',
        })

        return null
      })

    if (!sessionData) {
      throw new Error('No session data for this current user')
    }

    let orgId =
      sessionData?.namespaces?.['storefront-permissions']?.organization?.value

    if (params?.id && adminUserAuthToken) {
      orgId = params?.id
    }

    const organization = (await Organizations.getOrganizationById(
      _,
      { id: orgId },
      ctx
    )) as { status: string; permissions?: { createQuote: boolean } }

    if (!organization) {
      throw new Error('Organization not found')
    }

    return organization?.status === 'active'
  },

  getOrganizationById: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const org: Organization = await masterdata.getDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: ORGANIZATION_FIELDS,
        id,
      })

      return {
        ...org,
        // the previous data registered doesn't have this propertty on masterdata
        // so we need to add it to the response
        permissions: org.permissions ?? { createQuote: true },
      }
    } catch (error) {
      logger.error({ error, message: 'getOrganizationById-error' })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getOrganizations: async (
    _: void,
    {
      status,
      search,
      page,
      pageSize,
      sortOrder,
      sortedBy,
    }: {
      status: string[]
      search: string
      page: number
      pageSize: number
      sortOrder: string
      sortedBy: string
    },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const whereArray = getWhereByStatus({ status })

    if (search) {
      whereArray.push(`name="*${search}*"`)
    }

    const where = whereArray.join(' AND ')

    try {
      const organizationsDB =
        (await masterdata.searchDocumentsWithPaginationInfo({
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: ORGANIZATION_FIELDS,
          pagination: { page, pageSize },
          schema: ORGANIZATION_SCHEMA_VERSION,
          sort: `${sortedBy} ${sortOrder}`,
          ...(where && { where }),
        })) as {
          data: Organization[]
          pagination: { total: number; page: number; pageSize: number }
        }

      const mappedOrganizations = organizationsDB.data.map((org) => {
        return {
          ...org,
          // the previous data registered doesn't have this propertty on masterdata
          // so we need to add it to the response
          permissions: org.permissions ?? { createQuote: true },
        }
      })

      return {
        data: mappedOrganizations,
        pagination: organizationsDB.pagination,
      }
    } catch (error) {
      logger.error({
        error,
        message: 'getOrganizations-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getOrganizationsByEmail: async (
    _: void,
    { email }: { email: string },
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions, session },
      vtex: { logger, sessionToken, adminUserAuthToken },
    } = ctx

    const organizationFilters: string[] = []
    let fromSession = false

    const sessionData = await session
      .getSession(sessionToken as string, ['*'])
      .then((currentSession: any) => {
        return currentSession.sessionData
      })
      .catch((error: any) => {
        logger.warn({
          error,
          message: 'getOrganizationsByEmail-session-error',
        })

        return null
      })

    let checkUserPermission = null

    if (sessionData?.namespaces) {
      const checkUserPermissionResult = await storefrontPermissions
        .checkUserPermission('vtex.b2b-organizations@1.x')
        .catch((error: any) => {
          logger.error({
            error,
            message: 'checkUserPermission-error',
          })

          return {
            data: {
              checkUserPermission: null,
            },
          }
        })

      checkUserPermission = checkUserPermissionResult?.data?.checkUserPermission
    }

    if (
      (!adminUserAuthToken &&
        !checkUserPermission?.permissions.includes('add-sales-users-all')) ||
      !(email?.length > 0)
    ) {
      if (checkUserPermission?.permissions.includes('add-users-organization')) {
        const orgId =
          sessionData?.namespaces?.['storefront-permissions']?.organization
            ?.value

        if (!orgId) {
          throw new Error('No permission for getting the organizations')
        }

        organizationFilters.push(orgId)
      }

      if (!(email?.length > 0)) {
        email = sessionData?.namespaces?.profile?.email?.value
        fromSession = true
      }
    }

    const organizations = (
      await storefrontPermissions.getOrganizationsByEmail(email)
    ).data?.getOrganizationsByEmail?.filter(({ orgId }: { orgId: string }) => {
      return (
        fromSession ||
        (organizationFilters.length > 0
          ? organizationFilters.find((id: string) => orgId === id)
          : true)
      )
    })

    try {
      return organizations
    } catch (error) {
      logger.error({
        error,
        message: 'getOrganizationsByEmail-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getOrganizationsPaginatedByEmail: async (
    _: void,
    {
      email,
      page = 1,
      pageSize = 25,
    }: {
      email?: string
      page: number
      pageSize: number
    },
    {
      clients: { storefrontPermissions },
      vtex: { logger },
    }: any
  ) => {
    try {
      const { data: { getOrganizationsPaginatedByEmail } } =
        await storefrontPermissions.getOrganizationsPaginatedByEmail(
          email,
          page,
          pageSize
        )

      return getOrganizationsPaginatedByEmail;
    } catch (error) {
      logger.error({
        error,
        message: 'getOrganizationsPaginatedByEmail-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getActiveOrganizationsByEmail: async (
    _: void,
    { email }: { email: string },
    ctx: Context
  ) => {
    const {
      vtex: { logger },
    } = ctx

    const organizations = await Organizations.getOrganizationsByEmail(
      _,
      { email },
      ctx
    )

    const organizationsWithStatus: GetOrganizationsByEmailWithStatus[] =
      await Promise.all(
        organizations.map(async (organization: { orgId: string }) => {
          const status = await organizationStatus(
            { orgId: organization.orgId },
            _,
            ctx
          )

          return { ...organization, status }
        })
      )

    const activeOrganizations = organizationsWithStatus.filter(
      (organization) => organization.status === 'active'
    )

    try {
      return activeOrganizations
    } catch (error) {
      logger.error({
        error,
        message: 'getActiveOrganizationsByEmail-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getOrganizationByIdStorefront: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { sessionData, logger },
    } = ctx as any

    // create schema if it doesn't exist
    await checkConfig(ctx)

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

    if (!id) {
      // get user's organization from session
      id = userOrganizationId
    }

    if (id !== userOrganizationId) {
      throw new GraphQLError('operation-not-permitted')
    }

    const organization: Organization = await masterdata.getDocument({
      dataEntity: ORGANIZATION_DATA_ENTITY,
      fields: ORGANIZATION_FIELDS,
      id,
    })

    if (organization?.status !== 'active') {
      throw new Error('This organization is not active')
    }

    try {
      return {
        ...organization,
        permissions: organization.permissions ?? { createQuote: true },
      }
    } catch (error) {
      logger.error({
        error,
        message: 'getOrganizationByIdStorefront-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getOrganizationRequestById: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      return await masterdata.getDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: ORGANIZATION_REQUEST_FIELDS,
        id,
      })
    } catch (error) {
      logger.error({
        error,
        message: 'getOrganizationRequestById-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getOrganizationRequests: async (
    _: void,
    {
      status,
      search,
      page,
      pageSize,
      sortOrder,
      sortedBy,
    }: {
      status: string[]
      search: string
      page: number
      pageSize: number
      sortOrder: string
      sortedBy: string
    },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)
    const whereArray = getWhereByStatus({ status })

    if (search) {
      if (search.match(/[a-z\d]+@[a-z]+\.[a-z]{2,3}/gm)) {
        whereArray.push(`b2bCustomerAdmin.email=${search}`)
      } else {
        whereArray.push(`name="*${search}*"`)
      }
    }

    const where = whereArray.join(' AND ')

    try {
      return await masterdata.searchDocumentsWithPaginationInfo({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: ORGANIZATION_REQUEST_FIELDS,
        pagination: { page, pageSize },
        schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
        sort: `${sortedBy} ${sortOrder}`,
        ...(where && { where }),
      })
    } catch (error) {
      logger.error({
        error,
        message: 'getOrganizationRequests-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },
}

export default Organizations
