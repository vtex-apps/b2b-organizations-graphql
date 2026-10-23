import { ForbiddenError, NotFoundError, UserInputError } from '@vtex/api'

import {
  COST_CENTER_DATA_ENTITY,
  ORGANIZATION_DATA_ENTITY,
} from '../../mdSchema'
import { describeClientError } from '../../utils/clientError'
import type { RouteName } from '../../utils/routeLog'
import {
  getResponseStatus,
  markLogged,
  RouteResponseError,
  safeRoute,
} from '../../utils/routeLog'

const getUserAndPermissions = async (
  ctx: Context,
  route: RouteName,
  orderId?: string
) => {
  const {
    vtex: { storeUserAuthToken, sessionToken, logger },
    clients: { vtexId, session, storefrontPermissions },
  } = ctx

  const token: any = storeUserAuthToken

  const sessionData = await session
    .getSession(sessionToken as string, ['*'])
    .then((currentSession: any) => {
      return currentSession.sessionData
    })
    .catch((error: any) => {
      logger.error({
        error: describeClientError(error),
        message: 'route.getSessionError',
        operation: route,
        route,
      })

      return null
    })

  const profileEmail = sessionData?.namespaces?.profile?.email?.value
  const impersonatedEmail =
    sessionData?.namespaces?.impersonate?.storeUserEmail?.value

  if (!impersonatedEmail && !token) {
    logger.warn({
      entity: 'Order',
      message: 'route.denied',
      operation: route,
      orderId,
      reason: 'no-token',
      route,
    })
    throw new ForbiddenError('Access denied')
  }

  let checkUserPermission = null

  if (sessionData?.namespaces) {
    const checkUserPermissionResult = await storefrontPermissions
      // It is necessary to send the app name, because the check user return the permissions relative to orders-history to access the page.
      .checkUserPermission('vtex.b2b-orders-history@2.x')
      .catch((error: any) => {
        logger.error({
          error: describeClientError(error),
          message: 'route.checkUserPermissionError',
          operation: route,
          route,
        })

        return {
          data: {
            checkUserPermission: null,
          },
        }
      })

    checkUserPermission = checkUserPermissionResult?.data?.checkUserPermission
  }

  const organizationId =
    sessionData?.namespaces['storefront-permissions']?.organization?.value

  const costCenterId =
    sessionData?.namespaces['storefront-permissions']?.costcenter?.value

  const authUser = impersonatedEmail
    ? { user: impersonatedEmail }
    : await vtexId.getAuthenticatedUser(token)

  return {
    authEmail: authUser?.user,
    impersonatedEmail,
    profileEmail,
    permissions: checkUserPermission?.permissions,
    organizationId,
    costCenterId,
  }
}

const checkPermissionAgainstOrder = ({
  permissions,
  authEmail,
  profileEmail,
  organizationId,
  costCenterId,
  orderData,
}: {
  permissions?: string[]
  authEmail?: string
  profileEmail: string
  organizationId?: string
  costCenterId?: string
  orderData: any
}) => {
  if (
    authEmail === orderData?.clientProfileData?.email ||
    profileEmail === orderData?.clientProfileData?.email
  ) {
    return true
  }

  if (permissions?.includes('all-orders')) {
    return true
  }

  if (
    permissions?.includes('organization-orders') &&
    organizationId === orderData?.marketingData?.utmCampaign
  ) {
    return true
  }

  if (
    permissions?.includes('costcenter-orders') &&
    costCenterId === orderData?.marketingData?.utmMedium
  ) {
    return true
  }

  return false
}

const getOrder = async (
  ctx: Context,
  route: 'order' | 'requestCancellation'
) => {
  const {
    vtex: {
      route: {
        params: { orderId },
      },
      logger,
    },
    clients: { orders },
  } = ctx

  if (!orderId) {
    throw new UserInputError('Order ID is required')
  }

  let order: any

  try {
    order = await orders.order(String(orderId))
  } catch (error) {
    if (getResponseStatus(error) === 404) {
      logger.warn({
        entity: 'Order',
        message: 'route.order.notFound',
        operation: route,
        orderId: String(orderId),
        reason: 'not-found',
        route,
      })
      // A fresh error, not the client one: the response must not carry the
      // failed request (its headers include the caller's session).
      throw new NotFoundError('Order not found')
    }

    logger.error({
      dependency: 'orders.order',
      entity: 'Order',
      error: describeClientError(error),
      message: `route.${route}.error`,
      operation: route,
      orderId: String(orderId),
      route,
    })
    throw markLogged(error)
  }

  // Some dependencies rely on this property not being null but an empty array instead.
  // The new orders endpoint might return null for this property instead of an empty array,
  // so we make sure to set it to an empty array to avoid breaking dependencies.
  // For more info: https://vtex-dev.atlassian.net/browse/B2BTEAM-1376
  order.marketplaceItems = order.marketplaceItems ?? []

  return order
}

const Index = {
  checkout: safeRoute('checkout', async (ctx: Context) => {
    const {
      vtex: { storeUserAuthToken, sessionToken, logger },
      clients: { session, masterdata },
    } = ctx

    const token: any = storeUserAuthToken
    const response: any = {}

    ctx.response.status = !token ? 403 : 200

    if (!token) {
      logger.warn({
        message: 'route.denied',
        operation: 'checkout',
        reason: 'no-token',
        route: 'checkout',
      })
    }

    const getDocument = async (
      entity: 'Organization' | 'CostCenter',
      args: { dataEntity: string; fields: string[]; id: string }
    ) => {
      try {
        return await masterdata.getDocument(args)
      } catch (error) {
        logger.error({
          dependency: 'masterdata.getDocument',
          entity,
          entityId: args.id,
          error: describeClientError(error),
          message: 'route.checkout.error',
          operation: 'checkout',
          route: 'checkout',
        })
        // Answered as a generic 500 by safeRoute.
        throw markLogged(error)
      }
    }

    if (token) {
      const sd = await session
        .getSession(sessionToken as string, ['*'])
        .then((currentSession: any) => {
          return currentSession.sessionData
        })
        .catch((error: any) => {
          logger.error({
            error: describeClientError(error),
            message: 'route.getSessionError',
            operation: 'checkout',
            route: 'checkout',
          })

          return null
        })

      if (sd?.namespaces['storefront-permissions']) {
        if (sd.namespaces['storefront-permissions']?.organization?.value) {
          response.organization = await getDocument('Organization', {
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: ['paymentTerms'],
            id: sd.namespaces['storefront-permissions']?.organization?.value,
          })
        }

        if (sd.namespaces['storefront-permissions']?.costcenter?.value) {
          response.costcenter = await getDocument('CostCenter', {
            dataEntity: COST_CENTER_DATA_ENTITY,
            fields: ['addresses'],
            id: sd.namespaces['storefront-permissions']?.costcenter?.value,
          })
        }
      }
    }

    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')

    ctx.response.body = response
  }),
  order: safeRoute('order', async (ctx: Context) => {
    const {
      vtex: {
        route: {
          params: { orderId },
        },
        logger,
      },
    } = ctx

    const order = await getOrder(ctx, 'order')

    const {
      permissions,
      authEmail,
      impersonatedEmail,
      profileEmail,
      organizationId,
      costCenterId,
    } = await getUserAndPermissions(ctx, 'order', String(orderId))

    const permitted = checkPermissionAgainstOrder({
      permissions,
      orderData: order,
      authEmail: impersonatedEmail ?? authEmail,
      profileEmail,
      organizationId,
      costCenterId,
    })

    if (!permitted) {
      logger.warn({
        entity: 'Order',
        message: 'route.denied',
        operation: 'order',
        orderId: String(orderId),
        reason: 'not-permitted',
        route: 'order',
      })
      throw new ForbiddenError('Access denied')
    }

    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')

    ctx.response.body = order

    ctx.response.status = 200
  }),
  orders: safeRoute('orders', async (ctx: Context) => {
    const {
      clients: { oms },
      request: { querystring },
      vtex: { logger },
    } = ctx

    const {
      permissions,
      authEmail,
      impersonatedEmail,
      organizationId,
      costCenterId,
    } = await getUserAndPermissions(ctx, 'orders')

    const filterByPermission = (userPermissions: string[]) => {
      if (userPermissions.includes('all-orders')) {
        return ``
      }

      if (userPermissions.includes('organization-orders')) {
        return `&f_UtmCampaign=${organizationId}`
      }

      if (userPermissions.includes('costcenter-orders')) {
        return `&f_UtmMedium=${costCenterId}`
      }

      return `&clientEmail=${impersonatedEmail ?? authEmail}`
    }

    const pastYear: any = new Date()

    pastYear.setDate(pastYear.getDate() - 365)

    const now = new Date().toISOString()
    let query = `f_creationDate=creationDate:[${pastYear.toISOString()} TO ${now}]&${querystring}`

    if (permissions?.length) {
      query += filterByPermission(permissions)
    } else {
      query += `&clientEmail=${impersonatedEmail ?? authEmail}`
    }

    let orders: any

    try {
      orders = await oms.search(query)
    } catch (error) {
      logger.error({
        dependency: 'oms.search',
        entity: 'Order',
        error: describeClientError(error),
        message: 'route.orders.error',
        operation: 'orders',
        route: 'orders',
      })
      throw markLogged(error)
    }

    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')

    ctx.response.body = orders

    ctx.response.status = 200
  }),
  requestCancellation: safeRoute(
    'requestCancellation',
    async (ctx: Context) => {
      const {
        vtex: {
          route: {
            params: { orderId },
          },
        },
        clients: { checkout },
        vtex: { logger },
      } = ctx

      const order = await getOrder(ctx, 'requestCancellation')

      const {
        permissions,
        authEmail,
        impersonatedEmail,
        profileEmail,
        organizationId,
        costCenterId,
      } = await getUserAndPermissions(
        ctx,
        'requestCancellation',
        String(orderId)
      )

      const permitted = checkPermissionAgainstOrder({
        permissions,
        orderData: order,
        authEmail: impersonatedEmail ?? authEmail,
        profileEmail,
        organizationId,
        costCenterId,
      })

      if (!permitted) {
        logger.warn({
          entity: 'Order',
          message: 'route.denied',
          operation: 'requestCancellation',
          orderId: String(orderId),
          reason: 'not-permitted',
          route: 'requestCancellation',
        })
        throw new ForbiddenError('Access denied')
      }

      const reason = `order canceled by user: ${authEmail}`

      const logRejected = (status: number, error?: unknown) => {
        const level = status >= 500 ? 'error' : 'warn'

        logger[level]({
          entity: 'Order',
          ...(error ? { error: describeClientError(error) } : {}),
          message: 'route.requestCancellation.rejected',
          operation: 'requestCancellation',
          orderId: String(orderId),
          route: 'requestCancellation',
          status,
        })

        return level
      }

      let requestCancellationResponse: any

      try {
        requestCancellationResponse = await checkout.requestCancellation(
          orderId as string,
          reason
        )
      } catch (error) {
        const status = getResponseStatus(error)

        if (status !== undefined) {
          // Checkout answered non-2xx: a 4xx is checkout refusing the request
          // (warn, answered with the same status); a 5xx is a real failure
          // (error, answered as a generic 500).
          logRejected(status, error)

          if (status >= 400 && status < 500) {
            throw new RouteResponseError(
              status,
              'CANCELLATION_REJECTED',
              'Cancellation request rejected'
            )
          }

          throw markLogged(error)
        }

        // No response at all (timeout, network): checkout call failed.
        logger.error({
          dependency: 'checkout.requestCancellation',
          entity: 'Order',
          error: describeClientError(error),
          message: 'route.requestCancellation.error',
          operation: 'requestCancellation',
          orderId: String(orderId),
          route: 'requestCancellation',
        })
        throw markLogged(error)
      }

      const { status } = requestCancellationResponse

      if (typeof status === 'number' && (status < 200 || status > 299)) {
        // Forwarded to the caller unchanged, as before; now it is also logged.
        logRejected(status)
      }

      ctx.set('Content-Type', 'application/json')
      ctx.set('Cache-Control', 'no-cache, no-store')

      ctx.response.body = requestCancellationResponse.data

      ctx.response.status = requestCancellationResponse.status
    }
  ),
}

export default Index
