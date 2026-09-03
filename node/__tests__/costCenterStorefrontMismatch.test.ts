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
  sessionCostCenter = 'cc-session',
  sessionOrganization = SESSION_ORG,
  withPublicNamespace = true,
}: {
  pendingCostCenter?: string
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
      audit: { sendEvent: jest.fn().mockResolvedValue(undefined) },
      session: { getSession: jest.fn() },
    },
    ip: '127.0.0.1',
    logger,
    vtex: { account: 'acc', logger, sessionData: { namespaces } },
  } as any
}

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
