import { AuthenticationError } from '@vtex/api'

import Organizations from '../resolvers/Queries/Organizations'
import { setValidatedStoreUserEmail } from '../utils/actingUserEmail'

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

jest.mock('../services/organizationDocuments', () => ({
  getOrganizationStatusFromState: jest.fn().mockReturnValue('active'),
  hydrateOrganizationsByEmail: jest.fn().mockResolvedValue(undefined),
  loadOrganization: jest.fn(),
}))

const makeCtx = ({
  getAuthenticatedUser = jest.fn(),
  namespaces = {} as any,
  organizations = [
    { clId: 'cl', costId: 'cc', id: '1', orgId: 'org', roleId: 'r' },
  ],
  storeUserAuthToken = undefined as string | undefined,
} = {}) => {
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }

  const getOrganizationsByEmail = jest.fn().mockResolvedValue({
    data: { getOrganizationsByEmail: organizations },
  })

  const checkUserPermission = jest
    .fn()
    .mockResolvedValue({ data: { checkUserPermission: null } })

  return {
    checkUserPermission,
    clients: {
      audit: { sendEvent: jest.fn().mockResolvedValue(undefined) },
      session: {
        getSession: jest.fn().mockResolvedValue({
          sessionData: namespaces ? { namespaces } : null,
        }),
      },
      storefrontPermissions: { checkUserPermission, getOrganizationsByEmail },
      vtexId: { getAuthenticatedUser },
    },
    getAuthenticatedUser,
    getOrganizationsByEmail,
    ip: '127.0.0.1',
    logger,
    vtex: {
      adminUserAuthToken: undefined,
      account: 'acc',
      logger,
      sessionToken: 'session-token',
      storeUserAuthToken,
      workspace: 'master',
    },
  } as any
}

describe('getActiveOrganizationsByEmail email resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /**
   * The production condition: a session token without private scope returns no
   * profile namespace, so nothing identifies the shopper. Passing that straight
   * to `getOrganizationsByEmail(email: String!)` is what produced thousands of
   * INTERNAL_SERVER_ERRORs attributed to storefront-permissions.
   */
  it('never calls storefront-permissions when no source identifies the user', async () => {
    const ctx = makeCtx()

    await expect(
      Organizations.getActiveOrganizationsByEmail(
        undefined as any,
        { email: undefined as any },
        ctx
      )
    ).rejects.toBeInstanceOf(AuthenticationError)

    expect(ctx.getOrganizationsByEmail).not.toHaveBeenCalled()
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'listOrganizationsByEmail-unresolvedEmail',
      })
    )
  })

  it('recovers the shopper from the store token when the session exposes no email', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ user: 'shopper@example.com' }),
      storeUserAuthToken: 'store-token',
    })

    const result = await Organizations.getActiveOrganizationsByEmail(
      undefined as any,
      { email: undefined as any },
      ctx
    )

    expect(ctx.getOrganizationsByEmail).toHaveBeenCalledWith(
      'shopper@example.com'
    )
    expect(result).toHaveLength(1)
  })

  it('reuses the email the auth directive validated instead of calling VTEX ID again', async () => {
    const ctx = makeCtx({ storeUserAuthToken: 'store-token' })

    setValidatedStoreUserEmail(ctx, 'directive@example.com')

    await Organizations.getActiveOrganizationsByEmail(
      undefined as any,
      { email: undefined as any },
      ctx
    )

    expect(ctx.getOrganizationsByEmail).toHaveBeenCalledWith(
      'directive@example.com'
    )
    expect(ctx.getAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('still prefers the session profile when it is available', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ user: 'token@example.com' }),
      namespaces: { profile: { email: { value: 'profile@example.com' } } },
      storeUserAuthToken: 'store-token',
    })

    await Organizations.getActiveOrganizationsByEmail(
      undefined as any,
      { email: undefined as any },
      ctx
    )

    expect(ctx.getOrganizationsByEmail).toHaveBeenCalledWith(
      'profile@example.com'
    )
    expect(ctx.getAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('records which source answered, so production shows what each fallback saves', async () => {
    const ctx = makeCtx({
      namespaces: {
        authentication: { storeUserEmail: { value: 'auth@example.com' } },
      },
    })

    await Organizations.getActiveOrganizationsByEmail(
      undefined as any,
      { email: undefined as any },
      ctx
    )

    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        emailSource: 'session-authentication',
        message: 'getActiveOrganizationsByEmail.timings',
      })
    )
  })
})
