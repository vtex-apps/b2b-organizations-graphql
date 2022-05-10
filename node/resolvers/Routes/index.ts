import { UserInputError, ForbiddenError } from '@vtex/api'

import {
  COST_CENTER_DATA_ENTITY,
  ORGANIZATION_DATA_ENTITY,
} from '../../mdSchema'

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
      const sessionData = await session
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

      if (sessionData?.namespaces['storefront-permissions']) {
        if (
          sessionData.namespaces['storefront-permissions']?.organization?.value
        ) {
          response.organization = await masterdata.getDocument({
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: ['paymentTerms'],
            id:
              sessionData.namespaces['storefront-permissions']?.organization
                ?.value,
          })
        }

        if (
          sessionData.namespaces['storefront-permissions']?.costcenter?.value
        ) {
          response.costcenter = await masterdata.getDocument({
            dataEntity: COST_CENTER_DATA_ENTITY,
            fields: ['addresses'],
            id:
              sessionData.namespaces['storefront-permissions']?.costcenter
                ?.value,
          })
        }
      }
    }

    ctx.set('Content-Type', 'application/json')
    ctx.set('Cache-Control', 'no-cache, no-store')

    ctx.response.body = response
  },
  order: async (ctx: Context) => {
    const {
      vtex: {
        route: {
          params: { orderId },
        },
        storeUserAuthToken,
        sessionToken,
        logger,
      },
      clients: { vtexId, session, oms, storefrontPermissions },
    } = ctx

    if (!orderId) {
      throw new UserInputError('Order ID is required')
    }

    const token: any = storeUserAuthToken

    if (!token) {
      throw new ForbiddenError('Access denied')
    }

    const authUser = await vtexId.getAuthenticatedUser(token)

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

    const checkPermissionAgainstOrder = (
      permissions: string[],
      orderData: any
    ) => {
      if (
        authUser?.user === orderData?.clientProfileData?.email ||
        profileEmail === orderData?.clientProfileData?.email
      ) {
        return true
      }

      if (permissions?.includes('all-orders')) {
        return true
      }

      if (
        permissions?.includes('organization-orders') &&
        sessionData?.namespaces['storefront-permissions']?.organization
          ?.value === orderData?.marketingData?.utmCampaign
      ) {
        return true
      }

      if (
        permissions?.includes('costcenter-orders') &&
        sessionData?.namespaces['storefront-permissions']?.costcenter?.value ===
          orderData?.marketingData?.utmMedium
      ) {
        return true
      }

      return false
    }

    const {
      data: { checkUserPermission },
    }: any = await storefrontPermissions
      .checkUserPermission('vtex.b2b-orders-history@0.x')
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

    const order: any = await oms.order(String(orderId))

    const permitted = checkPermissionAgainstOrder(
      checkUserPermission?.permissions,
      order
    )

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
      vtex: { storeUserAuthToken, sessionToken, logger },
      clients: { vtexId, session, oms, storefrontPermissions },
    } = ctx

    const token: any = storeUserAuthToken

    if (!token) {
      throw new ForbiddenError('Access denied')
    }

    const authUser = await vtexId.getAuthenticatedUser(token)

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

    const filterByPermission = (permissions: string[]) => {
      if (permissions.includes('all-orders')) {
        return ``
      }

      if (permissions.includes('organization-orders')) {
        return `&f_UtmCampaign=${sessionData.namespaces['storefront-permissions'].organization.value}`
      }

      if (permissions.includes('costcenter-orders')) {
        return `&f_UtmMedium=${sessionData.namespaces['storefront-permissions'].costcenter.value}`
      }

      return `&clientEmail=${authUser.user}`
    }

    const {
      data: { checkUserPermission },
    }: any = await storefrontPermissions
      .checkUserPermission('vtex.b2b-orders-history@0.x')
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

    const pastYear: any = new Date()

    pastYear.setDate(pastYear.getDate() - 365)

    const now = new Date().toISOString()
    let query = `f_creationDate=creationDate:[${pastYear.toISOString()} TO ${now}]&${
      ctx.request.querystring
    }`

    if (checkUserPermission?.permissions?.length) {
      query += filterByPermission(checkUserPermission.permissions)
    } else {
      query += `&clientEmail=${authUser.user}`
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

    if (!orderId) {
      throw new UserInputError('Order ID is required')
    }

    // use order route handler to verify user has access to order
    Index.order(ctx).catch(() => {
      throw new ForbiddenError('Access denied')
    })

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
