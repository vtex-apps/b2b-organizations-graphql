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
import { describeClientError } from '../../utils/clientError'
import {
  auditQueryEvent,
  ensureConfigForQuery,
  withQueryTimings,
} from '../../utils/queryObservability'
import {
  hydrateOrganizationsByEmail,
  getOrganizationStatusFromState,
  loadOrganization,
} from '../../services/organizationDocuments'
import { ORGANIZATION_STATUSES } from '../../utils/constants'

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

type HydrateOptions = { costCenters?: boolean; organizations?: boolean }

/**
 * Shared SFP list + optional MD hydrate. Kept out of the GraphQL resolver
 * signature so a 4th `info` argument is never mistaken for options.
 */
// eslint-disable-next-line max-params
const listOrganizationsByEmail = async (
  email: string,
  ctx: Context,
  timer: { track: <T>(step: string, promise: Promise<T>) => Promise<T> },
  hydrateOptions?: HydrateOptions
) => {
  const {
    clients: { storefrontPermissions, session },
    vtex: { logger, sessionToken, adminUserAuthToken },
  } = ctx

  const organizationFilters: string[] = []
  let fromSession = false
  let resolvedEmail = email

  const sessionData = await timer.track(
    'session',
    session
      .getSession(sessionToken as string, ['*'])
      .then((currentSession: any) => {
        return currentSession.sessionData
      })
      .catch((error: any) => {
        logger.warn({
          error: describeClientError(error),
          message: 'getOrganizationsByEmail-session-error',
        })

        return null
      })
  )

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

  if (
    (!adminUserAuthToken &&
      !checkUserPermission?.permissions.includes('add-sales-users-all')) ||
    !(resolvedEmail?.length > 0)
  ) {
    if (checkUserPermission?.permissions.includes('add-users-organization')) {
      const orgId =
        sessionData?.namespaces?.['storefront-permissions']?.organization?.value

      if (!orgId) {
        throw new Error('No permission for getting the organizations')
      }

      organizationFilters.push(orgId)
    }

    if (!(resolvedEmail?.length > 0)) {
      resolvedEmail = sessionData?.namespaces?.profile?.email?.value
      fromSession = true
    }
  }

  const organizations = (
    await timer.track(
      'storefrontPermissions',
      storefrontPermissions.getOrganizationsByEmail(resolvedEmail)
    )
  ).data?.getOrganizationsByEmail?.filter(({ orgId }: { orgId: string }) => {
    return (
      fromSession ||
      (organizationFilters.length > 0
        ? organizationFilters.find((id: string) => orgId === id)
        : true)
    )
  })

  await timer.track(
    'hydrate',
    hydrateOrganizationsByEmail(ctx, organizations ?? [], hydrateOptions)
  )

  return organizations
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
      ip,
    } = ctx

    const sessionData = await session
      .getSession(sessionToken as string, ['*'])
      .then((currentSession: any) => {
        return currentSession.sessionData
      })
      .catch((error: any) => {
        logger.warn({
          error: describeClientError(error),
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

    auditQueryEvent(ctx, {
      subjectId: 'check-organization-is-active-event',
      operation: 'CHECK_ORGANIZATION_IS_ACTIVE',
      meta: {
        entityName: 'Organization',
        remoteIpAddress: ip,
        entityBeforeAction: JSON.stringify({}),
        entityAfterAction: JSON.stringify({}),
      },
    })

    return organization?.status === 'active'
  },

  getOrganizationById: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const { ip } = ctx

    ensureConfigForQuery(ctx)

    return withQueryTimings({
      ctx,
      extra: { orgId: id },
      message: 'getOrganizationById.timings',
      run: async (timer) => {
        try {
          const org: Organization = await timer.track(
            'getDocument',
            loadOrganization(ctx, id)
          )

          // Clone before defaults so a caller cannot mutate the cached snapshot.
          const result = {
            ...org,
            permissions: org.permissions ?? { createQuote: true },
          }

          auditQueryEvent(ctx, {
            subjectId: 'get-organization-by-id-event',
            operation: 'GET_ORGANIZATION_BY_ID',
            meta: {
              entityName: 'Organization',
              remoteIpAddress: ip,
              entityBeforeAction: JSON.stringify({}),
              entityAfterAction: JSON.stringify({}),
            },
          })

          return result
        } catch (error) {
          ctx.vtex.logger.error({
            error: describeClientError(error),
            message: 'getOrganizationById-error',
          })
          throw new GraphQLError(getErrorMessage(error))
        }
      },
    })
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
      ip,
    } = ctx

    ensureConfigForQuery(ctx)

    const whereArray = getWhereByStatus({ status })

    if (search) {
      whereArray.push(`(name="*${search}*" OR tradeName="*${search}*")`)
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
          permissions: org.permissions ?? { createQuote: true },
        }
      })

      auditQueryEvent(ctx, {
        subjectId: 'get-organizations-event',
        operation: 'GET_ORGANIZATIONS',
        meta: {
          entityName: 'Organizations',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return {
        data: mappedOrganizations,
        pagination: organizationsDB.pagination,
      }
    } catch (error) {
      logger.error({
        error: describeClientError(error),
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
    const { ip } = ctx

    return withQueryTimings({
      ctx,
      message: 'getOrganizationsByEmail.timings',
      run: async (timer) => {
        try {
          const organizations = await listOrganizationsByEmail(
            email,
            ctx,
            timer
          )

          auditQueryEvent(ctx, {
            subjectId: 'get-organizations-by-email-event',
            operation: 'GET_ORGANIZATIONS_BY_EMAIL',
            meta: {
              entityName: 'Organizations',
              remoteIpAddress: ip,
              entityBeforeAction: JSON.stringify({}),
              entityAfterAction: JSON.stringify({}),
            },
          })

          return organizations
        } catch (error) {
          ctx.vtex.logger.error({
            error: describeClientError(error),
            message: 'getOrganizationsByEmail-error',
          })
          throw new GraphQLError(getErrorMessage(error))
        }
      },
    })
  },

  getActiveOrganizationsByEmail: async (
    _: void,
    { email }: { email: string },
    ctx: Context
  ) => {
    const { ip } = ctx

    return withQueryTimings({
      ctx,
      message: 'getActiveOrganizationsByEmail.timings',
      run: async (timer) => {
        try {
          // Phase 1: SFP list + org summaries only (no cost-center payloads).
          const organizations = await listOrganizationsByEmail(
            email,
            ctx,
            timer,
            { costCenters: false }
          )

          const organizationsWithStatus: GetOrganizationsByEmailWithStatus[] = (
            organizations ?? []
          ).map((organization: { orgId: string }) => ({
            ...organization,
            status: getOrganizationStatusFromState(ctx, organization.orgId),
          }))

          const activeOrganizations = organizationsWithStatus.filter(
            (organization) =>
              organization.status === ORGANIZATION_STATUSES.ACTIVE
          )

          // Phase 2: cost-center summaries only for active rows.
          await timer.track(
            'hydrateActiveCostCenters',
            hydrateOrganizationsByEmail(ctx, activeOrganizations, {
              organizations: false,
              costCenters: true,
            })
          )

          auditQueryEvent(ctx, {
            subjectId: 'get-active-organizations-by-email-event',
            operation: 'GET_ACTIVE_ORGANIZATIONS_BY_EMAIL',
            meta: {
              entityName: 'Organizations',
              remoteIpAddress: ip,
              entityBeforeAction: JSON.stringify({}),
              entityAfterAction: JSON.stringify({}),
            },
          })

          return activeOrganizations
        } catch (error) {
          ctx.vtex.logger.error({
            error: describeClientError(error),
            message: 'getActiveOrganizationsByEmail-error',
          })
          throw new GraphQLError(getErrorMessage(error))
        }
      },
    })
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
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions },
      vtex: { logger },
    } = ctx

    return withQueryTimings({
      ctx,
      message: 'getOrganizationsPaginatedByEmail.timings',
      run: async (timer) => {
        try {
          const {
            data: { getOrganizationsPaginatedByEmail },
          } = await timer.track(
            'storefrontPermissions',
            storefrontPermissions.getOrganizationsPaginatedByEmail(
              email,
              page,
              pageSize
            )
          )

          const rows = getOrganizationsPaginatedByEmail?.data ?? []

          await timer.track('hydrate', hydrateOrganizationsByEmail(ctx, rows))

          return getOrganizationsPaginatedByEmail
        } catch (error) {
          logger.error({
            error: describeClientError(error),
            message: 'getOrganizationsPaginatedByEmail-error',
          })
          throw new GraphQLError(getErrorMessage(error))
        }
      },
    })
  },

  getOrganizationByIdStorefront: async (
    _: void,
    { id }: { id: string },
    ctx: Context
  ) => {
    const {
      vtex: { sessionData, logger },
      ip,
    } = ctx as any

    ensureConfigForQuery(ctx)

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
      id = userOrganizationId
    }

    if (id !== userOrganizationId) {
      throw new GraphQLError('operation-not-permitted')
    }

    try {
      const organization: Organization = await loadOrganization(ctx, id)

      auditQueryEvent(ctx, {
        subjectId: 'get-organization-by-id-storefront-event',
        operation: 'GET_ORGANIZATION_BY_ID_STOREFRONT',
        meta: {
          entityName: 'Organization',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return {
        ...organization,
        permissions: organization.permissions ?? { createQuote: true },
      }
    } catch (error) {
      logger.error({
        error: describeClientError(error),
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
      ip,
    } = ctx

    ensureConfigForQuery(ctx)

    try {
      auditQueryEvent(ctx, {
        subjectId: 'get-organization-request-by-id-event',
        operation: 'GET_ORGANIZATION_REQUEST_BY_ID',
        meta: {
          entityName: 'Organization',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return await masterdata.getDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: ORGANIZATION_REQUEST_FIELDS,
        id,
      })
    } catch (error) {
      logger.error({
        error: describeClientError(error),
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
      ip,
    } = ctx

    ensureConfigForQuery(ctx)
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
      const result = await masterdata.searchDocumentsWithPaginationInfo({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        fields: ORGANIZATION_REQUEST_FIELDS,
        pagination: { page, pageSize },
        schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
        sort: `${sortedBy} ${sortOrder}`,
        ...(where && { where }),
      })

      auditQueryEvent(ctx, {
        subjectId: 'get-organization-requests-event',
        operation: 'GET_ORGANIZATION_REQUESTS',
        meta: {
          entityName: 'OrganizationRequests',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify({}),
          entityAfterAction: JSON.stringify({}),
        },
      })

      return result
    } catch (error) {
      logger.error({
        error: describeClientError(error),
        message: 'getOrganizationRequests-error',
      })
      throw new GraphQLError(getErrorMessage(error))
    }
  },
}

export default Organizations
