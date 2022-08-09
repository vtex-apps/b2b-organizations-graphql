import {
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  ORGANIZATION_REQUEST_DATA_ENTITY,
  ORGANIZATION_REQUEST_FIELDS,
  ORGANIZATION_REQUEST_SCHEMA_VERSION,
  ORGANIZATION_SCHEMA_VERSION,
} from '../../mdSchema'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import checkConfig from '../config'

const getWhereByStatus = ({ status }: { status: string[] }) => {
  const whereArray = []

  if (status?.length) {
    const statusArray = [] as string[]

    status.forEach(stat => {
      statusArray.push(`status=${stat}`)
    })
    const statuses = `(${statusArray.join(' OR ')})`

    whereArray.push(statuses)
  }

  return whereArray
}

const Organizations = {
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
    } = sessionData.namespaces['storefront-permissions']

    if (!id) {
      // get user's organization from session
      id = userOrganizationId
    }

    if (id !== userOrganizationId) {
      throw new GraphQLError('operation-not-permitted')
    }

    try {
      return await masterdata.getDocument({
        dataEntity: ORGANIZATION_DATA_ENTITY,
        fields: ORGANIZATION_FIELDS,
        id,
      })
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
