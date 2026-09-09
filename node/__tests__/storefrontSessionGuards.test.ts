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

const makeCtx = () => {
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }

  return {
    clients: {
      analytics: { sendMetric: jest.fn().mockResolvedValue(undefined) },
      audit: { sendEvent: jest.fn().mockResolvedValue(undefined) },
      session: { getSession: jest.fn() },
    },
    ip: '127.0.0.1',
    logger,
    sendMetric: jest.fn().mockResolvedValue(undefined),
    vtex: {
      account: 'acc',
      logger,
      sessionData: {
        namespaces: {
          'storefront-permissions': {
            costcenter: { value: 'cc-session' },
            organization: { value: SESSION_ORG },
          },
        },
      },
    },
  } as any
}

const askFor = (ctx: any, id: string) =>
  CostCenters.getCostCenterByIdStorefront(undefined as any, { id }, ctx)

/**
 * The guards read `sessionData?.namespaces['storefront-permissions']`: the `?.`
 * covered `sessionData` but not `namespaces`, so a session arriving without
 * namespaces threw `Cannot read properties of undefined (reading
 * 'storefront-permissions')` instead of the named error the line was written to
 * throw. Seen on live traffic. A TypeError says nothing about which namespace
 * was missing, which is the one thing worth knowing here.
 */
describe('storefront session guards', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .spyOn(Organizations, 'checkOrganizationIsActive')
      .mockResolvedValue(true as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
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

  it('still serves a cost center that belongs to the session organization', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-ok',
      organization: SESSION_ORG,
    })

    const ctx = makeCtx()

    expect(await askFor(ctx, 'cc-ok')).toMatchObject({ id: 'cc-ok' })
  })

  it('still refuses a cost center from another organization', async () => {
    loadCostCenterMock.mockResolvedValue({
      addresses: [],
      id: 'cc-other',
      organization: 'org-other',
    })

    await expect(askFor(makeCtx(), 'cc-other')).rejects.toThrow(
      'operation-not-permitted'
    )
  })
})

/**
 * The storefront cost-center queries carry `@withSession`, which loads the
 * session onto the context before the resolver runs. Fetching it again here was
 * a second read of the same session in the same request - 11 to 37ms each on
 * live traffic.
 */
describe('checkOrganizationIsActive session reuse', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

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
  })

  /**
   * Not dead code: `checkOrganizationIsActive` is also a query field of its own,
   * without the directive, and reaches this with nothing on the context.
   */
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
  })
})
