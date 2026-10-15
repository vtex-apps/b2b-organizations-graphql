import Organizations from '../Queries/Organizations'
import CostCenterRepository from '../repository/CostCenterRepository'
import CostCenters from './CostCenters'

jest.mock('@vtex/api')
jest.mock('@vtex/diagnostics-nodejs', () => ({}))
jest.mock('../config', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('../Queries/Organizations', () => ({
  __esModule: true,
  default: {
    getOrganizationById: jest.fn(),
  },
}))
jest.mock('../repository/CostCenterRepository', () => ({
  __esModule: true,
  default: {
    createCostCenter: jest.fn(),
  },
}))
jest.mock('../../services/organizationsCache', () => ({
  invalidateCostCenterCache: jest.fn().mockResolvedValue(undefined),
  invalidateOrganizationCache: jest.fn().mockResolvedValue(undefined),
}))

const orgId = 'org-123'
const costId = 'cost-new-1'

const baseInput = {
  id: costId,
  name: 'CC',
  addresses: [],
  phoneNumber: '',
  businessDocument: '',
  stateRegistration: '',
  customFields: [],
  marketingTags: [],
  sellers: [],
  paymentTerms: [],
}

const mockContext = () => {
  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }

  return {
    ip: '127.0.0.1',
    clients: {
      audit: {
        sendEvent: jest.fn().mockResolvedValue(undefined),
        sendEventStrict: jest.fn().mockResolvedValue(undefined),
      },
      masterdata: {
        getDocument: jest.fn(),
        deleteDocument: jest.fn().mockResolvedValue(undefined),
        updatePartialDocument: jest.fn().mockResolvedValue(undefined),
        createDocument: jest.fn(),
      },
    },
    vtex: {
      account: 'testaccount',
      logger,
      workspace: 'master',
    },
  } as unknown as Context
}

describe('createCostCenterWithId (B2BTEAM-3982)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Organizations.getOrganizationById as jest.Mock).mockResolvedValue({
      id: orgId,
      status: 'active',
    })
    ;(CostCenterRepository.createCostCenter as jest.Mock).mockResolvedValue({
      id: costId,
      href: 'href',
      status: '',
    })
  })

  it('creates when Master Data lookup returns 404 (not-exists)', async () => {
    const ctx = mockContext()
    const notFound: any = new Error('Document not found')

    notFound.response = { status: 404 }
    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
      notFound
    )

    const result = await CostCenters.createCostCenterWithId(
      undefined as never,
      { organizationId: orgId, input: baseInput as any },
      ctx
    )

    expect(result).toEqual({ id: costId })
    expect(CostCenterRepository.createCostCenter).toHaveBeenCalled()
    expect(ctx.vtex.logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'createCostCenterWithId.lookupError' })
    )
  })

  it('does not create and logs lookupError on Master Data 500', async () => {
    const ctx = mockContext()
    const serverError: any = new Error('Request failed with status code 500')

    serverError.response = { status: 500 }
    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
      serverError
    )

    await expect(
      CostCenters.createCostCenterWithId(
        undefined as never,
        { organizationId: orgId, input: baseInput as any },
        ctx
      )
    ).rejects.toBeTruthy()

    expect(CostCenterRepository.createCostCenter).not.toHaveBeenCalled()
    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'createCostCenterWithId.lookupError',
        costId,
        organizationId: orgId,
      })
    )
  })

  it('does not create on Master Data 429', async () => {
    const ctx = mockContext()
    const throttled: any = new Error('Request failed with status code 429')

    throttled.response = { status: 429 }
    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
      throttled
    )

    await expect(
      CostCenters.createCostCenterWithId(
        undefined as never,
        { organizationId: orgId, input: baseInput as any },
        ctx
      )
    ).rejects.toBeTruthy()

    expect(CostCenterRepository.createCostCenter).not.toHaveBeenCalled()
    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'createCostCenterWithId.lookupError' })
    )
  })

  it('warns alreadyExists and does not create when document is found', async () => {
    const ctx = mockContext()

    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockResolvedValue({
      id: costId,
    })

    await expect(
      CostCenters.createCostCenterWithId(
        undefined as never,
        { organizationId: orgId, input: baseInput as any },
        ctx
      )
    ).rejects.toThrow('Cost Center already exists')

    expect(CostCenterRepository.createCostCenter).not.toHaveBeenCalled()
    expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'createCostCenterWithId.alreadyExists',
      })
    )
  })
})

describe('deleteCostCenter logging (B2BTEAM-3982)', () => {
  it('logs warn notFound on 404', async () => {
    const ctx = mockContext()
    const notFound: any = new Error('not found')

    notFound.response = { status: 404 }
    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
      notFound
    )

    await expect(
      CostCenters.deleteCostCenter(undefined as never, { id: costId }, ctx)
    ).rejects.toBeTruthy()

    expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'deleteCostCenter.notFound' })
    )
  })
})
