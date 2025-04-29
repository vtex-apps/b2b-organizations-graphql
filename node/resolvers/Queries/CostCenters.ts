import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
  COST_CENTER_SCHEMA_VERSION,
} from '../../mdSchema'
import type { Address, CostCenter } from '../../typings'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import checkConfig from '../config'
import Organizations from './Organizations'

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
  } catch (error) {
    throw new GraphQLError(getErrorMessage(error))
  }
}

const hashCode = function hash(arg: null | string | number | number[]) {
  const str = arg === null ? '' : arg.toString()

  if (str.length === 0) {
    return 0
  }

  return str.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
}

const setGUID = (address: Address) => {
  return (
    hashCode(address.street) +
    hashCode(address.complement) +
    hashCode(address.city) +
    hashCode(address.state)
  ).toString()
}

const addMissingAddressIds = async (costCenter: CostCenter, ctx: Context) => {
  const {
    clients: { masterdata },
  } = ctx

  let changed = false
  const { addresses } = costCenter

  for (const [index, address] of addresses.entries()) {
    if (!address.addressId) {
      addresses[index].addressId = setGUID(address)
      changed = true
    }
  }

  if (changed) {
    await masterdata.createOrUpdatePartialDocument({
      dataEntity: COST_CENTER_DATA_ENTITY,
      fields: { addresses },
      id: costCenter.id,
    })
  }

  return addresses
}

const costCenters = {
  getCostCenterById: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { masterdata },
      vtex: { logger },
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    try {
      const result: CostCenter = await masterdata.getDocument({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: COST_CENTER_FIELDS,
        id,
      })

      /* MasterData client returns empty string when it doesn't find the document */
      if ((result as unknown as string) !== '') {
        result.addresses = await addMissingAddressIds(result, ctx)
      }

      return result
    } catch (error) {
      logger.error({ error, message: 'getCostCenterById-error' })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getCostCenterByIdStorefront: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      clients: { masterdata },
      vtex: { logger },
      vtex,
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    if (!(await Organizations.checkOrganizationIsActive(_, null, ctx))) {
      throw new Error('This organization is not active')
    }

    const { sessionData } = vtex as any

    if (!sessionData?.namespaces['storefront-permissions']) {
      throw new GraphQLError('organization-data-not-found')
    }

    const {
      organization: { value: userOrganizationId },
      costcenter: { value: userCostCenterId },
    } = sessionData.namespaces['storefront-permissions'] ?? {
      organization: {
        value: null,
      },
      costcenter: {
        value: null,
      },
    }

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
        const error = () => {
          throw new GraphQLError('operation-not-permitted')
        }

        error()
      }

      costCenter.addresses = await addMissingAddressIds(costCenter, ctx)

      return costCenter
    } catch (error) {
      logger.error({ error, message: 'getCostCenterByIdStorefront-error' })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getPaymentTerms: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { payments },
      vtex: { logger },
    } = ctx

    try {
      return await payments.getPaymentTerms()
    } catch (error) {
      logger.error({ error, message: 'getPaymentTerms-error' })
      throw new GraphQLError(getErrorMessage(error))
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
      where = `name="*${search}*" OR businessDocument="*${search}*"`
    }

    try {
      return await masterdata.searchDocumentsWithPaginationInfo({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: COST_CENTER_FIELDS,
        pagination: { page, pageSize },
        schema: COST_CENTER_SCHEMA_VERSION,
        sort: `${sortedBy} ${sortOrder}`,
        ...(where && { where }),
      })
    } catch (error) {
      logger.error({
        error,
        message: 'getCostCenters-error',
      })
      throw new GraphQLError(getErrorMessage(error))
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
    } catch (error) {
      logger.error({
        error,
        message: 'getCostCentersByOrganizationId-error',
      })
      throw error
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
      clients: { masterdata, storefrontPermissions },
      vtex: { logger, sessionData },
    } = ctx as any

    // create schema if it doesn't exist
    await checkConfig(ctx)

    if (!(await Organizations.checkOrganizationIsActive(_, null, ctx))) {
      throw new Error('This organization is not active')
    }

    let checkUserPermission = null

    if (sessionData?.namespaces) {
      const checkUserPermissionResult = await storefrontPermissions
        .checkUserPermission('vtex.b2b-organizations@2.x')
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

    const isSalesAdmin = checkUserPermission?.role.slug.match(/sales-admin/)

    if (!isSalesAdmin) {
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
    } catch (error) {
      logger.error({
        error,
        message: 'getCostCentersByOrganizationId-error',
      })
      throw error
    }
  },
}

export default costCenters
