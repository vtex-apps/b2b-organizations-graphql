import { describeClientError } from './clientError'
import { collectCacheStats } from '../services/cache'
import { CACHE_STATS_INTERVAL_MS } from './constants'
import {
  attachTimer,
  createTimer,
  DEFAULT_SLOW_THRESHOLD_MS,
  getTimer,
  logRequestTimings,
} from './requestTimings'
import type { Timer } from './requestTimings'
import checkConfig from '../resolvers/config'
import { getCachedCheckConfig } from '../services/organizationsCache'

// Start a full interval after boot, so freshly started pods do not emit an
// empty report on their first request.
let cacheStatsLastEmittedAt = Date.now()

/**
 * Piggybacks on a hot Query to report per-pod cache hit rates and sizes: one
 * `info` line per pod every five minutes (IO apps have no scheduler).
 */
export const maybeEmitCacheStats = (ctx: Context) => {
  const now = Date.now()

  if (now - cacheStatsLastEmittedAt < CACHE_STATS_INTERVAL_MS) {
    return
  }

  cacheStatsLastEmittedAt = now

  ctx.vtex.logger.info({
    message: 'cacheStats',
    stats: collectCacheStats(),
  })
}

/**
 * Queries must not block on schema/template sync. Fire-and-forget when the
 * per-tenant "already synced" memory flag is cold; mutations still await
 * `checkConfig` directly.
 */
export const ensureConfigForQuery = (ctx: Context) => {
  getCachedCheckConfig(ctx, () => checkConfig(ctx)).catch((error) => {
    ctx.vtex.logger.error({
      error: describeClientError(error),
      message: 'ensureConfigForQuery-error',
    })
  })
}

/**
 * Fire-and-forget audit on Query paths. `AuditClient.sendEvent` is already
 * non-blocking, but callers must not await it and must log failures safely.
 */
export const auditQueryEvent = (
  ctx: Context,
  auditEntry: {
    subjectId: string
    operation: string
    meta: Record<string, unknown>
  }
) => {
  const {
    clients: { audit },
    vtex: { logger },
  } = ctx

  Promise.resolve(audit.sendEvent(auditEntry as any)).catch((error) => {
    logger.error({
      error: describeClientError(error),
      message: 'auditQueryEvent-error',
    })
  })
}

export interface WithQueryTimingsArgs<T> {
  asError?: boolean
  ctx: Context
  message: string
  run: (timer: Timer) => Promise<T>
  extra?: Record<string, unknown>
  sampleRate?: number
  slowThresholdMs?: number
}

/**
 * Owns timing telemetry for a hot GraphQL Query: always log on throw; on
 * success only when slow (default 1000ms) or sampled. Also may emit cacheStats.
 *
 * Reuses a timer already attached to `ctx` (e.g. by `@validateStoreUserAccess`)
 * so auth work that runs before the resolver is included in the same breakdown.
 */
export const withQueryTimings = async <T>({
  asError,
  ctx,
  message,
  run,
  extra,
  sampleRate = 0,
  slowThresholdMs = DEFAULT_SLOW_THRESHOLD_MS,
}: WithQueryTimingsArgs<T>): Promise<T> => {
  const existing = getTimer(ctx)
  const timer = existing ?? createTimer()

  if (!existing) {
    attachTimer(ctx, timer)
  }

  maybeEmitCacheStats(ctx)

  try {
    const result = await run(timer)

    logRequestTimings({
      asError,
      extra: { ...timer.meta.extra, ...extra },
      logger: ctx.vtex.logger,
      message,
      sampleRate,
      slowThresholdMs,
      timer,
    })

    return result
  } catch (error) {
    logRequestTimings({
      asError,
      extra: { ...timer.meta.extra, ...extra, failed: true },
      logger: ctx.vtex.logger,
      message,
      slowThresholdMs: 0,
      timer,
    })

    throw error
  }
}
