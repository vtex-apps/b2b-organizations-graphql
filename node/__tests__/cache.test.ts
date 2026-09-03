/* eslint-disable @typescript-eslint/restrict-plus-operands */

import { collectCacheStats, createCachedResource } from '../services/cache'

jest.mock('@vtex/api', () => {
  /**
   * Minimal LRUCache stand-in so cache tests do not load the full @vtex/api
   * graph. Behaviour matches what createCachedResource relies on: getOrSet,
   * getStats, and maxSizeBytes via a `length` function.
   */
  class MockLRUCache<T> {
    private readonly store = new Map<string, { value: T; expiresAt: number }>()
    private readonly max: number
    private readonly lengthFn?: (value: T) => number
    private hits = 0
    private misses = 0

    constructor(options: { max: number; length?: (value: T) => number }) {
      this.max = options.max
      this.lengthFn = options.length
    }

    public async getOrSet(
      key: string,
      factory: () => Promise<{ maxAge: number; value: T }>
    ): Promise<T | void> {
      const existing = this.store.get(key)

      if (existing && existing.expiresAt > Date.now()) {
        this.hits += 1

        return existing.value
      }

      this.misses += 1

      const { maxAge, value } = await factory()
      const size = this.lengthFn ? this.lengthFn(value) : 1

      if (size <= this.max) {
        this.store.set(key, {
          expiresAt: Date.now() + Number(maxAge),
          value,
        })

        if (this.lengthFn) {
          let total = 0

          for (const entry of this.store.values()) {
            total += Number(this.lengthFn(entry.value))
          }

          while (total > this.max && this.store.size > 0) {
            const firstKey = this.store.keys().next().value

            if (firstKey === undefined) {
              break
            }

            const removed = this.store.get(firstKey)

            this.store.delete(firstKey)
            total -= removed ? Number(this.lengthFn(removed.value)) : 0
          }
        } else if (this.store.size > this.max) {
          const firstKey = this.store.keys().next().value

          if (firstKey !== undefined) {
            this.store.delete(firstKey)
          }
        }
      }

      return value
    }

    public getStats(name: string) {
      const stats = {
        hits: this.hits,
        itemCount: this.store.size,
        misses: this.misses,
        name,
      }

      this.hits = 0
      this.misses = 0

      return stats
    }
  }

  return { LRUCache: MockLRUCache }
})
jest.mock('@vtex/diagnostics-nodejs', () => ({}))

const flush = () =>
  new Promise<void>((resolve) => {
    setImmediate(() => resolve())
  })

let uniq = 0

const makeCtx = (account: string, vbaseStored: unknown = null) =>
  ({
    clients: {
      vbase: {
        getJSON: jest.fn().mockResolvedValue(vbaseStored),
        saveJSON: jest.fn().mockResolvedValue(undefined),
      },
    },
    vtex: {
      account,
      logger: { error: jest.fn(), warn: jest.fn() },
      workspace: 'master',
    },
  } as unknown as Context)

const makeResource = (options: {
  maxEntries?: number
  maxSizeBytes?: number
  memoryTtlMs: number
  vbaseTtlMinutes?: number
}) => createCachedResource(`test-${uniq++}`, options)

describe('createCachedResource', () => {
  it('serves repeated reads from memory without refetching', async () => {
    const cached = makeResource({ memoryTtlMs: 60000 })
    const ctx = makeCtx('acc1')
    const fetcher = jest.fn().mockResolvedValue({ v: 1 })

    expect(await cached(ctx, 'k', fetcher)).toEqual({ v: 1 })
    expect(await cached(ctx, 'k', fetcher)).toEqual({ v: 1 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('isolates tenants: same key, different account, different entry', async () => {
    const cached = makeResource({ memoryTtlMs: 60000 })
    const fetcherA = jest.fn().mockResolvedValue('for-a')
    const fetcherB = jest.fn().mockResolvedValue('for-b')

    expect(await cached(makeCtx('account-a'), 'k', fetcherA)).toBe('for-a')
    expect(await cached(makeCtx('account-b'), 'k', fetcherB)).toBe('for-b')
    expect(fetcherA).toHaveBeenCalledTimes(1)
    expect(fetcherB).toHaveBeenCalledTimes(1)
  })

  it('bypasses caching entirely when the TTL is zero', async () => {
    const cached = makeResource({ memoryTtlMs: 0 })
    const ctx = makeCtx('acc2')
    const fetcher = jest.fn().mockResolvedValue('fresh')

    await cached(ctx, 'k', fetcher)
    await cached(ctx, 'k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('honours a per-call TTL override', async () => {
    const cached = makeResource({ memoryTtlMs: 60000 })
    const ctx = makeCtx('acc3')
    const fetcher = jest.fn().mockResolvedValue('x')

    await cached(ctx, 'k', fetcher, { memoryTtlMs: 0 })
    await cached(ctx, 'k', fetcher, { memoryTtlMs: 0 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('bounds by bytes: an oversized value is not retained', async () => {
    const cached = makeResource({ maxSizeBytes: 1024, memoryTtlMs: 60000 })
    const ctx = makeCtx('acc4')
    const big = { pad: 'x'.repeat(5000) }
    const fetcher = jest.fn().mockResolvedValue(big)

    expect(await cached(ctx, 'k', fetcher)).toEqual(big)
    await cached(ctx, 'k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('bounds by bytes: small values within the budget are retained', async () => {
    const cached = makeResource({ maxSizeBytes: 1024, memoryTtlMs: 60000 })
    const ctx = makeCtx('acc5')
    const fetcher = jest.fn().mockResolvedValue({ small: true })

    await cached(ctx, 'k', fetcher)
    await cached(ctx, 'k', fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reads through VBase when configured, without calling the origin', async () => {
    const cached = makeResource({ memoryTtlMs: 60000, vbaseTtlMinutes: 5 })
    const future = new Date(Date.now() + 60000)
    const ctx = makeCtx('acc6', { data: { from: 'vbase' }, ttl: future })
    const fetcher = jest.fn()

    expect(await cached(ctx, 'k', fetcher)).toEqual({ from: 'vbase' })
    expect(fetcher).not.toHaveBeenCalled()
    expect(ctx.clients.vbase.getJSON).toHaveBeenCalledTimes(1)
  })

  it('populates VBase on a full miss', async () => {
    const cached = makeResource({ memoryTtlMs: 60000, vbaseTtlMinutes: 5 })
    const ctx = makeCtx('acc7', null)
    const fetcher = jest.fn().mockResolvedValue({ fresh: true })

    expect(await cached(ctx, 'k', fetcher)).toEqual({ fresh: true })
    expect(fetcher).toHaveBeenCalledTimes(1)

    await flush()
    expect(ctx.clients.vbase.saveJSON).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failure: next request retries the origin', async () => {
    const cached = makeResource({ memoryTtlMs: 60000 })
    const ctx = makeCtx('acc-fail')
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error('md 500'))
      .mockResolvedValueOnce({ ok: true })

    await expect(cached(ctx, 'k', fetcher)).rejects.toThrow('md 500')
    expect(await cached(ctx, 'k', fetcher)).toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not cache a miss when the fetcher throws not-found', async () => {
    const cached = makeResource({ memoryTtlMs: 60000 })
    const ctx = makeCtx('acc-miss')
    const notFound = Object.assign(new Error('organizationNotFound'), {
      organizationNotFound: true,
    })

    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({ id: 'now-exists' })

    await expect(cached(ctx, 'k', fetcher)).rejects.toMatchObject({
      organizationNotFound: true,
    })
    expect(await cached(ctx, 'k', fetcher)).toEqual({ id: 'now-exists' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('returns the origin snapshot: mutating the result does not mutate cache', async () => {
    const cached = makeResource({ memoryTtlMs: 60000 })
    const ctx = makeCtx('acc-mut')
    const fetcher = jest.fn().mockResolvedValue({ permissions: undefined })

    const first = (await cached(ctx, 'k', fetcher)) as {
      permissions?: { createQuote: boolean }
    }

    const clone = {
      ...first,
      permissions: first.permissions ?? { createQuote: true },
    }

    clone.permissions.createQuote = false

    const second = (await cached(ctx, 'k', fetcher)) as {
      permissions?: { createQuote: boolean }
    }

    expect(second.permissions).toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('registers itself for stats collection', async () => {
    const cached = makeResource({ memoryTtlMs: 60000 })
    const ctx = makeCtx('acc8')

    await cached(ctx, 'k', jest.fn().mockResolvedValue(1))
    await cached(ctx, 'k', jest.fn().mockResolvedValue(1))

    const stats = collectCacheStats()
    const mine = stats.find(
      (s: { name?: string; itemCount?: number }) =>
        s.name === `test-${uniq - 1}`
    )

    expect(mine).toBeDefined()
    expect(mine?.itemCount).toBe(1)
  })
})
