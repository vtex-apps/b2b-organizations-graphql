import {
  getValidatedStoreUserEmail,
  resolveActingUserEmail,
  setValidatedStoreUserEmail,
} from '../utils/actingUserEmail'

const makeCtx = ({
  getAuthenticatedUser = jest.fn(),
  storeUserAuthToken = undefined as string | undefined,
} = {}) => {
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }

  return {
    clients: { vtexId: { getAuthenticatedUser } },
    getAuthenticatedUser,
    logger,
    vtex: { logger, storeUserAuthToken },
  } as any
}

const sessionWith = (namespaces: any) => ({ namespaces })

describe('resolveActingUserEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('prefers the explicit argument over every session source', async () => {
    const ctx = makeCtx()

    const result = await resolveActingUserEmail({
      ctx,
      email: 'argument@example.com',
      sessionData: sessionWith({
        profile: { email: { value: 'profile@example.com' } },
      }),
    })

    expect(result).toEqual({
      email: 'argument@example.com',
      source: 'argument',
    })
    expect(ctx.getAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('falls back to the profile namespace', async () => {
    const result = await resolveActingUserEmail({
      ctx: makeCtx(),
      sessionData: sessionWith({
        profile: { email: { value: 'profile@example.com' } },
      }),
    })

    expect(result).toEqual({
      email: 'profile@example.com',
      source: 'session-profile',
    })
  })

  it('falls back to the authentication namespace when profile is absent', async () => {
    const result = await resolveActingUserEmail({
      ctx: makeCtx(),
      sessionData: sessionWith({
        authentication: { storeUserEmail: { value: 'auth@example.com' } },
      }),
    })

    expect(result).toEqual({
      email: 'auth@example.com',
      source: 'session-authentication',
    })
  })

  // The condition behind the incident: a session token without private scope
  // returns no profile namespace at all, for an ordinary logged-in shopper.
  it('recovers the email from the store token when the session carries none', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ user: 'token@example.com' }),
      storeUserAuthToken: 'store-token',
    })

    const result = await resolveActingUserEmail({
      ctx,
      sessionData: sessionWith({}),
    })

    expect(result).toEqual({
      email: 'token@example.com',
      source: 'store-token',
    })
    expect(ctx.getAuthenticatedUser).toHaveBeenCalledWith('store-token')
  })

  it('reuses the email the auth directive already validated, without asking VTEX ID again', async () => {
    const ctx = makeCtx({ storeUserAuthToken: 'store-token' })

    setValidatedStoreUserEmail(ctx, 'directive@example.com')

    const result = await resolveActingUserEmail({ ctx, sessionData: null })

    expect(result).toEqual({
      email: 'directive@example.com',
      source: 'store-token',
    })
    expect(ctx.getAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('stashes a freshly looked-up email so a second resolution is free', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ user: 'token@example.com' }),
      storeUserAuthToken: 'store-token',
    })

    await resolveActingUserEmail({ ctx, sessionData: null })
    await resolveActingUserEmail({ ctx, sessionData: null })

    expect(ctx.getAuthenticatedUser).toHaveBeenCalledTimes(1)
    expect(getValidatedStoreUserEmail(ctx)).toBe('token@example.com')
  })

  it('reports none when there is no session and no store token', async () => {
    const ctx = makeCtx()

    const result = await resolveActingUserEmail({ ctx, sessionData: null })

    expect(result).toEqual({ email: null, source: 'none' })
    expect(ctx.getAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('reports none and warns when VTEX ID rejects the token, instead of throwing', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest.fn().mockRejectedValue(new Error('401')),
      storeUserAuthToken: 'expired-token',
    })

    const result = await resolveActingUserEmail({ ctx, sessionData: null })

    expect(result).toEqual({ email: null, source: 'none' })
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'resolveActingUserEmail.storeTokenError',
      })
    )
  })

  // The store token belongs to the operator, not to the shopper being
  // impersonated. Answering with it would list the wrong person's
  // organizations, which is worse than not answering.
  it('refuses the store token while B2B impersonation is active', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ user: 'operator@example.com' }),
      storeUserAuthToken: 'store-token',
    })

    const result = await resolveActingUserEmail({
      ctx,
      sessionData: sessionWith({
        public: { impersonate: { value: 'user-id' } },
      }),
    })

    expect(result).toEqual({ email: null, source: 'none' })
    expect(ctx.getAuthenticatedUser).not.toHaveBeenCalled()
  })

  it('refuses the store token while telemarketing impersonation is active', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ user: 'operator@example.com' }),
      storeUserAuthToken: 'store-token',
    })

    const result = await resolveActingUserEmail({
      ctx,
      sessionData: sessionWith({
        impersonate: { storeUserId: { value: 'user-id' } },
      }),
    })

    expect(result).toEqual({ email: null, source: 'none' })
    expect(ctx.getAuthenticatedUser).not.toHaveBeenCalled()
  })

  // `canImpersonate` rides along on every session of a sales representative,
  // including their own. Treating it as impersonation would deny them the
  // token fallback on ordinary requests.
  it('does not treat the canImpersonate capability flag as active impersonation', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ user: 'rep@example.com' }),
      storeUserAuthToken: 'store-token',
    })

    const result = await resolveActingUserEmail({
      ctx,
      sessionData: sessionWith({
        impersonate: { canImpersonate: { value: 'true' } },
      }),
    })

    expect(result).toEqual({ email: 'rep@example.com', source: 'store-token' })
  })

  it('treats an empty-string email as absent rather than as an answer', async () => {
    const result = await resolveActingUserEmail({
      ctx: makeCtx(),
      email: '',
      sessionData: sessionWith({
        profile: { email: { value: 'profile@example.com' } },
      }),
    })

    expect(result.source).toBe('session-profile')
  })
})

/**
 * Shaped after a real authenticated session on a B2B account: both `profile`
 * and `authentication` carry the email, the `storefront-permissions` namespace
 * carries the organization but no email at all, and the store token is present.
 */
describe('resolveActingUserEmail on a full B2B session', () => {
  const fullSession = sessionWith({
    authentication: {
      storeSessionId: { value: 'sess-id' },
      storeUserEmail: { value: 'shopper@example.com' },
      storeUserId: { value: 'user-id' },
    },
    impersonate: { canImpersonate: { value: 'false' } },
    profile: {
      email: { value: 'shopper@example.com' },
      id: { value: 'user-id' },
      isAuthenticated: { value: 'true' },
    },
    'storefront-permissions': {
      costcenter: { value: '0000000000' },
      hash: { value: 'hash' },
      organization: { value: '0000000000' },
      userId: { value: 'sfp-user-id' },
    },
  })

  it('resolves from the profile namespace', async () => {
    const result = await resolveActingUserEmail({
      ctx: makeCtx({ storeUserAuthToken: 'store-token' }),
      sessionData: fullSession,
    })

    expect(result).toEqual({
      email: 'shopper@example.com',
      source: 'session-profile',
    })
  })

  // The scope-less variant of the same session: the private namespaces are
  // withheld, `public` survives, and nothing in it names the shopper.
  it('falls through to the store token when the private namespaces are withheld', async () => {
    const ctx = makeCtx({
      getAuthenticatedUser: jest
        .fn()
        .mockResolvedValue({ user: 'shopper@example.com' }),
      storeUserAuthToken: 'store-token',
    })

    const result = await resolveActingUserEmail({
      ctx,
      sessionData: sessionWith({
        public: { facets: { value: 'productClusterIds=143;' } },
        store: { channel: { value: '1' } },
      }),
    })

    expect(result).toEqual({
      email: 'shopper@example.com',
      source: 'store-token',
    })
  })
})

describe('setValidatedStoreUserEmail', () => {
  it('ignores empty values so a blank never shadows a later real one', () => {
    const ctx = makeCtx()

    setValidatedStoreUserEmail(ctx, '')
    setValidatedStoreUserEmail(ctx, null)

    expect(getValidatedStoreUserEmail(ctx)).toBeUndefined()

    setValidatedStoreUserEmail(ctx, 'real@example.com')

    expect(getValidatedStoreUserEmail(ctx)).toBe('real@example.com')
  })
})
