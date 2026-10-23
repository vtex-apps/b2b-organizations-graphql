import { WithSession } from '../resolvers/directives/withSession'
import CostCenterMutations from '../resolvers/Mutations/CostCenters'
import Users from '../resolvers/Mutations/Users'
import CostCenters from '../resolvers/Queries/CostCenters'
import Organizations from '../resolvers/Queries/Organizations'
import UserQueries from '../resolvers/Queries/Users'
import {
  loadCostCenter,
  loadOrganization,
} from '../services/organizationDocuments'
import { authDenied, isAuthDenied, logAccessError } from '../utils/authDenied'
import GraphQLError from '../utils/GraphQLError'

jest.mock('@vtex/api', () => {
  const actual = jest.requireActual('@vtex/api')

  return {
    ...actual,
    LRUCache: class {
      public async getOrSet(_key: string, factory: () => Promise<any>) {
        const { value } = await factory()

        return value
      }

      public getStats(name: string) {
        return { hits: 0, itemCount: 0, misses: 0, name }
      }
    },
  }
})
jest.mock('@vtex/diagnostics-nodejs', () => ({}))
jest.mock('../resolvers/config')
jest.mock('../utils/metrics/impersonate')
jest.mock('../utils/queryObservability', () => ({
  ...jest.requireActual('../utils/queryObservability'),
  ensureConfigForQuery: jest.fn(),
}))

jest.mock('../services/organizationDocuments', () => ({
  addMissingAddressIds: jest.fn(),
  loadCostCenter: jest.fn(),
  loadOrganization: jest.fn(),
}))

const loadCostCenterMock = loadCostCenter as jest.Mock
const loadOrganizationMock = loadOrganization as jest.Mock

const SESSION_ORG = 'org-session'

const makeLogger = () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
})

const sessionWithOrg = () => ({
  namespaces: {
    'storefront-permissions': {
      costcenter: { value: 'cc-session' },
      organization: { value: SESSION_ORG },
    },
  },
})

const makeCtx = ({
  sessionData = sessionWithOrg() as any,
  permissions = [] as string[],
  clients = {} as any,
  adminUserAuthToken = undefined as string | undefined,
} = {}) => {
  const logger = makeLogger()

  return {
    clients: {
      analytics: { sendMetric: jest.fn().mockResolvedValue(undefined) },
      audit: {
        sendEvent: jest.fn().mockResolvedValue(undefined),
        sendEventStrict: jest.fn().mockResolvedValue(undefined),
      },
      masterdata: {},
      session: { getSession: jest.fn() },
      storefrontPermissions: {
        checkUserPermission: jest.fn().mockResolvedValue({
          data: { checkUserPermission: null },
        }),
        getB2BUser: jest.fn().mockResolvedValue({
          data: { getB2BUser: { costId: 'cc-other', orgId: 'org-other' } },
        }),
        getRole: jest.fn().mockResolvedValue({
          data: { getRole: { slug: 'buyer' } },
        }),
        getUser: jest.fn().mockResolvedValue({
          data: { getUser: { costId: 'cc-other', orgId: 'org-other' } },
        }),
        impersonateUser: jest.fn().mockResolvedValue({
          data: { impersonateUser: { status: 'success' } },
        }),
      },
      ...clients,
    },
    ip: '127.0.0.1',
    sendMetric: jest.fn().mockResolvedValue(undefined),
    vtex: {
      account: 'acc',
      adminUserAuthToken,
      logger,
      sessionData,
      storefrontPermissions: { permissions },
    },
  } as any
}

const deniedWarn = (fields: Record<string, unknown>) =>
  expect.objectContaining({ message: 'auth.denied', ...fields })

/** A deny is a warn, the throw is marked warn, and nothing logs error. */
const expectDenied = async (
  promise: Promise<unknown>,
  ctx: any,
  message: string,
  fields: Record<string, unknown>
) => {
  const error: any = await promise.then(
    () => {
      throw new Error('expected a deny')
    },
    (e) => e
  )

  expect(error.message).toBe(message)
  expect(error.level).toBe('warn')
  expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(deniedWarn(fields))
  expect(ctx.vtex.logger.warn).toHaveBeenCalledTimes(1)
  expect(ctx.vtex.logger.error).not.toHaveBeenCalled()

  return error
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
})

describe('authDenied helper', () => {
  it('logs one auth.denied warn and returns the same GraphQLError marked warn', () => {
    const logger = makeLogger()
    const error: any = authDenied(logger, {
      operation: 'addUser',
      orgId: 'org-1',
      reason: 'not-permitted',
    })

    expect(error).toBeInstanceOf(GraphQLError)
    expect(error.message).toBe('operation-not-permitted')
    expect(error.extensions).toEqual({ message: 'operation-not-permitted' })
    expect(error.level).toBe('warn')
    expect(logger.warn).toHaveBeenCalledWith({
      message: 'auth.denied',
      operation: 'addUser',
      orgId: 'org-1',
      reason: 'not-permitted',
    })
    expect(isAuthDenied(error)).toBe(true)
  })

  it('keeps organization-data-not-found and omits empty ids', () => {
    const logger = makeLogger()
    const error: any = authDenied(logger, {
      operation: 'getOrganizationByIdStorefront',
      orgId: undefined,
      reason: 'organization-data-not-found',
    })

    expect(error.message).toBe('organization-data-not-found')
    expect(logger.warn).toHaveBeenCalledWith({
      message: 'auth.denied',
      operation: 'getOrganizationByIdStorefront',
      reason: 'organization-data-not-found',
    })
  })

  it('throws inactive-organization as a plain Error, as before', () => {
    const error: any = authDenied(makeLogger(), {
      operation: 'getCostCenterByIdStorefront',
      reason: 'inactive-organization',
    })

    expect(error).not.toBeInstanceOf(GraphQLError)
    expect(error.message).toBe('This organization is not active')
    expect(error.extensions).toBeUndefined()
    expect(error.level).toBe('warn')
  })

  it('adds no enumerable field besides level (response unchanged)', () => {
    const error = authDenied(makeLogger(), {
      operation: 'x',
      reason: 'not-permitted',
    })

    expect(Object.keys(error).sort((a, b) => a.localeCompare(b))).toEqual([
      'extensions',
      'level',
    ])
  })

  it('isAuthDenied is false for any other error', () => {
    expect(isAuthDenied(new GraphQLError('operation-not-permitted'))).toBe(
      false
    )
    expect(isAuthDenied(null)).toBe(false)
    expect(isAuthDenied('operation-not-permitted')).toBe(false)
  })

  it('logAccessError logs error with describeClientError, never the raw error', () => {
    const logger = makeLogger()
    const raw: any = new Error('boom for qa@example.com')

    raw.config = { data: '{"secret":true}', url: '/x?email=qa@example.com' }
    logAccessError(
      logger,
      'impersonateB2BUser.error',
      { targetUserId: 'u1' },
      raw
    )

    const [[payload]] = logger.error.mock.calls

    expect(payload.message).toBe('impersonateB2BUser.error')
    expect(payload.targetUserId).toBe('u1')
    expect(payload.error.message).toBe('boom for <redacted-email>')
    expect(payload.error.path).toBe('/x')
    expect(JSON.stringify(payload)).not.toContain('secret')
  })
})

describe('@withSession', () => {
  const visit = () => {
    const field: any = { resolve: jest.fn().mockResolvedValue('resolved') }
    const visitor = Object.create(WithSession.prototype)

    visitor.visitFieldDefinition(field)

    return field
  }

  it('keeps the session on success without logging', async () => {
    const field = visit()
    const ctx = makeCtx({ sessionData: undefined })

    ctx.clients.session.getSession.mockResolvedValue({ sessionData: { a: 1 } })

    await field.resolve({}, {}, ctx, { fieldName: 'getUsers' })

    expect(ctx.vtex.sessionData).toEqual({ a: 1 })
    expect(ctx.vtex.logger.warn).not.toHaveBeenCalled()
  })

  it.each([404, 500, 503])(
    'warns withSession.getSessionError on %s and continues with null',
    async (status) => {
      const field = visit()
      const ctx = makeCtx({ sessionData: undefined })
      const error: any = new Error(`Request failed with status code ${status}`)

      error.response = { status, headers: {} }
      ctx.clients.session.getSession.mockRejectedValue(error)

      const result = await field.resolve({}, {}, ctx, {
        fieldName: 'getOrganizationByIdStorefront',
      })

      expect(result).toBe('resolved')
      expect(ctx.vtex.sessionData).toBeNull()
      expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ status }),
          message: 'withSession.getSessionError',
          operation: 'getOrganizationByIdStorefront',
        })
      )
      expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
    }
  )
})

describe('Mutations/Users denies', () => {
  it('impersonateB2BUser without session organization', async () => {
    const ctx = makeCtx({ sessionData: null })

    await expectDenied(
      Users.impersonateB2BUser(undefined as never, { id: 'target-1' }, ctx),
      ctx,
      'organization-data-not-found',
      {
        operation: 'impersonateB2BUser',
        reason: 'organization-data-not-found',
        targetUserId: 'target-1',
      }
    )
    expect(
      ctx.clients.storefrontPermissions.impersonateUser
    ).not.toHaveBeenCalled()
  })

  it('impersonateB2BUser without permission', async () => {
    const ctx = makeCtx()

    await expectDenied(
      Users.impersonateB2BUser(undefined as never, { id: 'target-1' }, ctx),
      ctx,
      'operation-not-permitted',
      {
        operation: 'impersonateB2BUser',
        orgId: 'org-other',
        reason: 'not-permitted',
        targetUserId: 'target-1',
      }
    )
  })

  it('impersonateB2BUser client failure stays error impersonateB2BUser.error', async () => {
    const ctx = makeCtx({ permissions: ['impersonate-users-all'] })
    const sfp = ctx.vtex.sessionData.namespaces['storefront-permissions']

    sfp.userId = { value: 'actor-1' }
    ctx.vtex.sessionData.namespaces.profile = { email: { value: 'a@b.co' } }
    ctx.clients.storefrontPermissions.impersonateUser.mockRejectedValue(
      new Error('boom')
    )

    await Users.impersonateB2BUser(undefined as never, { id: 'target-1' }, ctx)

    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'boom' }),
        message: 'impersonateB2BUser.error',
        operation: 'impersonateB2BUser',
        targetUserId: 'target-1',
      })
    )
    expect(ctx.vtex.logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'auth.denied' })
    )
  })

  it('impersonateUser without session organization', async () => {
    const ctx = makeCtx({ sessionData: null })

    await expectDenied(
      Users.impersonateUser(undefined as never, { clId: 'cl-1' } as any, ctx),
      ctx,
      'organization-data-not-found',
      {
        operation: 'impersonateUser',
        reason: 'organization-data-not-found',
        targetUserId: 'cl-1',
      }
    )
  })

  it('impersonateUser without permission', async () => {
    const ctx = makeCtx()

    await expectDenied(
      Users.impersonateUser(undefined as never, { clId: 'cl-1' } as any, ctx),
      ctx,
      'operation-not-permitted',
      {
        operation: 'impersonateUser',
        orgId: 'org-other',
        reason: 'not-permitted',
        targetUserId: 'cl-1',
      }
    )
  })

  it('impersonateUser client failure logs impersonateUser.error', async () => {
    const ctx = makeCtx({ adminUserAuthToken: 'admin' })

    ctx.clients.storefrontPermissions.impersonateUser.mockRejectedValue(
      new Error('boom')
    )

    await Users.impersonateUser(
      undefined as never,
      { userId: 'user-1' } as any,
      ctx
    )

    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'impersonateUser.error',
        operation: 'impersonateUser',
        targetUserId: 'user-1',
      })
    )
  })

  const removeArgs = { clId: 'cl-1', email: 'qa@example.com', id: 'u-1' }

  it('removeUser without session organization', async () => {
    const ctx = makeCtx({ sessionData: null })

    await expectDenied(
      Users.removeUser(undefined as never, removeArgs as any, ctx),
      ctx,
      'organization-data-not-found',
      {
        operation: 'removeUser',
        reason: 'organization-data-not-found',
        targetUserId: 'u-1',
      }
    )
  })

  it('removeUser without permission', async () => {
    const ctx = makeCtx()

    ctx.clients.storefrontPermissions.getUser.mockResolvedValue({
      data: { getUser: { roleId: 'r1' } },
    })

    await expectDenied(
      Users.removeUser(undefined as never, removeArgs as any, ctx),
      ctx,
      'operation-not-permitted',
      { operation: 'removeUser', reason: 'not-permitted', targetUserId: 'u-1' }
    )
  })

  describe.each(['addUser', 'updateUser', 'saveUser'] as const)(
    '%s (checkUserIsAllowed)',
    (operation) => {
      const args = { email: 'qa@example.com', orgId: 'org-1', roleId: 'r1' }

      it('denies without session organization: warn only, no checkUserIsAllowedError', async () => {
        const ctx = makeCtx({ sessionData: null })

        await expectDenied(
          (Users as any)[operation](undefined, args, ctx),
          ctx,
          'organization-data-not-found',
          { operation, orgId: 'org-1', reason: 'organization-data-not-found' }
        )
      })

      it('denies without permission: warn only', async () => {
        const ctx = makeCtx()

        await expectDenied(
          (Users as any)[operation](undefined, args, ctx),
          ctx,
          'operation-not-permitted',
          { operation, orgId: 'org-1', reason: 'not-permitted' }
        )
      })

      it('logs error <op>.checkUserIsAllowedError for a non-deny failure', async () => {
        const ctx = makeCtx({ clients: { storefrontPermissions: undefined } })

        await expect(
          (Users as any)[operation](undefined, args, ctx)
        ).rejects.toThrow(TypeError)
        expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ message: expect.any(String) }),
            message: `${operation}.checkUserIsAllowedError`,
            operation,
          })
        )
        expect(ctx.vtex.logger.warn).not.toHaveBeenCalledWith(
          expect.objectContaining({ message: 'auth.denied' })
        )
      })
    }
  )
})

describe('storefront query denies', () => {
  it('getOrganizationByIdStorefront without session organization', async () => {
    const ctx = makeCtx({ sessionData: null })

    await expectDenied(
      Organizations.getOrganizationByIdStorefront(
        undefined as never,
        { id: 'org-1' },
        ctx
      ),
      ctx,
      'organization-data-not-found',
      {
        operation: 'getOrganizationByIdStorefront',
        reason: 'organization-data-not-found',
      }
    )
  })

  it('getOrganizationByIdStorefront for another organization', async () => {
    const ctx = makeCtx()

    await expectDenied(
      Organizations.getOrganizationByIdStorefront(
        undefined as never,
        { id: 'org-1' },
        ctx
      ),
      ctx,
      'operation-not-permitted',
      {
        operation: 'getOrganizationByIdStorefront',
        orgId: SESSION_ORG,
        reason: 'not-permitted',
      }
    )
    expect(loadOrganizationMock).not.toHaveBeenCalled()
  })

  it('getCostCenterByIdStorefront with inactive organization', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(false as any)
    const ctx = makeCtx()

    const error = await expectDenied(
      CostCenters.getCostCenterByIdStorefront(
        undefined as never,
        { id: 'cc' },
        ctx
      ),
      ctx,
      'This organization is not active',
      {
        operation: 'getCostCenterByIdStorefront',
        orgId: SESSION_ORG,
        reason: 'inactive-organization',
      }
    )

    expect(error).not.toBeInstanceOf(GraphQLError)
  })

  it('getCostCenterByIdStorefront without session organization', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)
    const ctx = makeCtx({ sessionData: { namespaces: {} } })

    await expectDenied(
      CostCenters.getCostCenterByIdStorefront(
        undefined as never,
        { id: 'cc' },
        ctx
      ),
      ctx,
      'organization-data-not-found',
      {
        operation: 'getCostCenterByIdStorefront',
        reason: 'organization-data-not-found',
      }
    )
  })

  it('getCostCenterByIdStorefront from another organization: warn, no getCostCenterByIdStorefront-error', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)
    loadCostCenterMock.mockResolvedValue({
      id: 'cc',
      organization: 'org-other',
    })
    const ctx = makeCtx()

    await expectDenied(
      CostCenters.getCostCenterByIdStorefront(
        undefined as never,
        { id: 'cc' },
        ctx
      ),
      ctx,
      'operation-not-permitted',
      {
        operation: 'getCostCenterByIdStorefront',
        orgId: SESSION_ORG,
        reason: 'not-permitted',
      }
    )
  })

  it('getCostCenterByIdStorefront still logs error for a real failure', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)
    loadCostCenterMock.mockRejectedValue(new Error('md down'))
    const ctx = makeCtx()

    await expect(
      CostCenters.getCostCenterByIdStorefront(
        undefined as never,
        { id: 'cc' },
        ctx
      )
    ).rejects.toThrow('md down')
    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'getCostCenterByIdStorefront-error' })
    )
  })

  const byOrg = (ctx: any, id?: string) =>
    CostCenters.getCostCentersByOrganizationIdStorefront(
      undefined as never,
      { id } as any,
      ctx
    )

  it('getCostCentersByOrganizationIdStorefront with inactive organization', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(false as any)
    const ctx = makeCtx()

    await expectDenied(
      byOrg(ctx, 'org-1'),
      ctx,
      'This organization is not active',
      {
        operation: 'getCostCentersByOrganizationIdStorefront',
        reason: 'inactive-organization',
      }
    )
  })

  it('getCostCentersByOrganizationIdStorefront without session organization', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)
    const ctx = makeCtx({ sessionData: { namespaces: {} } })

    await expectDenied(
      byOrg(ctx, 'org-1'),
      ctx,
      'organization-data-not-found',
      {
        operation: 'getCostCentersByOrganizationIdStorefront',
        reason: 'organization-data-not-found',
      }
    )
  })

  it('getCostCentersByOrganizationIdStorefront for another organization', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)
    const ctx = makeCtx()

    await expectDenied(byOrg(ctx, 'org-1'), ctx, 'operation-not-permitted', {
      operation: 'getCostCentersByOrganizationIdStorefront',
      orgId: SESSION_ORG,
      reason: 'not-permitted',
    })
  })

  it.each([
    ['getUsers', 'getUsers'],
    ['getUsersPaginated', 'getUsersPaginated'],
  ])('%s without session organization / other organization', async (_, op) => {
    const noOrg = makeCtx({ sessionData: null })

    await expectDenied(
      (UserQueries as any)[op](undefined, { organizationId: 'org-1' }, noOrg),
      noOrg,
      'organization-data-not-found',
      { operation: op, reason: 'organization-data-not-found' }
    )

    const other = makeCtx()

    await expectDenied(
      (UserQueries as any)[op](undefined, { organizationId: 'org-1' }, other),
      other,
      'operation-not-permitted',
      { operation: op, orgId: 'org-1', reason: 'not-permitted' }
    )
  })

  it('getOrganizationsWithoutSalesManager without admin or sales-admin', async () => {
    const ctx = makeCtx()

    ctx.clients.session.getSession.mockResolvedValue({ sessionData: {} })

    await expectDenied(
      UserQueries.getOrganizationsWithoutSalesManager(
        undefined as never,
        undefined as never,
        ctx
      ),
      ctx,
      'operation-not-permitted',
      {
        operation: 'getOrganizationsWithoutSalesManager',
        reason: 'not-permitted',
      }
    )
  })
})

describe('createCostCenter without organizationId nor session organization', () => {
  it('denies with warn', async () => {
    const ctx = makeCtx({ sessionData: { namespaces: {} } })

    await expectDenied(
      CostCenterMutations.createCostCenter(
        undefined as never,
        { input: { name: 'qa' } } as any,
        ctx
      ),
      ctx,
      'organization-data-not-found',
      { operation: 'createCostCenter', reason: 'organization-data-not-found' }
    )
  })
})

describe('getOrganizationById not found (SDD Q6)', () => {
  it('warns getOrganizationById.notFound and marks the throw warn', async () => {
    const notFound: any = new Error('organizationNotFound')

    notFound.organizationNotFound = true
    loadOrganizationMock.mockRejectedValue(notFound)
    const ctx = makeCtx()

    const error: any = await Organizations.getOrganizationById(
      undefined as never,
      { id: 'org-missing' },
      ctx
    ).catch((e: any) => e)

    expect(error).toBeInstanceOf(GraphQLError)
    expect(error.message).toBe('organizationNotFound')
    expect(error.level).toBe('warn')
    expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'Organization',
        entityId: 'org-missing',
        message: 'getOrganizationById.notFound',
        operation: 'getOrganizationById',
      })
    )
    expect(ctx.vtex.logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'getOrganizationById-error' })
    )
  })

  it('keeps error for a real failure', async () => {
    loadOrganizationMock.mockRejectedValue(new Error('md down'))
    const ctx = makeCtx()

    const error: any = await Organizations.getOrganizationById(
      undefined as never,
      { id: 'org-1' },
      ctx
    ).catch((e: any) => e)

    expect(error.level).toBeUndefined()
    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'getOrganizationById-error' })
    )
  })
})

describe('review on #240', () => {
  describe.each([
    ['getCostCenterByIdStorefront', { id: 'cc' }],
    ['getCostCentersByOrganizationIdStorefront', { id: 'org-session' }],
  ] as const)(
    '%s without session (real checkOrganizationIsActive)',
    (op, args) => {
      it('denies with one auth.denied warn, same plain Error and message', async () => {
        const ctx = makeCtx({ sessionData: null })

        ctx.clients.session.getSession.mockResolvedValue({ sessionData: null })

        const error = await expectDenied(
          (CostCenters as any)[op](undefined, args, ctx),
          ctx,
          'No session data for this current user',
          { operation: 'checkOrganizationIsActive', reason: 'no-session' }
        )

        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(GraphQLError)
        expect(Object.keys(error)).toEqual(['level'])
        expect(loadCostCenterMock).not.toHaveBeenCalled()
      })
    }
  )

  describe.each(['addUser', 'updateUser', 'saveUser'] as const)(
    '%s role lookup failure',
    (operation) => {
      const args = { email: 'qa@example.com', orgId: 'org-1', roleId: 'r1' }

      it('logs error <op>.checkUserIsAllowedError (role-lookup-failed), not auth.denied; same response', async () => {
        const ctx = makeCtx()

        ctx.clients.storefrontPermissions.getRole.mockRejectedValue(
          new Error('sfp down')
        )

        const error: any = await (Users as any)
          [operation](undefined, args, ctx)
          .catch((e: any) => e)

        expect(error).toBeInstanceOf(GraphQLError)
        expect(error.message).toBe('operation-not-permitted')
        expect(error.level).toBeUndefined()
        expect(ctx.vtex.logger.error).toHaveBeenCalledTimes(1)
        expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ message: 'sfp down' }),
            entity: 'User',
            message: `${operation}.checkUserIsAllowedError`,
            operation,
            orgId: 'org-1',
            reason: 'role-lookup-failed',
          })
        )
        expect(ctx.vtex.logger.warn).not.toHaveBeenCalledWith(
          expect.objectContaining({ message: 'auth.denied' })
        )
      })

      it('still logs the failure when the fallback role is permitted', async () => {
        const ctx = makeCtx({ permissions: ['add-users-organization'] })

        ctx.clients.storefrontPermissions.getRole.mockRejectedValue(
          new Error('sfp down')
        )
        Object.assign(ctx.clients.storefrontPermissions, {
          addUser: jest.fn().mockResolvedValue({ data: {} }),
          saveUser: jest.fn().mockResolvedValue({ data: {} }),
          updateUser: jest.fn().mockResolvedValue({ data: {} }),
        })

        await (Users as any)
          [operation](undefined, { ...args, orgId: SESSION_ORG }, ctx)
          .catch(() => undefined)

        expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            message: `${operation}.checkUserIsAllowedError`,
            reason: 'role-lookup-failed',
          })
        )
        expect(ctx.vtex.logger.warn).not.toHaveBeenCalledWith(
          expect.objectContaining({ message: 'auth.denied' })
        )
      })
    }
  )

  it('removeUser role lookup failure: error, not auth.denied, same response', async () => {
    const ctx = makeCtx()

    ctx.clients.storefrontPermissions.getUser.mockRejectedValue(
      new Error('sfp down')
    )

    const error: any = await Users.removeUser(
      undefined as never,
      { clId: 'cl-1', email: 'qa@example.com', id: 'u-1' } as any,
      ctx
    ).catch((e: any) => e)

    expect(error).toBeInstanceOf(GraphQLError)
    expect(error.message).toBe('operation-not-permitted')
    expect(error.level).toBeUndefined()
    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'sfp down' }),
        entity: 'User',
        message: 'removeUser.checkUserIsAllowedError',
        operation: 'removeUser',
        reason: 'role-lookup-failed',
        targetUserId: 'u-1',
      })
    )
    expect(ctx.vtex.logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'auth.denied' })
    )
  })

  it('impersonateUser user lookup failure: error, not auth.denied, same response', async () => {
    const ctx = makeCtx()

    ctx.clients.storefrontPermissions.getUser.mockRejectedValue(
      new Error('sfp down')
    )

    const error: any = await Users.impersonateUser(
      undefined as never,
      { clId: 'cl-1' } as any,
      ctx
    ).catch((e: any) => e)

    expect(error).toBeInstanceOf(GraphQLError)
    expect(error.message).toBe('operation-not-permitted')
    expect(error.level).toBeUndefined()
    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'impersonateUser.checkUserIsAllowedError',
        operation: 'impersonateUser',
        reason: 'user-lookup-failed',
        targetUserId: 'cl-1',
      })
    )
    expect(ctx.vtex.logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'auth.denied' })
    )
  })

  it('getOrganizationByIdStorefront not found: warn and throw marked warn', async () => {
    const notFound: any = new Error('organizationNotFound')

    notFound.organizationNotFound = true
    loadOrganizationMock.mockRejectedValue(notFound)
    const ctx = makeCtx()

    const error: any = await Organizations.getOrganizationByIdStorefront(
      undefined as never,
      { id: SESSION_ORG },
      ctx
    ).catch((e: any) => e)

    expect(error).toBeInstanceOf(GraphQLError)
    expect(error.message).toBe('organizationNotFound')
    expect(error.level).toBe('warn')
    expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'Organization',
        entityId: SESSION_ORG,
        message: 'getOrganizationByIdStorefront.notFound',
        operation: 'getOrganizationByIdStorefront',
      })
    )
    expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
  })

  it('getOrganizationByIdStorefront real failure stays error', async () => {
    loadOrganizationMock.mockRejectedValue(new Error('md down'))
    const ctx = makeCtx()

    const error: any = await Organizations.getOrganizationByIdStorefront(
      undefined as never,
      { id: SESSION_ORG },
      ctx
    ).catch((e: any) => e)

    expect(error.message).toBe('md down')
    expect(error.level).toBeUndefined()
    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'getOrganizationByIdStorefront-error',
      })
    )
  })
})
