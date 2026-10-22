/**
 * B2BTEAM-3986 (US-5, SDD §5): logger spies for the keys this story owns.
 *
 * - `auth.denied` from `@validateAdminUserAccess` / `@validateStoreUserAccess`
 *   (`no-token`, `invalid-token`, `insufficient-role`), replacing the
 *   free-text messages, with the metric fields kept and the thrown error
 *   unchanged.
 * - `validateAdminToken.error` / `validateApiToken.error` /
 *   `validateStoreToken.error` and `validateStoreToken.notInBuyerOrg`
 *   (no raw error, no shopper email).
 * - `findPaymentTerms.unmatched` / `findSellers.unmatched` /
 *   `findCollections.unmatched`.
 * - `updateUser.auditLookupError`.
 */
import { AuthenticationError, ForbiddenError } from '@vtex/api'

import {
  validateAdminToken,
  validateApiToken,
  validateStoreToken,
} from '../resolvers/directives/helper'
import { ValidateAdminUserAccess } from '../resolvers/directives/validateAdminUserAccess'
import { ValidateStoreUserAccess } from '../resolvers/directives/validateStoreUserAccess'
import Organizations from '../resolvers/Mutations/Organizations'
import Users from '../resolvers/Mutations/Users'
import { isUserPartOfBuyerOrg } from '../resolvers/Queries/Users'
import { getDirectiveDeniedReason } from '../utils/directiveDenied'

jest.mock('@vtex/diagnostics-nodejs', () => ({}))
jest.mock('../resolvers/config')
jest.mock('../resolvers/Queries/Settings')
jest.mock('../services/organizationsCache', () => ({
  invalidateOrganizationCache: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../utils/audit', () => jest.fn().mockResolvedValue(undefined))
jest.mock('../utils/metrics/auth', () => ({
  __esModule: true,
  AuthMetric: jest.fn(),
  default: jest.fn(),
}))
jest.mock('../utils/metrics/user')
jest.mock('../utils/actingUserEmail', () => ({
  setValidatedStoreUserEmail: jest.fn(),
}))
jest.mock('../resolvers/Queries/Users', () => ({
  isUserPartOfBuyerOrg: jest.fn(),
}))

const EMAIL = 'shopper@example.com'
const mockedIsUserPartOfBuyerOrg = isUserPartOfBuyerOrg as jest.Mock

const makeLogger = () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
})

const allLoggedText = (logger: ReturnType<typeof makeLogger>) =>
  JSON.stringify([
    logger.error.mock.calls,
    logger.info.mock.calls,
    logger.warn.mock.calls,
  ])

const warnCalls = (logger: ReturnType<typeof makeLogger>, message: string) =>
  logger.warn.mock.calls
    .map(([payload]) => payload)
    .filter((payload) => payload?.message === message)

afterEach(() => {
  jest.clearAllMocks()
})

describe('auth directives log auth.denied', () => {
  const buildResolver = (
    Directive: any,
    args: Record<string, unknown> = {}
  ) => {
    const field: any = {
      astNode: { name: { value: 'getOrganizations' } },
      resolve: jest.fn().mockResolvedValue('ok'),
    }

    const directive = Object.create(Directive.prototype)

    directive.args = args
    directive.visitFieldDefinition(field)

    return field.resolve
  }

  const makeContext = (
    logger: ReturnType<typeof makeLogger>,
    {
      adminToken,
      storeToken,
      identity = {},
      lm = {},
      vtexId = {},
    }: {
      adminToken?: string
      storeToken?: string
      identity?: Record<string, jest.Mock>
      lm?: Record<string, jest.Mock>
      vtexId?: Record<string, jest.Mock>
    } = {}
  ) =>
    ({
      clients: { identity, lm, vtexId },
      cookies: { set: jest.fn() },
      headers: {},
      request: { headers: { 'user-agent': 'jest' }, url: '/graphql' },
      vtex: {
        account: 'b2bstoreqa',
        adminUserAuthToken: adminToken,
        logger,
        storeUserAuthToken: storeToken,
      },
    } as unknown as Context)

  it.each([
    ['validateAdminUserAccess', ValidateAdminUserAccess],
    ['validateStoreUserAccess', ValidateStoreUserAccess],
  ])(
    '%s: no token -> warn auth.denied no-token, AuthenticationError',
    async (directive, Directive) => {
      const logger = makeLogger()
      const resolve = buildResolver(Directive)

      await expect(resolve({}, {}, makeContext(logger), {})).rejects.toThrow(
        AuthenticationError
      )

      const denied = warnCalls(logger, 'auth.denied')

      expect(denied).toHaveLength(1)
      expect(denied[0]).toMatchObject({
        directive,
        hasAdminToken: false,
        operation: 'getOrganizations',
        reason: 'no-token',
        userAgent: 'jest',
      })
      expect(logger.warn.mock.calls.map(([p]) => p.message)).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/No token provided/)])
      )
      expect(logger.error).not.toHaveBeenCalled()
    }
  )

  it('validateAdminUserAccess: invalid admin token -> invalid-token, ForbiddenError', async () => {
    const logger = makeLogger()
    const resolve = buildResolver(ValidateAdminUserAccess, {
      adminPermission: 'B2B_ORGANIZATIONS_EDIT',
    })

    const ctx = makeContext(logger, {
      adminToken: 'bad-token',
      identity: {
        validateToken: jest.fn().mockRejectedValue(new Error('401')),
      },
    })

    await expect(resolve({}, {}, ctx, {})).rejects.toThrow(ForbiddenError)

    const denied = warnCalls(logger, 'auth.denied')

    expect(denied).toHaveLength(1)
    expect(denied[0]).toMatchObject({
      directive: 'validateAdminUserAccess',
      hasAdminToken: true,
      hasValidAdminToken: false,
      reason: 'invalid-token',
    })
    expect(denied[0].requiredPermission).toBeDefined()
  })

  it('validateAdminUserAccess: admin without B2B role -> insufficient-role', async () => {
    const logger = makeLogger()
    const resolve = buildResolver(ValidateAdminUserAccess)

    const ctx = makeContext(logger, {
      adminToken: 'admin-token',
      identity: {
        validateToken: jest.fn().mockResolvedValue({
          account: 'b2bstoreqa',
          audience: 'admin',
          id: 'u1',
        }),
      },
      lm: {
        checkUserSpecificRole: jest.fn().mockResolvedValue(false),
        getUserAdminPermissions: jest.fn().mockResolvedValue(true),
      },
    })

    await expect(resolve({}, {}, ctx, {})).rejects.toThrow(ForbiddenError)
    expect(warnCalls(logger, 'auth.denied')[0]).toMatchObject({
      hasValidAdminRole: false,
      hasValidAdminToken: true,
      reason: 'insufficient-role',
    })
  })

  it('validateStoreUserAccess: store token outside the buyer org -> invalid-token, no email logged', async () => {
    mockedIsUserPartOfBuyerOrg.mockResolvedValue(false)
    const logger = makeLogger()
    const resolve = buildResolver(ValidateStoreUserAccess)

    const ctx = makeContext(logger, {
      storeToken: 'store-token',
      vtexId: {
        getAuthenticatedUser: jest
          .fn()
          .mockResolvedValue({ user: EMAIL, userId: 'user-1' }),
      },
    })

    await expect(resolve({}, {}, ctx, {})).rejects.toThrow(ForbiddenError)

    expect(warnCalls(logger, 'validateStoreToken.notInBuyerOrg')).toEqual([
      expect.objectContaining({ operation: '/graphql', userId: 'user-1' }),
    ])
    expect(warnCalls(logger, 'auth.denied')[0]).toMatchObject({
      directive: 'validateStoreUserAccess',
      hasStoreToken: true,
      hasValidStoreToken: false,
      reason: 'invalid-token',
    })
    expect(allLoggedText(logger)).not.toContain(EMAIL)
  })

  it('allows access without logging auth.denied', async () => {
    mockedIsUserPartOfBuyerOrg.mockResolvedValue(true)
    const logger = makeLogger()
    const resolve = buildResolver(ValidateStoreUserAccess)

    const ctx = makeContext(logger, {
      storeToken: 'store-token',
      vtexId: {
        getAuthenticatedUser: jest
          .fn()
          .mockResolvedValue({ user: EMAIL, userId: 'user-1' }),
      },
    })

    expect(await resolve({}, {}, ctx, {})).toBe('ok')
    expect(warnCalls(logger, 'auth.denied')).toHaveLength(0)
    expect(allLoggedText(logger)).not.toContain(EMAIL)
  })

  it('getDirectiveDeniedReason', () => {
    const base = {
      caller: '',
      forwardedHost: '',
      operation: 'op',
      userAgent: '',
    }

    expect(getDirectiveDeniedReason(base)).toBe('invalid-token')
    expect(
      getDirectiveDeniedReason({
        ...base,
        hasValidApiRole: false,
        hasValidApiToken: true,
      })
    ).toBe('insufficient-role')
    expect(
      getDirectiveDeniedReason({
        ...base,
        hasValidAdminRoleOnHeader: false,
        hasValidAdminTokenOnHeader: true,
      })
    ).toBe('insufficient-role')
    expect(
      getDirectiveDeniedReason({
        ...base,
        hasValidAdminRole: true,
        hasValidAdminToken: true,
        hasValidStoreToken: false,
      })
    ).toBe('invalid-token')
  })
})

describe('token validation helpers', () => {
  const clientError = () =>
    Object.assign(new Error(`Request failed for ${EMAIL}`), {
      config: {
        headers: { VtexIdclientAutCookie: 'secret-token' },
        method: 'get',
        params: { authToken: 'secret-token' },
        url: '/api/vtexid/pub/authenticated/user/?authToken=secret-token',
      },
      response: { headers: {}, status: 503 },
    })

  const ctxWith = (logger: ReturnType<typeof makeLogger>, clients: any) =>
    ({
      clients,
      cookies: { set: jest.fn() },
      headers: { 'vtex-api-appkey': 'key', 'vtex-api-apptoken': 'token' },
      request: { headers: {}, url: '/graphql' },
      vtex: { account: 'b2bstoreqa', logger },
    } as unknown as Context)

  it.each([
    [
      'validateAdminToken.error',
      (ctx: Context) => validateAdminToken(ctx, 'admin-token'),
      { identity: { validateToken: jest.fn() } },
      (clients: any) => clients.identity.validateToken,
    ],
    [
      'validateApiToken.error',
      (ctx: Context) => validateApiToken(ctx),
      { identity: { getToken: jest.fn() } },
      (clients: any) => clients.identity.getToken,
    ],
    [
      'validateStoreToken.error',
      (ctx: Context) => validateStoreToken(ctx, 'store-token'),
      { vtexId: { getAuthenticatedUser: jest.fn() } },
      (clients: any) => clients.vtexId.getAuthenticatedUser,
    ],
  ])(
    '%s: warn with describeClientError, no token or email',
    async (key, run, clients, failing) => {
      failing(clients).mockRejectedValue(clientError())
      const logger = makeLogger()

      await run(ctxWith(logger, clients))

      const calls = warnCalls(logger, key)

      expect(calls).toHaveLength(1)
      expect(calls[0].error).toMatchObject({
        path: '/api/vtexid/pub/authenticated/user/',
        status: 503,
      })
      expect(calls[0].err).toBeUndefined()
      expect(allLoggedText(logger)).not.toContain('secret-token')
      expect(allLoggedText(logger)).not.toContain(EMAIL)
      expect(logger.error).not.toHaveBeenCalled()
    }
  )
})

describe('find*.unmatched on createOrganizationAndCostCentersWithId', () => {
  const run = async (input: Record<string, unknown>) => {
    const logger = makeLogger()

    const ctx = {
      clients: {
        audit: { sendEvent: jest.fn().mockResolvedValue(undefined) },
        catalog: {
          collectionsAvailable: jest.fn((name: string) =>
            Promise.resolve({
              items:
                name === 'VIP Shelf' ? [{ id: 42, name: 'VIP Shelf' }] : [],
            })
          ),
        },
        masterdata: {
          // Stop right after name resolution; the logs under test come first.
          createDocument: jest.fn().mockRejectedValue(new Error('stop')),
        },
        payments: {
          getPaymentTerms: jest
            .fn()
            .mockResolvedValue([{ id: 1, name: 'Boleto' }]),
        },
        sellers: {
          getSellers: jest
            .fn()
            .mockResolvedValue({ items: [{ id: 's1', name: 'Seller One' }] }),
        },
        storefrontPermissions: {},
      },
      ip: '127.0.0.1',
      vtex: { account: 'b2bstoreqa', logger },
    } as unknown as Context

    await Organizations.createOrganizationAndCostCentersWithId(
      undefined as never,
      {
        input: {
          b2bCustomerAdmin: { email: EMAIL, firstName: 'A', lastName: 'B' },
          name: 'Org',
          ...input,
        },
      } as never,
      ctx
    ).catch(() => undefined)

    return logger
  }

  it('logs the names that matched nothing, deduplicated, with the count', async () => {
    const logger = await run({
      collections: ['VIP Shelf', ' Ghost Shelf ', 'Ghost Shelf'],
      paymentTerms: ['Boleto', 'Ghost Term', 'Ghost Term'],
      sellers: ['Seller One', 'Ghost Seller'],
    })

    expect(warnCalls(logger, 'findPaymentTerms.unmatched')).toEqual([
      {
        entity: 'PaymentTerm',
        message: 'findPaymentTerms.unmatched',
        operation: 'createOrganizationAndCostCenterWithAdminUser',
        unmatchedCount: 1,
        unmatchedNames: ['Ghost Term'],
      },
    ])
    expect(warnCalls(logger, 'findSellers.unmatched')).toEqual([
      expect.objectContaining({
        entity: 'Seller',
        unmatchedCount: 1,
        unmatchedNames: ['Ghost Seller'],
      }),
    ])
    expect(warnCalls(logger, 'findCollections.unmatched')).toEqual([
      expect.objectContaining({
        entity: 'Collection',
        unmatchedCount: 1,
        unmatchedNames: ['Ghost Shelf'],
      }),
    ])
    expect(allLoggedText(logger)).not.toContain(EMAIL)
  })

  it('logs nothing when every name matches', async () => {
    const logger = await run({
      collections: ['VIP Shelf'],
      paymentTerms: ['Boleto'],
      sellers: ['Seller One'],
    })

    expect(
      logger.warn.mock.calls.filter(([p]) => /\.unmatched$/.test(p.message))
    ).toHaveLength(0)
  })
})

describe('findCollections.unmatched on updateOrganization', () => {
  it('logs name-only collections that matched nothing', async () => {
    const logger = makeLogger()
    const orgId = 'org-1'

    const ctx = {
      clients: {
        analytics: { sendMetric: jest.fn().mockResolvedValue(undefined) },
        audit: { sendEvent: jest.fn().mockResolvedValue(undefined) },
        catalog: {
          collectionsAvailable: jest.fn().mockResolvedValue({ items: [] }),
        },
        mail: {},
        masterdata: {
          getDocument: jest.fn().mockResolvedValue({
            id: orgId,
            name: 'Existing',
            status: 'active',
          }),
          updatePartialDocument: jest.fn().mockResolvedValue({}),
        },
        storefrontPermissions: {},
      },
      ip: '127.0.0.1',
      vtex: { account: 'b2bstoreqa', logger },
    } as unknown as Context

    await Organizations.updateOrganization(
      undefined as never,
      {
        collections: [{ id: '5', name: 'Direct' }, { name: 'Ghost Shelf' }],
        customFields: [],
        id: orgId,
        name: 'Updated Org',
        notifyUsers: false,
        paymentTerms: [],
        permissions: {},
        priceTables: [],
        status: 'active',
      } as never,
      ctx
    ).catch(() => undefined)

    expect(warnCalls(logger, 'findCollections.unmatched')).toEqual([
      expect.objectContaining({
        operation: 'updateOrganization',
        unmatchedCount: 1,
        unmatchedNames: ['Ghost Shelf'],
      }),
    ])
  })
})

describe('updateUser audit lookup', () => {
  const makeCtx = (getUser: jest.Mock, logger = makeLogger()) =>
    ({
      clients: {
        audit: { sendEvent: jest.fn().mockResolvedValue(undefined) },
        masterdata: { getDocument: jest.fn() },
        storefrontPermissions: {
          getUser,
          updateUser: jest
            .fn()
            .mockResolvedValue({ data: { updateUser: { status: 'success' } } }),
        },
      },
      ip: '127.0.0.1',
      vtex: {
        account: 'b2bstoreqa',
        adminUserAuthToken: 'admin-token',
        logger,
      },
    } as unknown as Context)

  const args = { clId: 'cl-1', id: 'b2b-1', orgId: 'org-1', userId: 'user-1' }

  it('looks the user up by clId and audits it as entityBeforeAction', async () => {
    const getUser = jest
      .fn()
      .mockResolvedValue({ data: { getUser: { clId: 'cl-1', roleId: 'r1' } } })

    const ctx = makeCtx(getUser)
    const result = await Users.updateUser(
      undefined as never,
      args as never,
      ctx
    )

    expect(result).toEqual({ status: 'success' })
    expect(getUser).toHaveBeenCalledWith('cl-1')
    expect(ctx.clients.audit.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          entityBeforeAction: JSON.stringify({ clId: 'cl-1', roleId: 'r1' }),
        }),
      })
    )
  })

  it('logs warn updateUser.auditLookupError and still succeeds', async () => {
    const logger = makeLogger()
    const getUser = jest.fn().mockRejectedValue(
      Object.assign(new Error('boom'), {
        response: { headers: {}, status: 500 },
      })
    )

    const ctx = makeCtx(getUser, logger)
    const result = await Users.updateUser(
      undefined as never,
      args as never,
      ctx
    )

    expect(result).toEqual({ status: 'success' })
    expect(warnCalls(logger, 'updateUser.auditLookupError')).toEqual([
      expect.objectContaining({
        entity: 'User',
        error: expect.objectContaining({ status: 500 }),
        operation: 'updateUser',
        userId: 'user-1',
      }),
    ])
    expect(logger.error).not.toHaveBeenCalled()
    expect(ctx.clients.audit.sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ entityBeforeAction: 'null' }),
      })
    )
  })

  it('looks the user up before the update (pre-update entityBeforeAction)', async () => {
    const getUser = jest
      .fn()
      .mockResolvedValue({ data: { getUser: { clId: 'cl-1', roleId: 'old' } } })

    const ctx = makeCtx(getUser)

    await Users.updateUser(undefined as never, args as never, ctx)

    const { updateUser } = ctx.clients.storefrontPermissions as any

    expect(getUser.mock.invocationCallOrder[0]).toBeLessThan(
      updateUser.mock.invocationCallOrder[0]
    )
  })

  it('skips the lookup when there is no clId', async () => {
    const getUser = jest.fn()
    const ctx = makeCtx(getUser)

    await Users.updateUser(
      undefined as never,
      { ...args, clId: undefined } as never,
      ctx
    )

    expect(getUser).not.toHaveBeenCalled()
  })
})

describe('role lookup failure while checking access', () => {
  const orgId = 'org-1'

  const makeCtx = (
    logger: ReturnType<typeof makeLogger>,
    permissions = ['add-sales-users-all']
  ) =>
    ({
      clients: {
        audit: { sendEvent: jest.fn().mockResolvedValue(undefined) },
        events: { sendEvent: jest.fn() },
        masterdata: { getDocument: jest.fn().mockResolvedValue({}) },
        storefrontPermissions: {
          addUser: jest.fn(),
          deleteUser: jest.fn(),
          getRole: jest.fn().mockRejectedValue(
            Object.assign(new Error('getRole failed'), {
              response: { headers: {}, status: 503 },
            })
          ),
          getUser: jest.fn().mockRejectedValue(
            Object.assign(new Error('getUser failed'), {
              response: { headers: {}, status: 500 },
            })
          ),
          saveUser: jest.fn(),
          updateUser: jest.fn(),
        },
      },
      ip: '127.0.0.1',
      vtex: {
        account: 'b2bstoreqa',
        logger,
        sessionData: {
          namespaces: {
            'storefront-permissions': { organization: { value: orgId } },
          },
        },
        storefrontPermissions: { permissions },
      },
    } as unknown as Context)

  const roleErrors = (logger: ReturnType<typeof makeLogger>, op: string) =>
    logger.error.mock.calls
      .map(([payload]) => payload)
      .filter((payload) => payload?.message === `${op}.checkUserIsAllowedError`)

  // Only add-sales-users-all: the '' fallback slug is not a sales role, so
  // access is denied exactly as before; only the log changes.
  it.each([
    ['addUser', { clId: 'cl-1', orgId, roleId: 'r1' }, 500],
    ['updateUser', { clId: 'cl-1', orgId, roleId: 'r1' }, 500],
    ['saveUser', { clId: 'cl-1', orgId, roleId: 'r1' }, 500],
    ['saveUser', { orgId, roleId: 'r1' }, 503],
  ])(
    '%s: logs error <op>.checkUserIsAllowedError and still answers operation-not-permitted',
    async (op, args, status) => {
      const logger = makeLogger()
      const ctx = makeCtx(logger)

      await expect((Users as any)[op](undefined, args, ctx)).rejects.toThrow(
        'operation-not-permitted'
      )

      expect(roleErrors(logger, op)).toEqual([
        expect.objectContaining({
          entity: 'User',
          error: expect.objectContaining({ status }),
          operation: op,
          reason: 'role-lookup-failed',
        }),
      ])
      expect(
        logger.warn.mock.calls.filter(([p]) =>
          /getUserRoleSlug-error|getRoleError/.test(p?.message)
        )
      ).toHaveLength(0)
      expect(
        ctx.clients.storefrontPermissions.updateUser
      ).not.toHaveBeenCalled()
    }
  )

  it('removeUser: logs error removeUser.checkUserIsAllowedError, response unchanged', async () => {
    const logger = makeLogger()
    const ctx = makeCtx(logger, ['remove-users-organization'])

    // remove-users-organization with an empty role slug is still permitted,
    // exactly as before; only the log changes.
    await Users.removeUser(
      undefined as never,
      { clId: 'cl-1', email: EMAIL, id: 'b2b-1', userId: 'user-1' } as never,
      ctx
    ).catch(() => undefined)

    expect(roleErrors(logger, 'removeUser')).toEqual([
      expect.objectContaining({
        operation: 'removeUser',
        reason: 'role-lookup-failed',
      }),
    ])
    expect(allLoggedText(logger)).not.toContain(EMAIL)
  })
})
