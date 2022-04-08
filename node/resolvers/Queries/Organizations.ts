import {
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  ORGANIZATION_REQUEST_DATA_ENTITY,
  ORGANIZATION_REQUEST_FIELDS,
  ORGANIZATION_REQUEST_SCHEMA_VERSION,
  ORGANIZATION_SCHEMA_VERSION,
} from '../../mdSchema'
import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'

const Organizations = {
  getOrganizationById: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const organization = await masterdata.getDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: ORGANIZATION_FIELDS,
        id,
      })

      return organization
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

    const whereArray = []

    if (status?.length) {
      const statusArray = [] as string[]

      status.forEach(stat => {
        statusArray.push(`status=${stat}`)
      })
      const statuses = `(${statusArray.join(' OR ')})`

      whereArray.push(statuses)
    }

    if (search) {
      whereArray.push(`name="*${search}*"`)
    }

    const where = whereArray.join(' AND ')

    try {
      const organizations = await masterdata.searchDocumentsWithPaginationInfo({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: ORGANIZATION_FIELDS,
        pagination: { page, pageSize },
        schema: ORGANIZATION_SCHEMA_VERSION,
        sort: `${sortedBy} ${sortOrder}`,
        ...(where && { where }),
      })

      return organizations
    } catch (e) {
      logger.error({
        error: e,
        message: 'getOrganizations-error',
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

  getOrganizationByIdStorefront: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const { sessionData } = vtex as any

    if (!sessionData?.namespaces['storefront-permissions']) {
      throw new GraphQLError('organization-data-not-found')
    }

    const {
      organization: { value: userOrganizationId },
    } = sessionData.namespaces['storefront-permissions']

    if (!id) {
      // get user's organization from session
      id = userOrganizationId
    }

    if (id !== userOrganizationId) {
      throw new GraphQLError('operation-not-permitted')
    }

    try {
      const organization = await masterdata.getDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: ORGANIZATION_FIELDS,
        id,
      })

      return organization
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

  getOrganizationRequestById: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const organizationRequest = await masterdata.getDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: ORGANIZATION_REQUEST_FIELDS,
        id,
      })

      return organizationRequest
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

    const whereArray = []

    if (status?.length) {
      const statusArray = [] as string[]

      status.forEach(stat => {
        statusArray.push(`status=${stat}`)
      })
      const statuses = `(${statusArray.join(' OR ')})`

      whereArray.push(statuses)
    }

    if (search) {
      whereArray.push(`name="*${search}*"`)
    }

    const where = whereArray.join(' AND ')

    try {
      const organizationRequests = await masterdata.searchDocumentsWithPaginationInfo(
        {
          dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
          fields: ORGANIZATION_REQUEST_FIELDS,
          schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
          pagination: { page, pageSize },
          sort: `${sortedBy} ${sortOrder}`,
          ...(where && { where }),
        }
      )

      return organizationRequests
    } catch (e) {
      logger.error({
        message: 'getOrganizationRequests-error',
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

export default Organizations
