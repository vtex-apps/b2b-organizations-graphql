import { staleFromVBaseWhileRevalidate } from '../utils/staleFromVBaseWhileRevalidate'

const flush = () => new Promise((resolve) => setImmediate(resolve))

const makeVBase = (stored: unknown) =>
  ({
    getJSON: jest.fn().mockResolvedValue(stored),
    saveJSON: jest.fn().mockResolvedValue(undefined),
  } as any)

describe('staleFromVBaseWhileRevalidate', () => {
  it('fetches, stores and returns when there is no cached entry', async () => {
    const vbase = makeVBase(null)
    const fetcher = jest.fn().mockResolvedValue({ some: 'data' })

    const result = await staleFromVBaseWhileRevalidate(
      vbase,
      'bucket',
      'key',
      fetcher
    )

    expect(result).toEqual({ some: 'data' })
    expect(fetcher).toHaveBeenCalledTimes(1)

    await flush()
    expect(vbase.saveJSON).toHaveBeenCalledTimes(1)

    const [, , saved] = vbase.saveJSON.mock.calls[0]

    expect(saved.data).toEqual({ some: 'data' })
    expect(new Date(saved.ttl).getTime()).toBeGreaterThan(Date.now())
  })

  it('returns the cached value without fetching while fresh', async () => {
    const future = new Date(Date.now() + 60 * 1000)
    const vbase = makeVBase({ data: { cached: true }, ttl: future })
    const fetcher = jest.fn()

    const result = await staleFromVBaseWhileRevalidate(
      vbase,
      'bucket',
      'key',
      fetcher
    )

    expect(result).toEqual({ cached: true })
    expect(fetcher).not.toHaveBeenCalled()
    expect(vbase.saveJSON).not.toHaveBeenCalled()
  })

  it('serves stale immediately and revalidates in the background', async () => {
    const past = new Date(Date.now() - 60 * 1000)
    const vbase = makeVBase({ data: { cached: 'stale' }, ttl: past })
    const fetcher = jest.fn().mockResolvedValue({ cached: 'fresh' })

    const result = await staleFromVBaseWhileRevalidate(
      vbase,
      'bucket',
      'key',
      fetcher
    )

    expect(result).toEqual({ cached: 'stale' })

    await flush()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(vbase.saveJSON).toHaveBeenCalledTimes(1)
    expect(vbase.saveJSON.mock.calls[0][2].data).toEqual({ cached: 'fresh' })
  })

  it('falls back to the fetcher when the VBase read fails', async () => {
    const vbase = {
      getJSON: jest.fn().mockRejectedValue(new Error('vbase down')),
      saveJSON: jest.fn().mockResolvedValue(undefined),
    } as any

    const fetcher = jest.fn().mockResolvedValue({ origin: true })

    const result = await staleFromVBaseWhileRevalidate(
      vbase,
      'bucket',
      'key',
      fetcher
    )

    expect(result).toEqual({ origin: true })
  })

  it('does not fail the caller when the background save fails, but logs it', async () => {
    const vbase = {
      getJSON: jest.fn().mockResolvedValue(null),
      saveJSON: jest.fn().mockRejectedValue(new Error('write denied')),
    } as any

    const logger = { error: jest.fn(), warn: jest.fn() } as any

    const result = await staleFromVBaseWhileRevalidate(
      vbase,
      'bucket',
      'key',
      jest.fn().mockResolvedValue('value'),
      undefined,
      { logger }
    )

    expect(result).toBe('value')
    await flush()
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(logger.error.mock.calls[0][0].message).toBe(
      'staleFromVBase.saveError'
    )
  })

  it('logs a failing background revalidation while still serving stale', async () => {
    const past = new Date(Date.now() - 60 * 1000)
    const vbase = makeVBase({ data: { cached: 'stale' }, ttl: past })
    const logger = { error: jest.fn(), warn: jest.fn() } as any
    const fetcher = jest.fn().mockRejectedValue(new Error('origin down'))

    const result = await staleFromVBaseWhileRevalidate(
      vbase,
      'bucket',
      'my-logical-key',
      fetcher,
      undefined,
      { logger }
    )

    expect(result).toEqual({ cached: 'stale' })

    await flush()
    expect(logger.error).toHaveBeenCalledTimes(1)

    const payload = logger.error.mock.calls[0][0]

    expect(payload.message).toBe('staleFromVBase.revalidateError')
    expect(JSON.stringify(payload)).not.toContain('my-logical-key')
    expect(payload.key).toMatch(/^[0-9a-f]{32}\.json$/)
  })

  it('does not log intentional summaryCacheMiss on background revalidate', async () => {
    const past = new Date(Date.now() - 60 * 1000)
    const vbase = makeVBase({ data: { cached: 'stale' }, ttl: past })
    const logger = { error: jest.fn(), warn: jest.fn() } as any
    const miss: any = new Error('summaryCacheMiss')

    miss.summaryCacheMiss = true

    const result = await staleFromVBaseWhileRevalidate(
      vbase,
      'bucket',
      'key',
      jest.fn().mockRejectedValue(miss),
      undefined,
      { logger }
    )

    expect(result).toEqual({ cached: 'stale' })
    await flush()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('coalesces concurrent cold misses into one fetch and one save', async () => {
    const vbase = makeVBase(null)
    let resolveFetcher!: (value: { n: number }) => void
    const fetcher = jest.fn(
      () =>
        new Promise<{ n: number }>((resolve) => {
          resolveFetcher = resolve
        })
    )

    const run = () =>
      staleFromVBaseWhileRevalidate(vbase, 'bucket', 'same-key', fetcher)

    const p1 = run()
    const p2 = run()
    const p3 = run()

    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)
    resolveFetcher({ n: 1 })

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    expect(r1).toEqual({ n: 1 })
    expect(r2).toEqual({ n: 1 })
    expect(r3).toEqual({ n: 1 })
    expect(fetcher).toHaveBeenCalledTimes(1)

    await flush()
    expect(vbase.saveJSON).toHaveBeenCalledTimes(1)
  })

  it('coalesces concurrent stale revalidations into one fetch and one save', async () => {
    const past = new Date(Date.now() - 60 * 1000)
    const vbase = makeVBase({ data: { cached: 'stale' }, ttl: past })
    const fetcher = jest.fn().mockResolvedValue({ cached: 'fresh' })

    const results = await Promise.all([
      staleFromVBaseWhileRevalidate(vbase, 'bucket', 'same-key', fetcher),
      staleFromVBaseWhileRevalidate(vbase, 'bucket', 'same-key', fetcher),
      staleFromVBaseWhileRevalidate(vbase, 'bucket', 'same-key', fetcher),
    ])

    expect(results).toEqual([
      { cached: 'stale' },
      { cached: 'stale' },
      { cached: 'stale' },
    ])

    await flush()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(vbase.saveJSON).toHaveBeenCalledTimes(1)
  })

  it('logs a warning when the VBase read fails and the origin is used', async () => {
    const vbase = {
      getJSON: jest.fn().mockRejectedValue(new Error('vbase down')),
      saveJSON: jest.fn().mockResolvedValue(undefined),
    } as any

    const logger = { error: jest.fn(), warn: jest.fn() } as any

    const result = await staleFromVBaseWhileRevalidate(
      vbase,
      'bucket',
      'key',
      jest.fn().mockResolvedValue({ origin: true }),
      undefined,
      { logger }
    )

    expect(result).toEqual({ origin: true })
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn.mock.calls[0][0].message).toBe(
      'staleFromVBase.readError'
    )
  })
})
