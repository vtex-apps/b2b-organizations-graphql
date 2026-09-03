import {
  hydrateOrganizationsByEmail,
  loadCostCenterSummary,
  loadOrganizationSummary,
  getOrganizationStatusFromState,
} from '../services/organizationDocuments'
import {
  getCachedCostCenterSummary,
  getCachedOrganizationSummary,
} from '../services/organizationsCache'

jest.mock('../services/organizationsCache', () => ({
  getCachedOrganization: jest.fn(
    (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
  ),
  getCachedCostCenter: jest.fn(
    (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
  ),
  getCachedOrganizationSummary: jest.fn(
    (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
  ),
  getCachedCostCenterSummary: jest.fn(
    (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
  ),
}))

const makeCtx = () => {
  const getDocumentById = jest.fn()
  const getDocumentsByIds = jest.fn()

  return {
    clients: {
      masterDataExtended: { getDocumentById, getDocumentsByIds },
    },
    state: {},
    vtex: {
      account: 'acc',
      workspace: 'master',
      logger: { error: jest.fn(), warn: jest.fn() },
    },
    getDocumentById,
    getDocumentsByIds,
  } as any
}

describe('organizationDocuments', () => {
  it('loads slim organization fields for summaries', async () => {
    const ctx = makeCtx()

    ctx.getDocumentById.mockResolvedValue({
      id: 'o1',
      name: 'Acme',
      status: 'active',
    })

    const first = await loadOrganizationSummary(ctx, 'o1')
    const second = await loadOrganizationSummary(ctx, 'o1')

    expect(first).toEqual({ id: 'o1', name: 'Acme', status: 'active' })
    expect(second).toBe(first)
    expect(ctx.getDocumentById).toHaveBeenCalledTimes(1)
    expect(ctx.getDocumentById.mock.calls[0][2]).toEqual([
      'id',
      'name',
      'status',
    ])
  })

  it('batches unique org/cc summaries via getDocumentsByIds on hydrate', async () => {
    const ctx = makeCtx()

    // Memory cache miss path: getCached*Summary calls fetcher which throws
    // summaryCacheMiss, then hydrate uses getDocumentsByIds.
    ;(getCachedOrganizationSummary as jest.Mock).mockImplementation(
      async (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
    )
    ;(getCachedCostCenterSummary as jest.Mock).mockImplementation(
      async (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
    )

    ctx.getDocumentsByIds.mockImplementation(
      async ({ dataEntity, ids }: { dataEntity: string; ids: string[] }) => {
        if (dataEntity === 'organizations') {
          return ids.map((id) => ({ id, name: `org-${id}`, status: 'active' }))
        }

        return ids.map((id) => ({ id, name: `cc-${id}` }))
      }
    )

    await hydrateOrganizationsByEmail(ctx, [
      { orgId: 'o1', costId: 'c1' },
      { orgId: 'o1', costId: 'c2' },
      { orgId: 'o2', costId: 'c1' },
    ])

    expect(ctx.getDocumentsByIds).toHaveBeenCalled()
    const orgBatch = ctx.getDocumentsByIds.mock.calls.find(
      ([args]: any[]) => args.dataEntity === 'organizations'
    )

    const ccBatch = ctx.getDocumentsByIds.mock.calls.find(
      ([args]: any[]) => args.dataEntity === 'cost_centers'
    )

    expect(orgBatch[0].fields).toEqual(['id', 'name', 'status'])
    expect(orgBatch[0].ids.sort()).toEqual(['o1', 'o2'])
    expect(ccBatch[0].fields).toEqual(['id', 'name'])
    expect(ccBatch[0].ids.sort()).toEqual(['c1', 'c2'])

    expect(getOrganizationStatusFromState(ctx, 'o1')).toBe('active')
    expect(await loadOrganizationSummary(ctx, 'o1')).toMatchObject({
      id: 'o1',
      name: 'org-o1',
    })
    expect(await loadCostCenterSummary(ctx, 'c1')).toMatchObject({
      id: 'c1',
      name: 'cc-c1',
    })
  })

  it('can hydrate organizations without cost centers', async () => {
    const ctx = makeCtx()

    ;(getCachedOrganizationSummary as jest.Mock).mockImplementation(
      async (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
    )
    ;(getCachedCostCenterSummary as jest.Mock).mockImplementation(
      async (_ctx: any, _id: string, fetcher: () => Promise<any>) => fetcher()
    )

    ctx.getDocumentsByIds.mockResolvedValue([
      { id: 'o1', name: 'Acme', status: 'inactive' },
    ])

    await hydrateOrganizationsByEmail(ctx, [{ orgId: 'o1', costId: 'c1' }], {
      costCenters: false,
    })

    const entities = ctx.getDocumentsByIds.mock.calls.map(
      ([args]: any[]) => args.dataEntity
    )

    expect(entities).toEqual(['organizations'])
  })
})
