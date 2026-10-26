import { loadOrganization } from '../../services/organizationDocuments'
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
jest.mock('../../services/organizationDocuments', () => ({
  loadOrganization: jest.fn(),
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
    ;(loadOrganization as jest.Mock).mockResolvedValue({
      id: orgId,
      status: 'active',
    })
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

  it('warns organizationNotFound and rejects with the same error when the org is missing', async () => {
    const ctx = mockContext()
    const notFound: any = new Error('organizationNotFound')

    notFound.organizationNotFound = true
    ;(loadOrganization as jest.Mock).mockRejectedValue(notFound)

    const promise = CostCenters.createCostCenterWithId(
      undefined as never,
      { organizationId: 'missing-org', input: baseInput as any },
      ctx
    )

    await expect(promise).rejects.toThrow('organizationNotFound')
    await expect(promise).rejects.toMatchObject({
      message: 'organizationNotFound',
      level: 'warn',
      extensions: { message: 'organizationNotFound' },
    })

    expect(ctx.vtex.logger.warn).toHaveBeenCalledWith({
      message: 'createCostCenterWithId.organizationNotFound',
      operation: 'createCostCenterWithId',
      organizationId: 'missing-org',
    })
    expect(ctx.vtex.logger.error).not.toHaveBeenCalled()
    expect(Organizations.getOrganizationById).not.toHaveBeenCalled()
    expect(ctx.clients.masterdata.getDocument).not.toHaveBeenCalled()
    expect(CostCenterRepository.createCostCenter).not.toHaveBeenCalled()
  })

  it('delegates non-not-found org lookup failures to getOrganizationById', async () => {
    const ctx = mockContext()
    const serverError: any = new Error('Request failed with status code 500')

    serverError.response = { status: 500 }
    ;(loadOrganization as jest.Mock).mockRejectedValue(serverError)
    ;(Organizations.getOrganizationById as jest.Mock).mockRejectedValue(
      new Error('Request failed with status code 500')
    )

    await expect(
      CostCenters.createCostCenterWithId(
        undefined as never,
        { organizationId: orgId, input: baseInput as any },
        ctx
      )
    ).rejects.toThrow('Request failed with status code 500')

    expect(Organizations.getOrganizationById).toHaveBeenCalled()
    expect(ctx.vtex.logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'createCostCenterWithId.organizationNotFound',
      })
    )
    expect(CostCenterRepository.createCostCenter).not.toHaveBeenCalled()
  })

  it.each([
    ['empty object', {}],
    ['empty string', ''],
    ['null', null],
  ])(
    'creates when Master Data answers the lookup with an %s (miss without 404)',
    async (_label, emptyDocument) => {
      const ctx = mockContext()

      ;(ctx.clients.masterdata.getDocument as jest.Mock).mockResolvedValue(
        emptyDocument
      )

      const result = await CostCenters.createCostCenterWithId(
        undefined as never,
        { organizationId: orgId, input: baseInput as any },
        ctx
      )

      expect(result).toEqual({ id: costId })
      expect(CostCenterRepository.createCostCenter).toHaveBeenCalled()
      expect(ctx.vtex.logger.warn).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'createCostCenterWithId.alreadyExists',
        })
      )
    }
  )

  it('returns the created id when the audit call fails (fire-and-forget)', async () => {
    const ctx = mockContext()
    const notFound: any = new Error('Document not found')

    notFound.response = { status: 404 }
    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
      notFound
    )
    ;(ctx.clients.audit.sendEventStrict as jest.Mock).mockRejectedValue(
      new Error('audit down')
    )

    const result = await CostCenters.createCostCenterWithId(
      undefined as never,
      { organizationId: orgId, input: baseInput as any },
      ctx
    )

    await new Promise<void>((resolve) => setImmediate(() => resolve()))

    expect(result).toEqual({ id: costId })
    expect(ctx.clients.audit.sendEventStrict).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'CREATE_COST_CENTER_WITH_ID' })
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
    ).rejects.toMatchObject({
      level: 'warn',
      message: 'Cost Center already exists',
    })

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
    ).rejects.toMatchObject({
      message: 'not found',
      level: 'warn',
      extensions: { message: 'not found' },
    })

    expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'deleteCostCenter.notFound' })
    )
  })

  it('keeps default (error) level on non-404 failures', async () => {
    const ctx = mockContext()
    const serverError: any = new Error('boom')

    serverError.response = { status: 500 }
    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
      serverError
    )

    const error = await CostCenters.deleteCostCenter(
      undefined as never,
      { id: costId },
      ctx
    ).catch((e: any) => e)

    expect(error.message).toBe('boom')
    expect(error.level).toBeUndefined()
    expect(ctx.vtex.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'deleteCostCenter.error' })
    )
  })
})

describe('deleteOrganization logging (B2BTEAM-3982)', () => {
  it('logs warn notFound and marks the error as warn on 404', async () => {
    const ctx = mockContext()
    const notFound: any = new Error('not found')

    notFound.response = { status: 404 }
    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
      notFound
    )

    await expect(
      CostCenters.deleteOrganization(undefined as never, { id: orgId }, ctx)
    ).rejects.toMatchObject({
      message: 'not found',
      level: 'warn',
      extensions: { message: 'not found' },
    })

    expect(ctx.vtex.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'deleteOrganization.notFound' })
    )
  })

  it('keeps default (error) level on non-404 failures', async () => {
    const ctx = mockContext()
    const serverError: any = new Error('boom')

    serverError.response = { status: 500 }
    ;(ctx.clients.masterdata.getDocument as jest.Mock).mockRejectedValue(
      serverError
    )

    const error = await CostCenters.deleteOrganization(
      undefined as never,
      { id: orgId },
      ctx
    ).catch((e: any) => e)

    expect(error.level).toBeUndefined()
  })
})
