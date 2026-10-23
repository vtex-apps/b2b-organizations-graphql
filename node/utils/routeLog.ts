/**
 * Helpers for the HTTP routes in `resolvers/Routes` (B2BTEAM-3984, SDD §4.3;
 * B2BTEAM-3988).
 *
 * Expected outcomes (order not found, checkout refusing a cancellation with
 * 4xx) are logged by the routes as structured warns, and real failures as
 * structured errors. `safeRoute` then turns whatever was thrown into a fixed
 * response, so nothing from a failed call reaches the response body.
 */

import {
  ForbiddenError,
  NotFoundError,
  RequestCancelledError,
  TooManyRequestsError,
  UserInputError,
} from '@vtex/api'

import { describeClientError } from './clientError'

export type RouteName = 'orders' | 'order' | 'requestCancellation' | 'checkout'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getResponseStatus = (error: any): number | undefined => {
  const status = error?.response?.status

  return typeof status === 'number' ? status : undefined
}

/**
 * Error with a response that is safe to send to the caller as is: `status`,
 * `code` and `message` are fixed strings chosen by the route, never data from
 * a failed call.
 */
export class RouteResponseError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'RouteResponseError'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loggedErrors = new WeakSet<any>()

/**
 * Marks an error the route already logged with full context, so `safeRoute`
 * answers with the generic response without logging it a second time.
 */
export const markLogged = <T>(error: T): T => {
  if (error !== null && typeof error === 'object') {
    loggedErrors.add(error)
  }

  return error
}

const INTERNAL_ERROR = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  status: 500,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSafeResponse = (error: any) => {
  if (
    error instanceof RouteResponseError ||
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof UserInputError
  ) {
    const { status } = error as { status?: number }

    return {
      code: String(error.code),
      expected: true,
      message: String(error.message),
      status:
        typeof status === 'number' && status >= 400 && status <= 599
          ? status
          : 500,
    }
  }

  return { ...INTERNAL_ERROR, expected: false }
}

/**
 * Wraps an HTTP route so a failure never reaches the `@vtex/api` HTTP error
 * middleware. That middleware writes the thrown error itself to the response
 * body, and a client error carries the outbound request with it (in linked
 * workspaces even `config.headers`, which includes the caller's
 * `x-vtex-session`). Here the body is always `{ code, message, status }` with
 * fixed values, and the details stay in the server log only, through
 * `describeClientError`.
 *
 * Errors the route already logged (`markLogged`) or answered on purpose
 * (`RouteResponseError`, `ForbiddenError`, `NotFoundError`, `UserInputError`)
 * are not logged again; anything else logs `error` `route.<route>.error`.
 * Cancelled requests and rate limits are left to the runtime, which answers
 * them with no body.
 */
export const safeRoute = (
  route: RouteName,
  handler: (ctx: Context) => Promise<void>
) => {
  const wrapped = async (ctx: Context) => {
    try {
      await handler(ctx)
    } catch (error) {
      if (
        error instanceof RequestCancelledError ||
        error instanceof TooManyRequestsError
      ) {
        throw error
      }

      const { expected, ...response } = toSafeResponse(error)

      if (!expected && !loggedErrors.has(error)) {
        ctx.vtex.logger.error({
          error: describeClientError(error),
          message: `route.${route}.error`,
          operation: route,
          route,
        })
      }

      ctx.set('Content-Type', 'application/json')
      ctx.set('Cache-Control', 'no-cache, no-store')
      ctx.response.status = response.status
      ctx.response.body = response
    }
  }

  // The runtime labels route timings with the handler's name, which a
  // wrapped handler would otherwise lose.
  return Object.defineProperty(wrapped, 'name', { value: route })
}
