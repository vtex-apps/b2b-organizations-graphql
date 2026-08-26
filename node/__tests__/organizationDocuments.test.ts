import {
  hydrateOrganizationsByEmail,
  loadCostCenter,
  loadOrganization,
} from '../services/organizationDocuments'

jest.mock('../services/organizationsCache', () => ({
  getCachedOrganization: jest.fn(
    (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
  ),
  getCachedCostCenter: jest.fn(
    (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
  ),
}))

const makeCtx = () => {
  const getDocumentById = jest.fn()

  return {
    clients: {
      masterDataExtended: { getDocumentById },
    },
    state: {},
    vtex: {
      account: 'acc',
      workspace: 'master',
      logger: { error: jest.fn(), warn: jest.fn() },
    },
    getDocumentById,
  } as any
}

describe('organizationDocuments', () => {
  it('dedupes org loads within the same request via ctx.state', async () => {
    const ctx = makeCtx()

    ctx.getDocumentById.mockResolvedValue({ id: 'o1', name: 'Acme' })

    const first = await loadOrganization(ctx, 'o1')
    const second = await loadOrganization(ctx, 'o1')

    expect(first).toEqual({ id: 'o1', name: 'Acme' })
    expect(second).toBe(first)
    expect(ctx.getDocumentById).toHaveBeenCalledTimes(1)
  })

  it('hydrates unique org and cost center ids in parallel once', async () => {
    const ctx = makeCtx()

    ctx.getDocumentById.mockImplementation(
      async (entity: string, id: string) => {
        if (entity === 'organizations') {
          return { id, name: `org-${id}` }
        }

        return { id, name: `cc-${id}` }
      }
    )

    await hydrateOrganizationsByEmail(ctx, [
      { orgId: 'o1', costId: 'c1' },
      { orgId: 'o1', costId: 'c2' },
      { orgId: 'o2', costId: 'c1' },
    ])

    const orgCalls = ctx.getDocumentById.mock.calls.filter(
      ([entity]: string[]) => entity === 'organizations'
    )

    const ccCalls = ctx.getDocumentById.mock.calls.filter(
      ([entity]: string[]) => entity === 'cost_centers'
    )

    expect(orgCalls).toHaveLength(2)
    expect(ccCalls).toHaveLength(2)

    // Field resolvers after hydrate reuse ctx.state.
    await loadOrganization(ctx, 'o1')
    await loadCostCenter(ctx, 'c1')
    expect(ctx.getDocumentById).toHaveBeenCalledTimes(4)
  })
})
