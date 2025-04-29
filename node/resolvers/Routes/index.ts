import { ForbiddenError, UserInputError } from '@vtex/api'

import {
  COST_CENTER_DATA_ENTITY,
  ORGANIZATION_DATA_ENTITY,
} from '../../mdSchema'

const getUserAndPermissions = async (ctx: Context) => {
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
        error,
        message: 'orders-getSession-error',
      })

      return null
    })

  const profileEmail = sessionData?.namespaces?.profile?.email?.value
  const impersonatedEmail =
    sessionData?.namespaces?.impersonate?.storeUserEmail?.value

  if (!impersonatedEmail && !token) {
    throw new ForbiddenError('Access denied')
  }

  let checkUserPermission = null

  if (sessionData?.namespaces) {
    const checkUserPermissionResult = await storefrontPermissions
      // It is necessary to send the app name, because the check user return the permissions relative to orders-history to access the page.
      .checkUserPermission('vtex.b2b-orders-history@1.x')
      .catch((error: any) => {
        logger.error({
          message: 'checkUserPermission-error',
          error,
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

const getOrder = async (ctx: Context) => {
  const {
    vtex: {
      route: {
        params: { orderId },
      },
    },
    clients: { orders },
  } = ctx

  if (!orderId) {
    throw new UserInputError('Order ID is required')
  }

  const order: any = await orders.order(String(orderId))

  // Some dependencies rely on this property not being null but an empty array instead.
  // The new orders endpoint might return null for this property instead of an empty array,
  // so we make sure to set it to an empty array to avoid breaking dependencies.
  // For more info: https://vtex-dev.atlassian.net/browse/B2BTEAM-1376
  order.marketplaceItems = order.marketplaceItems ?? []

  return order
}

const Index = {
  checkout: async (ctx: Context) => {
    const {
      vtex: { storeUserAuthToken, sessionToken, logger },
      clients: { session, masterdata },
    } = ctx

    const token: any = storeUserAuthToken
    const response: any = {}

    ctx.response.status = !token ? 403 : 200

    if (token) {
      const sd = await session
        .getSession(sessionToken as string, ['*'])
        .then((currentSession: any) => {
          return currentSession.sessionData
        })
        .catch((error: any) => {
          logger.error({
            error,
            message: 'checkout-getSession-error',
          })

          return null
        })

      if (sd?.namespaces['storefront-permissions']) {
        if (sd.namespaces['storefront-permissions']?.organization?.value) {
          response.organization = await masterdata.getDocument({
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: ['paymentTerms'],
            id: sd.namespaces['storefront-permissions']?.organization?.value,
          })
        }

        if (sd.namespaces['storefront-permissions']?.costcenter?.value) {
          response.costcenter = await masterdata.getDocument({
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
  },
  order: async (ctx: Context) => {
    const order = await getOrder(ctx)

    const {
      permissions,
      authEmail,
      impersonatedEmail,
      profileEmail,
      organizationId,
      costCenterId,
    } = await getUserAndPermissions(ctx)

    const permitted = checkPermissionAgainstOrder({
      permissions,
      orderData: order,
      authEmail: impersonatedEmail ?? authEmail,
      profileEmail,
      organizationId,
      costCenterId,
    })

    if (!permitted) {
      throw new ForbiddenError('Access denied')
    }

    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')

    ctx.response.body = order

    ctx.response.status = 200
  },
  orders: async (ctx: Context) => {
    const {
      clients: { oms },
      request: { querystring },
    } = ctx

    const {
      permissions,
      authEmail,
      impersonatedEmail,
      organizationId,
      costCenterId,
    } = await getUserAndPermissions(ctx)

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

    const orders: any = await oms.search(query)

    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')

    ctx.response.body = orders

    ctx.response.status = 200
  },
  requestCancellation: async (ctx: Context) => {
    const {
      vtex: {
        route: {
          params: { orderId },
        },
      },
      clients: { checkout },
    } = ctx

    const order = await getOrder(ctx)

    const {
      permissions,
      authEmail,
      impersonatedEmail,
      profileEmail,
      organizationId,
      costCenterId,
    } = await getUserAndPermissions(ctx)

    const permitted = checkPermissionAgainstOrder({
      permissions,
      orderData: order,
      authEmail: impersonatedEmail ?? authEmail,
      profileEmail,
      organizationId,
      costCenterId,
    })

    if (!permitted) {
      throw new ForbiddenError('Access denied')
    }

    const requestCancellationResponse = await checkout.requestCancellation(
      orderId as string
    )

    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')

    ctx.response.body = requestCancellationResponse.data

    ctx.response.status = requestCancellationResponse.status
  },
}

export default Index
