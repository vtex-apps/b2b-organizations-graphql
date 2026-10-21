import Routes from './index'

jest.mock('@vtex/api', () => {
  class ResolverWarning extends Error {
    public level = 'warn'
    constructor(message: string, public status: number, public code: string) {
      super(message)
    }
  }

  class ForbiddenError extends ResolverWarning {
    constructor(message: string) {
      super(message, 403, 'FORBIDDEN')
    }
  }

  class UserInputError extends ResolverWarning {
    constructor(message: string) {
      super(message, 400, 'BAD_USER_INPUT')
    }
  }

  return { ForbiddenError, UserInputError }
})

const orderId = 'qa-3984-order-1'
const ownerEmail = 'owner@example.com'

const httpError = (status?: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    config: { method: 'get', url: '/api/x?email=owner@example.com' },
    ...(status ? { response: { data: {}, headers: {}, status } } : {}),
  })

const sessionWith = (overrides: Record<string, any> = {}) => ({
  sessionData: {
    namespaces: {
      profile: { email: { value: ownerEmail } },
      'storefront-permissions': {
        costcenter: { value: 'cc-1' },
        organization: { value: 'org-1' },
      },
      ...overrides,
    },
  },
})

const mockContext = ({
  token = 'store-token',
  order = {
    clientProfileData: { email: ownerEmail },
    marketingData: {},
    marketplaceItems: [],
  } as any,
}: { token?: string | null; order?: any } = {}) => {
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }

  return {
    clients: {
      checkout: {
        requestCancellation: jest
          .fn()
          .mockResolvedValue({ data: { ok: true }, status: 200 }),
      },
      masterdata: {
        getDocument: jest.fn().mockResolvedValue({ id: 'doc' }),
      },
      oms: { search: jest.fn().mockResolvedValue({ list: [] }) },
      orders: { order: jest.fn().mockResolvedValue(order) },
      session: { getSession: jest.fn().mockResolvedValue(sessionWith()) },
      storefrontPermissions: {
        checkUserPermission: jest.fn().mockResolvedValue({
          data: { checkUserPermission: { permissions: [] } },
        }),
      },
      vtexId: {
        getAuthenticatedUser: jest.fn().mockResolvedValue({ user: ownerEmail }),
      },
    },
    request: { querystring: 'page=1' },
    response: {} as any,
    set: jest.fn(),
    vtex: {
      logger,
      route: { params: { orderId } },
      sessionToken: 'session-token',
      storeUserAuthToken: token ?? undefined,
    },
  } as unknown as Context & { vtex: { logger: typeof logger } }
}

const messages = (fn: jest.Mock) =>
  fn.mock.calls.map(([payload]) => payload.message)

const expectNoEmail = (fn: jest.Mock) =>
  expect(JSON.stringify(fn.mock.calls)).not.toContain(ownerEmail)

describe('Routes logging (B2BTEAM-3984)', () => {
  describe('order', () => {
    it('returns the order on the happy path without warn/error logs', async () => {
      const ctx = mockContext()

      await Routes.order(ctx)

      expect(ctx.response.status).toBe(200)
      expect((ctx.response as any).body.clientProfileData.email).toBe(
        ownerEmail
      )
      expect(ctx.vtex.logger.warn).not.toHaveBeenCalled()
      expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
    })

    it('logs warn route.order.notFound on OMS 404 and marks the error warn', async () => {
      const ctx = mockContext()
      const error = httpError(404)

      ;(ctx.clients.orders.order as jest.Mock).mockRejectedValue(error)

      await expect(Routes.order(ctx)).rejects.toBe(error)
      expect((error as any).level).toBe('warn')
      expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.order.notFound',
          orderId,
          route: 'order',
        })
      )
      expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
    })

    it.each([400, 403, 429, 500, 503])(
      'logs error route.order.error on OMS %i and rethrows unchanged',
      async (status) => {
        const ctx = mockContext()
        const error = httpError(status)

        ;(ctx.clients.orders.order as jest.Mock).mockRejectedValue(error)

        await expect(Routes.order(ctx)).rejects.toBe(error)
        expect((error as any).level).toBeUndefined()
        expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            dependency: 'orders.order',
            error: expect.objectContaining({ status }),
            message: 'route.order.error',
            orderId,
            route: 'order',
          })
        )
        expectNoEmail(ctx.vtex.logger.error)
      }
    )

    it('logs error route.order.error when OMS times out (no response)', async () => {
      const ctx = mockContext()

      ;(ctx.clients.orders.order as jest.Mock).mockRejectedValue(httpError())

      await expect(Routes.order(ctx)).rejects.toThrow()
      expect(messages(ctx.vtex.logger.error)).toEqual(['route.order.error'])
    })

    it('logs warn route.denied not-permitted with orderId before ForbiddenError', async () => {
      const ctx = mockContext({
        order: {
          clientProfileData: { email: 'other@example.com' },
          marketingData: {},
        },
      })

      await expect(Routes.order(ctx)).rejects.toMatchObject({
        message: 'Access denied',
        status: 403,
      })
      expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.denied',
          orderId,
          reason: 'not-permitted',
          route: 'order',
        })
      )
      expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
      expectNoEmail(ctx.vtex.logger.warn)
    })

    it('logs warn route.denied no-token with orderId', async () => {
      const ctx = mockContext({ token: null })

      ;(ctx.clients.session.getSession as jest.Mock).mockResolvedValue({
        sessionData: { namespaces: {} },
      })

      await expect(Routes.order(ctx)).rejects.toMatchObject({
        message: 'Access denied',
      })
      expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.denied',
          orderId,
          reason: 'no-token',
          route: 'order',
        })
      )
    })

    it('throws UserInputError without logging when orderId is missing', async () => {
      const ctx = mockContext()

      ;(ctx.vtex.route as any).params = {}

      await expect(Routes.order(ctx)).rejects.toMatchObject({
        message: 'Order ID is required',
      })
      expect(ctx.vtex.logger.warn).not.toHaveBeenCalled()
      expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
    })
  })

  describe('getUserAndPermissions (via orders)', () => {
    it('logs route.getSessionError with the calling route', async () => {
      const ctx = mockContext()

      ;(ctx.clients.session.getSession as jest.Mock).mockRejectedValue(
        httpError(500)
      )

      await Routes.orders(ctx)

      expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ status: 500 }),
          message: 'route.getSessionError',
          route: 'orders',
        })
      )
      expect(messages(ctx.vtex.logger.error)).not.toContain(
        'orders-getSession-error'
      )
    })

    it('logs route.getSessionError with route requestCancellation', async () => {
      const ctx = mockContext()

      ;(ctx.clients.session.getSession as jest.Mock).mockRejectedValue(
        httpError(500)
      )

      await Routes.requestCancellation(ctx)

      expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.getSessionError',
          route: 'requestCancellation',
        })
      )
    })

    it('logs route.checkUserPermissionError and keeps the fail-closed fallback', async () => {
      const ctx = mockContext()

      ;(
        ctx.clients.storefrontPermissions.checkUserPermission as jest.Mock
      ).mockRejectedValue(httpError(502))

      await Routes.orders(ctx)

      expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.checkUserPermissionError',
          route: 'orders',
        })
      )
      // No permissions -> filtered by the user's own e-mail, as before.
      expect((ctx.clients.oms.search as jest.Mock).mock.calls[0][0]).toContain(
        `&clientEmail=${ownerEmail}`
      )
      expectNoEmail(ctx.vtex.logger.error)
    })
  })

  describe('orders', () => {
    it('returns the OMS search result unchanged on the happy path', async () => {
      const ctx = mockContext()

      await Routes.orders(ctx)

      expect((ctx.response as any).body).toEqual({ list: [] })
      expect(ctx.response.status).toBe(200)
      expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
      expect(ctx.vtex.logger.warn).not.toHaveBeenCalled()
    })

    it('logs error route.orders.error when oms.search fails', async () => {
      const ctx = mockContext()
      const error = httpError(500)

      ;(ctx.clients.oms.search as jest.Mock).mockRejectedValue(error)

      await expect(Routes.orders(ctx)).rejects.toBe(error)
      expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          dependency: 'oms.search',
          message: 'route.orders.error',
          route: 'orders',
        })
      )
      expectNoEmail(ctx.vtex.logger.error)
    })

    it('logs warn route.denied no-token without orderId', async () => {
      const ctx = mockContext({ token: null })

      await expect(Routes.orders(ctx)).rejects.toMatchObject({
        message: 'Access denied',
      })
      const [payload] = (ctx.vtex.logger.warn as jest.Mock).mock.calls[0]

      expect(payload).toMatchObject({
        message: 'route.denied',
        reason: 'no-token',
        route: 'orders',
      })
      expect(payload.orderId).toBeUndefined()
    })
  })

  describe('requestCancellation', () => {
    it('forwards the checkout response on the happy path', async () => {
      const ctx = mockContext()

      await Routes.requestCancellation(ctx)

      expect(ctx.response.status).toBe(200)
      expect((ctx.response as any).body).toEqual({ ok: true })
      expect(ctx.vtex.logger.warn).not.toHaveBeenCalled()
      expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
    })

    it('logs route.order.notFound with route requestCancellation on OMS 404', async () => {
      const ctx = mockContext()

      ;(ctx.clients.orders.order as jest.Mock).mockRejectedValue(httpError(404))

      await expect(Routes.requestCancellation(ctx)).rejects.toMatchObject({
        level: 'warn',
      })
      expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.order.notFound',
          orderId,
          route: 'requestCancellation',
        })
      )
      expect(ctx.clients.checkout.requestCancellation).not.toHaveBeenCalled()
    })

    it('logs route.requestCancellation.error when the order lookup fails', async () => {
      const ctx = mockContext()

      ;(ctx.clients.orders.order as jest.Mock).mockRejectedValue(httpError(500))

      await expect(Routes.requestCancellation(ctx)).rejects.toThrow()
      expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          dependency: 'orders.order',
          message: 'route.requestCancellation.error',
          orderId,
        })
      )
    })

    it('logs warn route.denied not-permitted with orderId and does not cancel', async () => {
      const ctx = mockContext({
        order: {
          clientProfileData: { email: 'other@example.com' },
          marketingData: {},
        },
      })

      await expect(Routes.requestCancellation(ctx)).rejects.toMatchObject({
        message: 'Access denied',
      })
      expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.denied',
          orderId,
          reason: 'not-permitted',
          route: 'requestCancellation',
        })
      )
      expect(ctx.clients.checkout.requestCancellation).not.toHaveBeenCalled()
    })

    it.each([400, 403, 404, 409])(
      'logs warn route.requestCancellation.rejected on checkout %i',
      async (status) => {
        const ctx = mockContext()
        const error = httpError(status)

        ;(
          ctx.clients.checkout.requestCancellation as jest.Mock
        ).mockRejectedValue(error)

        await expect(Routes.requestCancellation(ctx)).rejects.toBe(error)
        expect((error as any).level).toBe('warn')
        expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'route.requestCancellation.rejected',
            orderId,
            status,
          })
        )
        expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
        expectNoEmail(ctx.vtex.logger.warn)
      }
    )

    it.each([500, 503])(
      'logs error route.requestCancellation.rejected on checkout %i',
      async (status) => {
        const ctx = mockContext()
        const error = httpError(status)

        ;(
          ctx.clients.checkout.requestCancellation as jest.Mock
        ).mockRejectedValue(error)

        await expect(Routes.requestCancellation(ctx)).rejects.toBe(error)
        expect((error as any).level).toBe('error')
        expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'route.requestCancellation.rejected',
            orderId,
            status,
          })
        )
      }
    )

    it('logs error route.requestCancellation.error when checkout has no response', async () => {
      const ctx = mockContext()

      ;(
        ctx.clients.checkout.requestCancellation as jest.Mock
      ).mockRejectedValue(httpError())

      await expect(Routes.requestCancellation(ctx)).rejects.toThrow()
      expect(messages(ctx.vtex.logger.error)).toEqual([
        'route.requestCancellation.error',
      ])
    })

    it('logs a non-2xx checkout response that did not throw and forwards it unchanged', async () => {
      const ctx = mockContext()

      ;(
        ctx.clients.checkout.requestCancellation as jest.Mock
      ).mockResolvedValue({ data: { moved: true }, status: 304 })

      await Routes.requestCancellation(ctx)

      expect(ctx.response.status).toBe(304)
      expect((ctx.response as any).body).toEqual({ moved: true })
      expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.requestCancellation.rejected',
          status: 304,
        })
      )
    })
  })

  describe('checkout', () => {
    it('returns organization and cost center on the happy path', async () => {
      const ctx = mockContext()

      await Routes.checkout(ctx)

      expect(ctx.response.status).toBe(200)
      expect((ctx.response as any).body).toEqual({
        costcenter: { id: 'doc' },
        organization: { id: 'doc' },
      })
      expect(ctx.vtex.logger.warn).not.toHaveBeenCalled()
      expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
    })

    it('keeps the 403 without token and logs warn route.denied', async () => {
      const ctx = mockContext({ token: null })

      await Routes.checkout(ctx)

      expect(ctx.response.status).toBe(403)
      expect((ctx.response as any).body).toEqual({})
      expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'route.denied',
          reason: 'no-token',
          route: 'checkout',
        })
      )
    })

    it('logs route.getSessionError with route checkout', async () => {
      const ctx = mockContext()

      ;(ctx.clients.session.getSession as jest.Mock).mockRejectedValue(
        httpError(500)
      )

      await Routes.checkout(ctx)

      expect(messages(ctx.vtex.logger.error)).toEqual(['route.getSessionError'])
      expect((ctx.response as any).body).toEqual({})
    })

    it('logs error route.checkout.error when getDocument fails and rethrows', async () => {
      const ctx = mockContext()
      const error = httpError(500)

      ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
        error
      )

      await expect(Routes.checkout(ctx)).rejects.toBe(error)
      expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          dependency: 'masterdata.getDocument',
          entity: 'Organization',
          entityId: 'org-1',
          message: 'route.checkout.error',
        })
      )
      expectNoEmail(ctx.vtex.logger.error)
    })
  })
})
