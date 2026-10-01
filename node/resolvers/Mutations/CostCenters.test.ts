import { ORGANIZATION_DATA_ENTITY, COST_CENTER_DATA_ENTITY } from '../../mdSchema'

jest.mock('@vtex/api')
jest.mock('@vtex/diagnostics-nodejs', () => ({}))
jest.mock('../../services/organizationsCache', () => ({
  invalidateCostCenterCache: jest.fn().mockResolvedValue(undefined),
  invalidateOrganizationCache: jest.fn().mockResolvedValue(undefined),
}))

import {
  invalidateCostCenterCache,
  invalidateOrganizationCache,
} from '../../services/organizationsCache'
import CostCenters from './CostCenters'

const orgId = 'org-123'
const costId = 'cost-456'

const mockContext = () =>
  ({
    ip: '127.0.0.1',
    clients: {
      audit: {
        sendEvent: jest.fn().mockResolvedValue(undefined),
      },
      masterdata: {
        deleteDocument: jest.fn().mockResolvedValue(undefined),
        getDocument: jest.fn().mockResolvedValue({ id: orgId, name: 'Acme' }),
      },
    },
    vtex: {
      account: 'testaccount',
      logger: { error: jest.fn(), warn: jest.fn() },
      workspace: 'master',
    },
  } as unknown as Context)

describe('CostCenters cache invalidation mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('invalidates organization cache after deleteOrganization', async () => {
    const ctx = mockContext()

    await CostCenters.deleteOrganization(undefined as never, { id: orgId }, ctx)

    expect(ctx.clients.masterdata.deleteDocument).toHaveBeenCalledWith({
      dataEntity: ORGANIZATION_DATA_ENTITY,
      id: orgId,
    })
    expect(invalidateOrganizationCache).toHaveBeenCalledWith(ctx, orgId)
  })

  it('invalidates cost center cache after deleteCostCenter', async () => {
    const ctx = mockContext()

    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockResolvedValue({
      id: costId,
    })

    await CostCenters.deleteCostCenter(undefined as never, { id: costId }, ctx)

    expect(ctx.clients.masterdata.deleteDocument).toHaveBeenCalledWith({
      dataEntity: COST_CENTER_DATA_ENTITY,
      id: costId,
    })
    expect(invalidateCostCenterCache).toHaveBeenCalledWith(ctx, costId)
  })
})
