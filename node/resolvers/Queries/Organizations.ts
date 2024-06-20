import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
  COST_CENTER_SCHEMA_VERSION,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  ORGANIZATION_REQUEST_DATA_ENTITY,
  ORGANIZATION_REQUEST_FIELDS,
  ORGANIZATION_REQUEST_SCHEMA_VERSION,
  ORGANIZATION_SCHEMA_VERSION,
} from '../../mdSchema'
import { CostCenter, Organization } from '../../typings'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import checkConfig from '../config'

const getWhereByStatus = ({ status }: { status: string[] }) => {
  const whereArray = []

  if (status?.length) {
    const statusArray = [] as string[]

    status.forEach((stat: string) => {
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
    )) as {
      status: string
    }

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
      return await masterdata.getDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: ORGANIZATION_FIELDS,
        id,
      })
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
      document,
      page,
      pageSize,
      sortOrder,
      sortedBy,
    }: {
      status: string[]
      search: string | null
      document: string | null
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

    if (document) {
      const documentFormatted = formatDocument(document)
      try {
        const where = `businessDocument="*${documentFormatted}*"`
        const costCenterData = await masterdata.searchDocumentsWithPaginationInfo({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: COST_CENTER_FIELDS,
          pagination: { page, pageSize },
          schema: COST_CENTER_SCHEMA_VERSION,
          sort: `${sortedBy} ${sortOrder}`,
          ...(where && { where }),
        })

        const data = costCenterData.data as CostCenter[]

        const getOrganizationFromCostCenter = async (costCenter: CostCenter) => {
          const organizations: Organization[] = await masterdata.searchDocuments({
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: ORGANIZATION_FIELDS,
            pagination: { page: 1, pageSize: 25},
            schema: ORGANIZATION_SCHEMA_VERSION,
            sort: `${sortedBy} ${sortOrder}`,
            where: `id="${costCenter.organization}"`,
          })

          if (organizations.length === 0) {
            throw new Error("No organization found")
          }

          if (organizations.length > 1) {
            throw new Error("More than one organization found")
          }

          return organizations[0]
        }

        const orgs = await Promise.all(data.map(getOrganizationFromCostCenter))

        return {
          data: orgs,
          pagination: costCenterData.pagination,
        }
      } catch (error) {
        logger.error({
          error,
          message: 'getCostCenters-error',
        })
        throw new GraphQLError(getErrorMessage(error))
      }
    }
    
    if (search) {
      whereArray.push(
        `(name="*${search}*" OR tradeName="*${search}*" OR id="*${search}*")`
      )
    }

    const where = whereArray.join(' AND ')

    try {
      return await masterdata.searchDocumentsWithPaginationInfo({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: ORGANIZATION_FIELDS,
        pagination: { page, pageSize },
        schema: ORGANIZATION_SCHEMA_VERSION,
        sort: `${sortedBy} ${sortOrder}`,
        ...(where && { where }),
      })
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
    {
      clients: { storefrontPermissions, session },
      vtex: { logger, sessionToken, adminUserAuthToken },
    }: any
  ) => {
    const organizationFilters: string[] = []
    let fromSession = false
    const {
      data: { checkUserPermission },
    }: any = await storefrontPermissions
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

    if (
      (!adminUserAuthToken &&
        !checkUserPermission?.permissions.includes('add-sales-users-all')) ||
      !(email?.length > 0)
    ) {
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

    const organization = await masterdata.getDocument({
      dataEntity: ORGANIZATION_DATA_ENTITY,
      fields: ORGANIZATION_FIELDS,
      id,
    })

    if (organization?.status !== 'active') {
      throw new Error('This organization is not active')
    }

    try {
      return organization
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
        whereArray.push(
          `(name="*${search}*" OR tradeName="*${search}*" OR id="*${search}*")`
        )
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

function formatDocument(document: string): string {
  const documentFormatRemoved = document.replace(/[^0-9]/gu, '');

  const documentArray = documentFormatRemoved.split('');

  const formattedDocument = documentArray.map((char, index) => {
    if (index === 2 || index === 5) {
      return `.${char}`;
    }
    if (index === 8) {
      return `/${char}`;
    }
    if (index === 12) {
      return `-${char}`;
    }
    return char;
  });

  return formattedDocument.join('');
}

export default Organizations
