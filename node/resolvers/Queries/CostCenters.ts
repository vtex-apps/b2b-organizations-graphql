import { CREDIT_CARDS } from '../../constants'
import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
  COST_CENTER_SCHEMA_VERSION,
} from '../../mdSchema'
import GraphQLError from '../../utils/GraphQLError'
import checkConfig from '../config'

const getCostCenters = async ({
  id,
  masterdata,
  page,
  pageSize,
  search,
  sortOrder,
  sortedBy,
}: any) => {
  const searchClause = search ? ` AND name="*${search}*"` : ''
  const where = `organization=${id}${searchClause}`

  try {
    return await masterdata.searchDocumentsWithPaginationInfo({
      dataEntity: COST_CENTER_DATA_ENTITY,
      fields: COST_CENTER_FIELDS,
      pagination: { page, pageSize },
      schema: COST_CENTER_SCHEMA_VERSION,
      sort: `${sortedBy} ${sortOrder}`,
      ...(where && { where }),
    })
  } catch (e) {
    if (e.message) {
      throw new GraphQLError(e.message)
    } else if (e.response?.data?.message) {
      throw new GraphQLError(e.response.data.message)
    } else {
      throw new GraphQLError(e)
    }
  }
}

const costCenters = {
  getCostCenterById: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      return await masterdata.getDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: COST_CENTER_FIELDS,
        id,
      })
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

  getCostCenterByIdStorefront: async (
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
      costcenter: { value: userCostCenterId },
    } = sessionData.namespaces['storefront-permissions']

    if (!id) {
      // get user's organization from session
      id = userCostCenterId
    }

    try {
      const costCenter: CostCenter = await masterdata.getDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: COST_CENTER_FIELDS,
        id,
      })

      if (costCenter.organization !== userOrganizationId) {
        throw new GraphQLError('operation-not-permitted')
      }

      return costCenter
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

  getPaymentTerms: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { payments },
    } = ctx

    try {
      const paymentRules = await payments.rules()

      const enabledConnectors = paymentRules.filter(
        rule => rule.enabled === true
      )

      const enabledPaymentSystems = enabledConnectors.map(
        connector => connector.paymentSystem
      )

      const uniquePaymentSystems = enabledPaymentSystems.filter(
        (value, index, self) => {
          return (
            index ===
            self.findIndex(t => t.id === value.id && t.name === value.name)
          )
        }
      )

      const uniquePaymentSystemsWithoutCreditCards = uniquePaymentSystems.filter(
        value => {
          return !CREDIT_CARDS.includes(value.name)
        }
      )

      uniquePaymentSystemsWithoutCreditCards.unshift({
        name: 'Credit card',
        id: 999999,
        implementation: null,
      })

      return uniquePaymentSystemsWithoutCreditCards
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

  getCostCenters: async (
    _: void,
    {
      search,
      page,
      pageSize,
      sortOrder,
      sortedBy,
    }: {
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

    let where = ''

    if (search) {
      where = `name="*${search}*"`
    }

    try {
      return await masterdata.searchDocumentsWithPaginationInfo({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: COST_CENTER_FIELDS,
        schema: COST_CENTER_SCHEMA_VERSION,
        pagination: { page, pageSize },
        sort: `${sortedBy} ${sortOrder}`,
        ...(where && { where }),
      })
    } catch (e) {
      logger.error({
        message: 'getCostCenters-error',
        e,
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

  getCostCentersByOrganizationId: async (
    _: void,
    {
      id,
      search,
      page,
      pageSize,
      sortOrder,
      sortedBy,
    }: {
      id: string
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

    try {
      return await getCostCenters({
        id,
        masterdata,
        page,
        pageSize,
        search,
        sortOrder,
        sortedBy,
      })
    } catch (e) {
      logger.error({
        message: 'getCostCentersByOrganizationId-error',
        e,
      })
      throw e
    }
  },

  getCostCentersByOrganizationIdStorefront: async (
    _: void,
    {
      id,
      search,
      page,
      pageSize,
      sortOrder,
      sortedBy,
    }: {
      id: string
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
      vtex: { logger, sessionData },
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
      return await getCostCenters({
        id,
        masterdata,
        page,
        pageSize,
        search,
        sortOrder,
        sortedBy,
      })
    } catch (e) {
      logger.error({
        message: 'getCostCentersByOrganizationId-error',
        e,
      })
      throw e
    }
  },
}

export default costCenters
