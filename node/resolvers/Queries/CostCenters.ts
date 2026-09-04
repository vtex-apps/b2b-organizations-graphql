import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
  COST_CENTER_SCHEMA_VERSION,
} from '../../mdSchema'
import type { Address, CostCenter } from '../../typings'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import { describeClientError } from '../../utils/clientError'
import {
  auditQueryEvent,
  ensureConfigForQuery,
  withQueryTimings,
} from '../../utils/queryObservability'
import { loadCostCenter } from '../../services/organizationDocuments'
import { sendCostCenterMismatchMetric } from '../../utils/metrics/costCenter'
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
      vtex: { logger },
      ip,
    } = ctx

    ensureConfigForQuery(ctx)

    return withQueryTimings({
      ctx,
      extra: { costId: id },
      message: 'getCostCenterById.timings',
      run: async (timer) => {
        try {
          const cached: CostCenter = await timer.track(
            'getDocument',
            loadCostCenter(ctx, id)
          )

          // Clone so address-id backfill cannot mutate the cached snapshot.
          const result: CostCenter = {
            ...cached,
            addresses: cached.addresses?.map((address) => ({ ...address })),
          }

          if (result?.addresses) {
            result.addresses = await addMissingAddressIds(result, ctx)
          }

          auditQueryEvent(ctx, {
            subjectId: 'get-cost-center-by-id-event',
            operation: 'GET_COST_CENTER_BY_ID',
            meta: {
              entityName: 'CostCenter',
              remoteIpAddress: ip,
              entityBeforeAction: JSON.stringify({}),
              entityAfterAction: JSON.stringify({}),
            },
          })

          return result
        } catch (error) {
          logger.error({
            error: describeClientError(error),
            message: 'getCostCenterById-error',
          })
          throw new GraphQLError(getErrorMessage(error))
        }
      },
    })
  },

  getCostCenterByIdStorefront: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      vtex: { logger },
      ip,
      vtex,
    } = ctx

    ensureConfigForQuery(ctx)

    if (!(await Organizations.checkOrganizationIsActive(_, null, ctx))) {
      throw new Error('This organization is not active')
    }

    const { sessionData } = vtex as any

    if (!sessionData?.namespaces?.['storefront-permissions']) {
      throw new GraphQLError('organization-data-not-found')
    }

    const {
      organization: { value: userOrganizationId },
      costcenter: { value: userCostCenterId },
    } = sessionData.namespaces?.['storefront-permissions'] ?? {
      organization: {
        value: null,
      },
      costcenter: {
        value: null,
      },
    }

    /**
     * Read for diagnostics only - never for the authorization decision below.
     * `public` is a client-writable session namespace, so trusting it to grant
     * access to a cost center would let any shopper name someone else's.
     */
    const pendingCostCenterId =
      sessionData.namespaces?.public?.b2bCurrentCostCenter?.value ?? null

    if (!id) {
      id = userCostCenterId
    }

    try {
      const cached: CostCenter = await loadCostCenter(ctx, id)

      const costCenter: CostCenter = {
        ...cached,
        addresses: cached.addresses?.map((address) => ({ ...address })),
      }

      if (costCenter.organization !== userOrganizationId) {
        /**
         * This rejection is suspected to be mostly a race rather than a real
         * permission problem: `setCurrentOrganization` writes the shopper's new
         * selection to `public.b2bCurrentCostCenter` synchronously, but
         * `storefront-permissions.organization` only catches up on the next
         * session transform. A storefront that queries in between asks for a
         * cost center the session does not yet know about.
         *
         * `matchesPendingSelection` settles that in one line, with no
         * cross-app join: true means the shopper had just selected exactly this
         * cost center and the session had not caught up (the race), false means
         * something asked for a cost center the shopper never selected (a real
         * permission failure, or a caller bug). Correlating by `operationId`
         * does not work here - it does not survive the hop into
         * storefront-permissions - and log sampling makes timestamp proximity
         * meaningless at this volume.
         *
         * Ids only, no shopper identifiers.
         */
        const mismatch = {
          costCenterOrganization: costCenter.organization ?? null,
          matchesPendingSelection:
            !!pendingCostCenterId && pendingCostCenterId === id,
          pendingCostCenterId,
          requestedCostCenterId: id ?? null,
          /**
           * Namespace names only, no values. This app declares no
           * `vtex.session` configuration of its own, so whether the `public`
           * namespace comes back at all is unverified - without this, a null
           * `pendingCostCenterId` would be ambiguous between "the shopper had
           * not selected this cost center" and "we cannot see that namespace",
           * and the beta would answer neither.
           */
          sessionNamespaces: Object.keys(sessionData.namespaces ?? {}),
          sessionCostCenterId: userCostCenterId ?? null,
          sessionOrganization: userOrganizationId ?? null,
        }

        // The debugging surface. Sampled 1:20 by the IO pipeline, so it shows
        // individual cases but cannot be counted - the metric below is what
        // answers the question.
        logger.warn({
          ...mismatch,
          message: 'getCostCenterByIdStorefront-organizationMismatch',
        })

        // The measuring surface: not sampled, lands in
        // vtex.schemaless.b2b_suite_buyerorg_data_raw.
        sendCostCenterMismatchMetric(ctx, logger, mismatch)

        throw new GraphQLError('operation-not-permitted')
      }

      if (costCenter.addresses) {
        costCenter.addresses = await addMissingAddressIds(costCenter, ctx)
      }

      auditQueryEvent(ctx, {
        subjectId: 'get-cost-center-by-id-storefront-event',
        operation: 'GET_COST_CENTER_BY_ID_STOREFRONT',
        meta: {
          entityName: 'CostCenter',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return costCenter
    } catch (error) {
      logger.error({
        error: describeClientError(error),
        message: 'getCostCenterByIdStorefront-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },

  getPaymentTerms: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { payments },
      vtex: { logger },
      ip,
    } = ctx

    try {
      auditQueryEvent(ctx, {
        subjectId: 'get-payment-terms-event',
        operation: 'GET_PAYMENT_TERMS',
        meta: {
          entityName: 'PaymentTerms',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return await payments.getPaymentTerms()
    } catch (error) {
      logger.error({
        error: describeClientError(error),
        message: 'getPaymentTerms-error',
      })
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
      ip,
    } = ctx

    ensureConfigForQuery(ctx)

    let where = ''

    if (search) {
      where = `name="*${search}*" OR businessDocument="*${search}*"`
    }

    try {
      const result = await masterdata.searchDocumentsWithPaginationInfo({
        dataEntity: COST_CENTER_DATA_ENTITY,
        fields: COST_CENTER_FIELDS,
        pagination: { page, pageSize },
        schema: COST_CENTER_SCHEMA_VERSION,
        sort: `${sortedBy} ${sortOrder}`,
        ...(where && { where }),
      })

      auditQueryEvent(ctx, {
        subjectId: 'get-cost-centers-event',
        operation: 'GET_COST_CENTERS',
        meta: {
          entityName: 'CostCenters',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return result
    } catch (error) {
      logger.error({
        error: describeClientError(error),
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
      ip,
    } = ctx

    ensureConfigForQuery(ctx)

    try {
      auditQueryEvent(ctx, {
        subjectId: 'get-cost-centers-by-organization-id-event',
        operation: 'GET_COST_CENTERS_BY_ORGANIZATION_ID',
        meta: {
          entityName: 'CostCenters',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

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
        error: describeClientError(error),
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
      ip,
    } = ctx as any

    ensureConfigForQuery(ctx)

    if (!(await Organizations.checkOrganizationIsActive(_, null, ctx))) {
      throw new Error('This organization is not active')
    }

    let checkUserPermission = null

    if (sessionData?.namespaces) {
      const checkUserPermissionResult = await storefrontPermissions
        .checkUserPermission('vtex.b2b-organizations@3.x')
        .catch((error: any) => {
          logger.error({
            error: describeClientError(error),
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
      if (!sessionData?.namespaces?.['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
      } = sessionData.namespaces?.['storefront-permissions'] ?? {
        organization: {
          value: null,
        },
      }

      if (!id) {
        id = userOrganizationId
      }

      if (id !== userOrganizationId) {
        throw new GraphQLError('operation-not-permitted')
      }
    }

    try {
      auditQueryEvent(ctx, {
        subjectId: 'get-cost-centers-by-organization-id-storefront-event',
        operation: 'GET_COST_CENTERS_BY_ORGANIZATION_ID_STOREFRONT',
        meta: {
          entityName: 'CostCenters',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

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
        error: describeClientError(error),
        message: 'getCostCentersByOrganizationId-error',
      })
      throw error
    }
  },
}

export default costCenters
