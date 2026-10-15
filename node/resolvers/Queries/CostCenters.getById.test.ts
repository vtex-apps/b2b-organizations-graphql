import { loadCostCenter } from '../../services/organizationDocuments'
import costCenters from './CostCenters'

jest.mock('@vtex/api')
jest.mock('@vtex/diagnostics-nodejs', () => ({}))
jest.mock('../../utils/queryObservability', () => ({
  ensureConfigForQuery: jest.fn(),
  auditQueryEvent: jest.fn(),
  withQueryTimings: async ({ run }: any) =>
    run({ track: async (_: string, p: Promise<any>) => p }),
}))
jest.mock('../../services/organizationDocuments', () => ({
  loadCostCenter: jest.fn(),
}))

const mockContext = () =>
  ({
    ip: '127.0.0.1',
    clients: {},
    vtex: {
      account: 'testaccount',
      logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
      workspace: 'master',
    },
  } as unknown as Context)

describe('getCostCenterById (B2BTEAM-3982)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('logs warn notFound and sets extensions.status on 404', async () => {
    const ctx = mockContext()
    const notFound: any = new Error('costCenterNotFound')

    notFound.costCenterNotFound = true
    ;(loadCostCenter as jest.Mock).mockRejectedValue(notFound)

    await expect(
      costCenters.getCostCenterById(undefined as never, { id: 'cc-1' }, ctx)
    ).rejects.toMatchObject({
      extensions: expect.objectContaining({ status: 404 }),
    })

    expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'getCostCenterById.notFound' })
    )
    expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
  })

  it('logs error on non-404 failures', async () => {
    const ctx = mockContext()
    const serverError: any = new Error('boom')

    serverError.response = { status: 500 }
    ;(loadCostCenter as jest.Mock).mockRejectedValue(serverError)

    await expect(
      costCenters.getCostCenterById(undefined as never, { id: 'cc-1' }, ctx)
    ).rejects.toMatchObject({
      extensions: expect.objectContaining({ status: 500 }),
    })

    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'getCostCenterById.error' })
    )
  })
})
