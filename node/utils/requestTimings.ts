import type { Logger } from '@vtex/api/lib/service/logger/logger'

export interface RequestTimings {
  [step: string]: number
}

export interface TimerMeta {
  extra?: Record<string, unknown>
  sampleRate?: number
  slowThresholdMs?: number
}

export interface Timer {
  /** Filled in by the handler once it knows the account's settings. */
  meta: TimerMeta
  timings: RequestTimings
  totalMs: () => number
  track: <T>(step: string, promise: Promise<T>) => Promise<T>
}

export const DEFAULT_SLOW_THRESHOLD_MS = 1000

/**
 * Collects per-step durations in memory with negligible overhead (two
 * Date.now() calls per step) so they can be emitted as a single structured log
 * line at the end of the request. Deliberately does not log per step: one line
 * per slow/sampled/failed call is the only viable volume on hot GraphQL paths.
 */
export const createTimer = (): Timer => {
  const startedAt = Date.now()
  const timings: RequestTimings = {}

  const track = async <T>(step: string, promise: Promise<T>): Promise<T> => {
    const stepStartedAt = Date.now()

    try {
      return await promise
    } finally {
      timings[step] = Date.now() - stepStartedAt
    }
  }

  return {
    meta: {},
    timings,
    totalMs: () => Date.now() - startedAt,
    track,
  }
}

/**
 * Lets the surrounding middleware/resolver own the timer while nested helpers
 * still record into it. Keyed weakly by the request context, so entries
 * disappear with the request.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
const timers = new WeakMap<object, Timer>()

// eslint-disable-next-line @typescript-eslint/ban-types
export const attachTimer = (ctx: object, timer: Timer) => {
  timers.set(ctx, timer)
}

// eslint-disable-next-line @typescript-eslint/ban-types
export const getTimer = (ctx: object): Timer | undefined => timers.get(ctx)

export interface LogRequestTimingsArgs {
  /**
   * Emit via `logger.error` so the line survives IO Victorialog sampling that
   * routinely drops `info`/`warn` on hot paths. Use only for short-lived
   * diagnosis — not as the steady-state level for production volume.
   */
  asError?: boolean
  extra?: Record<string, unknown>
  logger: Logger
  message: string
  /** 0..1 fraction of non-slow requests to log, for baseline visibility. */
  sampleRate?: number
  slowThresholdMs?: number
  timer: Timer
}

/**
 * Emits the collected timings, but only when the request was slow (logged as
 * `warn`) or when it falls into the sample (logged as `info`). This keeps the
 * signal useful for diagnosing any account without flooding the log pipeline.
 */
export const logRequestTimings = ({
  asError,
  extra,
  logger,
  message,
  sampleRate,
  slowThresholdMs,
  timer,
}: LogRequestTimingsArgs) => {
  const totalMs = timer.totalMs()
  const threshold = slowThresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS
  const isSlow = totalMs >= threshold

  if (!asError && !isSlow && !(Math.random() < (sampleRate ?? 0))) {
    return
  }

  const steps = Object.keys(timer.timings)

  const slowestStep = steps.reduce(
    (slowest, step) =>
      timer.timings[step] > (timer.timings[slowest] ?? -1) ? step : slowest,
    steps[0] ?? ''
  )

  const payload = {
    message,
    slowestStep,
    slowestStepMs: timer.timings[slowestStep] ?? 0,
    timings: timer.timings,
    totalMs,
    ...extra,
  }

  if (asError) {
    logger.error(payload)

    return
  }

  if (isSlow) {
    logger.warn(payload)
  } else {
    logger.info(payload)
  }
}
