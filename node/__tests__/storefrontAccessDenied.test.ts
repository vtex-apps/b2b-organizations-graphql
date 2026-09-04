import CostCenters from '../resolvers/Queries/CostCenters'
import Organizations from '../resolvers/Queries/Organizations'
import { loadCostCenter } from '../services/organizationDocuments'

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
  addMissingAddressIds: jest.fn(),
  loadCostCenter: jest.fn(),
  loadOrganization: jest.fn(),
}))

const loadCostCenterMock = loadCostCenter as jest.Mock

const SESSION_ORG = 'org-session'
const OTHER_ORG = 'org-other'

const makeCtx = ({
  pendingCostCenter,
  sendMetric = jest.fn().mockResolvedValue(undefined),
  sessionCostCenter = 'cc-session',
  sessionOrganization = SESSION_ORG,
  withPublicNamespace = true,
}: {
  pendingCostCenter?: string
  sendMetric?: jest.Mock
  sessionCostCenter?: string
  sessionOrganization?: string
  withPublicNamespace?: boolean
} = {}) => {
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }

  const namespaces: any = {
    'storefront-permissions': {
      costcenter: { value: sessionCostCenter },
      organization: { value: sessionOrganization },
    },
  }

  if (withPublicNamespace) {
    namespaces.public = pendingCostCenter
      ? { b2bCurrentCostCenter: { value: pendingCostCenter } }
      : {}
  }

  return {
    clients: {
      analytics: { sendMetric },
      audit: { sendEvent: jest.fn().mockResolvedValue(undefined) },
      session: { getSession: jest.fn() },
    },
    ip: '127.0.0.1',
    logger,
    sendMetric,
    vtex: { account: 'acc', logger, sessionData: { namespaces } },
  } as any
}

const metricFrom = (ctx: any) =>
  ctx.sendMetric.mock.calls.find(
    (call: any[]) => call[0]?.kind === 'storefront-access-denied-event'
  )?.[0]

const mismatchLog = (ctx: any) =>
  ctx.logger.warn.mock.calls.find(
    (call: any[]) =>
      call[0]?.message === 'getCostCenterByIdStorefront-organizationMismatch'
  )?.[0]

const askFor = (ctx: any, id: string) =>
  CostCenters.getCostCenterByIdStorefront(undefined as any, { id }, ctx)

describe('getCostCenterByIdStorefront organization mismatch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /**
   * The suspected race: the shopper just picked this cost center, so
   * `setCurrentOrganization` already wrote it to `public.b2bCurrentCostCenter`,
   * but the `storefront-permissions` namespace still names the previous
   * organization. `matchesPendingSelection` is what separates this from a real
   * permission failure without needing a cross-app join.
   */
  it('flags the pending selection when the shopper had just picked the rejected cost center', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-new',
      organization: OTHER_ORG,
    })

    const ctx = makeCtx({ pendingCostCenter: 'cc-new' })

    await expect(askFor(ctx, 'cc-new')).rejects.toBeDefined()

    expect(mismatchLog(ctx)).toMatchObject({
      costCenterOrganization: OTHER_ORG,
      matchesPendingSelection: true,
      pendingCostCenterId: 'cc-new',
      requestedCostCenterId: 'cc-new',
      sessionOrganization: SESSION_ORG,
    })
  })

  it('does not flag it when the rejected cost center is not what the shopper selected', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-unrelated',
      organization: OTHER_ORG,
    })

    const ctx = makeCtx({ pendingCostCenter: 'cc-new' })

    await expect(askFor(ctx, 'cc-unrelated')).rejects.toBeDefined()

    expect(mismatchLog(ctx)).toMatchObject({
      matchesPendingSelection: false,
      pendingCostCenterId: 'cc-new',
      requestedCostCenterId: 'cc-unrelated',
    })
  })

  it('does not flag it when the session carries no pending selection', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-new',
      organization: OTHER_ORG,
    })

    const ctx = makeCtx()

    await expect(askFor(ctx, 'cc-new')).rejects.toBeDefined()

    expect(mismatchLog(ctx)).toMatchObject({
      matchesPendingSelection: false,
      pendingCostCenterId: null,
    })
  })

  /**
   * The app declares no `vtex.session` configuration, so it is unverified
   * whether the `public` namespace comes back at all. Without this field a null
   * `pendingCostCenterId` would be ambiguous between "nothing was selected" and
   * "we cannot see that namespace".
   */
  it('reports which namespaces the session actually returned', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-new',
      organization: OTHER_ORG,
    })

    const withPublic = makeCtx({ pendingCostCenter: 'cc-new' })

    await expect(askFor(withPublic, 'cc-new')).rejects.toBeDefined()
    expect(mismatchLog(withPublic).sessionNamespaces).toEqual(
      expect.arrayContaining(['storefront-permissions', 'public'])
    )

    const withoutPublic = makeCtx({ withPublicNamespace: false })

    await expect(askFor(withoutPublic, 'cc-new')).rejects.toBeDefined()

    const reported = mismatchLog(withoutPublic)

    expect(reported.sessionNamespaces).not.toContain('public')
    expect(reported.pendingCostCenterId).toBeNull()
  })

  /**
   * The guard read `sessionData?.namespaces['storefront-permissions']`: the
   * `?.` covered `sessionData` but not `namespaces`, so a session that arrives
   * without namespaces threw a TypeError instead of the named error the line
   * was written to throw. That matters beyond robustness - an incomplete
   * session is the very condition under investigation here, and a generic
   * "Cannot read properties of undefined" says nothing about which namespace
   * was missing. Seen on live traffic on 2.7.0, 2.7.1 and the beta.
   */
  /**
   * The log alone cannot answer this: the IO pipeline samples every line 1:20
   * independently, per line rather than per request, so a rejection that emits
   * three lines still has only ~5% odds of the diagnostic one surviving. At the
   * observed four to five rejections a day that is one sample every four days.
   * Analytics is not sampled, so the same fields also go there.
   */
  it('also ships the diagnostics through the unsampled analytics channel', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-new',
      organization: OTHER_ORG,
    })

    const ctx = makeCtx({ pendingCostCenter: 'cc-new' })

    await expect(askFor(ctx, 'cc-new')).rejects.toBeDefined()

    const metric = metricFrom(ctx)

    expect(metric).toMatchObject({
      account: 'acc',
      kind: 'storefront-access-denied-event',
      name: 'b2b-suite-buyerorg-data',
    })

    // The two surfaces must not drift apart: same fields, one sampled, one not.
    const { message, ...logged } = mismatchLog(ctx)

    expect(metric.fields).toEqual(logged)
  })

  it('does not let a failing metric turn the rejection into something else', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-new',
      organization: OTHER_ORG,
    })

    const ctx = makeCtx({
      pendingCostCenter: 'cc-new',
      sendMetric: jest.fn().mockRejectedValue(new Error('analytics down')),
    })

    await expect(askFor(ctx, 'cc-new')).rejects.toThrow(
      'operation-not-permitted'
    )
  })

  it('sends no metric when the cost center is allowed', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-ok',
      organization: SESSION_ORG,
    })

    const ctx = makeCtx()

    await CostCenters.getCostCenterByIdStorefront(
      undefined as any,
      { id: 'cc-ok' },
      ctx
    )

    expect(metricFrom(ctx)).toBeUndefined()
  })

  it('answers organization-data-not-found when the session carries no namespaces', async () => {
    const ctx = makeCtx()

    ctx.vtex.sessionData = {}

    await expect(askFor(ctx, 'cc-new')).rejects.toThrow(
      'organization-data-not-found'
    )
  })

  it('answers organization-data-not-found when there is no session at all', async () => {
    const ctx = makeCtx()

    ctx.vtex.sessionData = null

    await expect(askFor(ctx, 'cc-new')).rejects.toThrow(
      'organization-data-not-found'
    )
  })

  it('logs nothing when the cost center belongs to the session organization', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-ok',
      organization: SESSION_ORG,
    })

    const ctx = makeCtx()

    await CostCenters.getCostCenterByIdStorefront(
      undefined as any,
      { id: 'cc-ok' },
      ctx
    )

    expect(mismatchLog(ctx)).toBeUndefined()
  })

  /**
   * The pending selection is read for diagnostics only. `public` is a
   * client-writable namespace, so letting it grant access would let any shopper
   * name someone else's cost center.
   */
  it('still rejects the request even when the pending selection matches', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-new',
      organization: OTHER_ORG,
    })

    const ctx = makeCtx({ pendingCostCenter: 'cc-new' })

    await expect(askFor(ctx, 'cc-new')).rejects.toBeDefined()
  })
})

describe('checkOrganizationIsActive session reuse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /**
   * The storefront cost-center queries carry `@withSession`, which loads the
   * session onto the context before the resolver runs. Fetching it again here
   * was a second read of the same session in the same request.
   */
  it('reuses the session the directive already loaded', async () => {
    const ctx = makeCtx()

    jest
      .spyOn(Organizations, 'getOrganizationById')
      .mockResolvedValue({ status: 'active' } as any)

    const result = await Organizations.checkOrganizationIsActive(
      undefined as any,
      null,
      ctx
    )

    expect(result).toBe(true)
    expect(ctx.clients.session.getSession).not.toHaveBeenCalled()

    jest.restoreAllMocks()
  })

  it('falls back to fetching when nothing is on the context', async () => {
    const ctx = makeCtx()

    ctx.vtex.sessionData = undefined
    ctx.vtex.sessionToken = 'token'
    ctx.clients.session.getSession.mockResolvedValue({
      sessionData: {
        namespaces: {
          'storefront-permissions': { organization: { value: SESSION_ORG } },
        },
      },
    })

    jest
      .spyOn(Organizations, 'getOrganizationById')
      .mockResolvedValue({ status: 'active' } as any)

    const result = await Organizations.checkOrganizationIsActive(
      undefined as any,
      null,
      ctx
    )

    expect(result).toBe(true)
    expect(ctx.clients.session.getSession).toHaveBeenCalledWith('token', ['*'])

    jest.restoreAllMocks()
  })
})

/**
 * Everything that refuses the storefront on this path now reports through one
 * event kind with a `reason`. Four of these five throws used to be bare
 * `Error`s with no log and no metric at all, which is why "Failed to fetch
 * ship-to accounts" and "Failed to fetch cost center addresses" could not be
 * attributed to a cause: the partner app discards the GraphQL error before
 * logging, so a throw that says nothing on our side says nothing anywhere.
 */
describe('storefront access denied reasons', () => {
  const reasonOf = (ctx: any) => metricFrom(ctx)?.fields?.reason

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reports an organization whose status is not active', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(false as any)

    const ctx = makeCtx()

    await expect(askFor(ctx, 'cc-new')).rejects.toThrow(
      'This organization is not active'
    )

    expect(reasonOf(ctx)).toBe('organization-not-active')
  })

  /**
   * The suspected link to the empty session transforms in
   * storefront-permissions: a session that arrives having lost this namespace
   * looks identical, from the resolver, to a shopper with no B2B data at all.
   */
  it('reports a session that lost the storefront-permissions namespace', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)

    const ctx = makeCtx()

    ctx.vtex.sessionData = { namespaces: { public: {} } }

    await expect(askFor(ctx, 'cc-new')).rejects.toThrow(
      'organization-data-not-found'
    )

    expect(metricFrom(ctx).fields).toMatchObject({
      reason: 'missing-storefront-permissions-namespace',
      requestedCostCenterId: 'cc-new',
      sessionNamespaces: ['public'],
    })
  })

  it('reports when no session reached the resolver at all', async () => {
    const ctx = makeCtx()

    ctx.vtex.sessionData = undefined
    ctx.vtex.sessionToken = undefined
    ctx.clients.session.getSession.mockResolvedValue({})

    await expect(
      Organizations.checkOrganizationIsActive(undefined as any, null, ctx)
    ).rejects.toThrow('No session data')

    expect(reasonOf(ctx)).toBe('no-session-data')
  })

  it('reports the organization id that Master Data did not return', async () => {
    jest
      .spyOn(Organizations, 'getOrganizationById')
      .mockResolvedValue(null as any)

    const ctx = makeCtx()

    await expect(
      Organizations.checkOrganizationIsActive(undefined as any, null, ctx)
    ).rejects.toThrow('Organization not found')

    expect(metricFrom(ctx).fields).toMatchObject({
      lookedUpOrganizationId: SESSION_ORG,
      reason: 'organization-not-found',
      sessionOrganization: SESSION_ORG,
    })
  })

  /**
   * Both checkout errors under investigation reach the same resolver, so
   * without this the events cannot be attributed to one or the other.
   */
  it('attributes the denial to the app and query that caused it', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)

    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-new',
      organization: OTHER_ORG,
    })

    const ctx = makeCtx()

    ctx.graphql = {
      query: {
        operationName: 'getShipToAccountsByCostCenter',
        senderApp: 'acme.checkout@3.1.0',
      },
    }

    await expect(askFor(ctx, 'cc-new')).rejects.toBeDefined()

    expect(metricFrom(ctx).fields).toMatchObject({
      callerApp: 'acme.checkout@3.1.0',
      operationName: 'getShipToAccountsByCostCenter',
    })
  })

  it('reports nulls rather than guesses when the caller did not identify itself', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)

    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-new',
      organization: OTHER_ORG,
    })

    const ctx = makeCtx()

    await expect(askFor(ctx, 'cc-new')).rejects.toBeDefined()

    expect(metricFrom(ctx).fields).toMatchObject({
      callerApp: null,
      operationName: null,
    })
  })

  it('falls back to the sender header when the query carries no senderApp', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(false as any)

    const ctx = makeCtx()

    ctx.request = { header: { 'x-b2b-senderapp': 'acme.checkout@3.1.0' } }

    await expect(askFor(ctx, 'cc-new')).rejects.toBeDefined()

    expect(metricFrom(ctx).fields.callerApp).toBe('acme.checkout@3.1.0')
  })

  it('does not let a failing metric change how any of them fail', async () => {
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(false as any)

    const ctx = makeCtx({
      sendMetric: jest.fn().mockRejectedValue(new Error('analytics down')),
    })

    await expect(askFor(ctx, 'cc-new')).rejects.toThrow(
      'This organization is not active'
    )
  })
})
