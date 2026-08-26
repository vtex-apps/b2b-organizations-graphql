import {
  auditQueryEvent,
  ensureConfigForQuery,
  withQueryTimings,
} from '../utils/queryObservability'
import checkConfig from '../resolvers/config'
import { getCachedCheckConfig } from '../services/organizationsCache'

jest.mock('@vtex/api', () => ({
  LRUCache: class {
    public async getOrSet(_key: string, factory: () => Promise<any>) {
      const { value } = await factory()

      return value
    }

    public getStats(name: string) {
      return { hits: 0, itemCount: 0, misses: 0, name }
    }
  },
}))
jest.mock('@vtex/diagnostics-nodejs', () => ({}))

jest.mock('../resolvers/config', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({ schemaHash: 'x', templateHash: 'y' }),
}))

jest.mock('../services/organizationsCache', () => {
  const actual = jest.requireActual('../services/organizationsCache')

  return {
    ...actual,
    getCachedCheckConfig: jest.fn((_ctx: any, fetcher: () => Promise<any>) =>
      fetcher()
    ),
  }
})

const makeCtx = () => {
  const sendEvent = jest.fn().mockResolvedValue(undefined)
  const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }

  return {
    clients: { audit: { sendEvent } },
    vtex: { account: 'acc', workspace: 'master', logger },
    sendEvent,
    logger,
  } as any
}

describe('ensureConfigForQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not block the caller on checkConfig', async () => {
    let resolveConfig!: () => void
    const pending = new Promise<void>((resolve) => {
      resolveConfig = resolve
    })

    ;(getCachedCheckConfig as jest.Mock).mockImplementationOnce(
      (_ctx: any, fetcher: () => Promise<any>) => fetcher()
    )
    ;(checkConfig as jest.Mock).mockImplementationOnce(() => pending)

    const ctx = makeCtx()

    ensureConfigForQuery(ctx)

    // Returns immediately even though checkConfig has not settled.
    expect(checkConfig).toHaveBeenCalledTimes(1)

    resolveConfig()
    await pending
  })
})

describe('auditQueryEvent', () => {
  it('does not await audit.sendEvent before returning', async () => {
    let resolveAudit!: () => void
    const pending = new Promise<void>((resolve) => {
      resolveAudit = resolve
    })

    const ctx = makeCtx()

    ctx.clients.audit.sendEvent.mockReturnValueOnce(pending)

    auditQueryEvent(ctx, {
      subjectId: 'test',
      operation: 'TEST',
      meta: {},
    })

    expect(ctx.clients.audit.sendEvent).toHaveBeenCalledTimes(1)

    resolveAudit()
    await pending
  })

  it('logs safely when audit rejects', async () => {
    const ctx = makeCtx()

    ctx.clients.audit.sendEvent.mockReturnValueOnce(
      Promise.reject(new Error('audit down'))
    )

    auditQueryEvent(ctx, {
      subjectId: 'test',
      operation: 'TEST',
      meta: {},
    })

    await new Promise<void>((resolve) => {
      setImmediate(() => resolve())
    })

    expect(ctx.logger.error).toHaveBeenCalled()
    const [[payload]] = ctx.logger.error.mock.calls

    expect(payload.message).toBe('auditQueryEvent-error')
    expect(payload.error.message).toBe('audit down')
  })
})

describe('withQueryTimings', () => {
  it('logs timings when the resolver throws', async () => {
    const ctx = makeCtx()

    await expect(
      withQueryTimings({
        ctx,
        message: 'getOrganizationById.timings',
        run: async () => {
          throw new Error('boom')
        },
      })
    ).rejects.toThrow('boom')

    expect(ctx.logger.warn).toHaveBeenCalled()
    expect(ctx.logger.warn.mock.calls[0][0].failed).toBe(true)
  })
})
