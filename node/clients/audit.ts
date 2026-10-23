import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient, Session } from '@vtex/api'

import { describeClientError } from '../utils/clientError'

export class AuditClient extends ExternalClient {
  private session: Session
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('http://analytics.vtex.com', ctx, {
      ...options,
      headers: {
        'Proxy-Authorization': ctx.adminUserAuthToken || '',
        VtexIdclientAutCookie: ctx.adminUserAuthToken || '',
        Authorization: ctx.authToken,
        'X-Vtex-Use-Https': 'true',
      },
    })
    this.session = new Session(ctx, options)
  }

  private async getUserIdFromSession(sessionToken: string): Promise<string> {
    const { logger } = this.context

    try {
      const { sessionData } = await this.session.getSession(sessionToken, ['*'])
      const userId =
        sessionData?.namespaces?.authentication?.adminUserId?.value ||
        sessionData?.namespaces?.authentication?.storeUserId?.value ||
        sessionData?.namespaces?.profile?.id?.value ||
        'unknown'

      return userId
    } catch (error) {
      logger.error({
        message: 'Error fetching user ID from session',
        error: describeClientError(error),
      })

      return 'unknown'
    }
  }

  /**
   * Registers an audit event.
   *
   * IMPORTANT: this is fire-and-forget on purpose. Audit logging must never
   * add latency to the caller's critical path (e.g. login/session transform
   * queries like getCostCenterById, getMarketingTags and getB2BSettings,
   * which run inside storefront-permissions' setProfile with a tight
   * timeout). Building and sending the event involves a full session fetch
   * plus an outbound HTTP call to analytics.vtex.com, either of which can be
   * slow or unavailable without that being a reason to fail or delay the
   * caller. See B2BTEAM-3729 / TICKET #1433601 (Kohler login timeouts).
   *
   * Errors are caught and logged internally; they are never surfaced to the
   * caller since audit failures must not affect the caller's own result.
   */
  public sendEvent(auditEntry: AuditEntry): Promise<void> {
    const { logger } = this.context

    // Not awaited: intentionally detached from the caller's request flow.
    // Queries (login hot path) must keep this fire-and-forget behaviour —
    // see B2BTEAM-3729. Mutations that need fail-closed audit use sendEventStrict.
    this.dispatchEvent(auditEntry).catch((error) => {
      logger.error({
        message: 'Error sending audit event',
        error: describeClientError(error),
        operation: auditEntry.operation,
        subjectId: auditEntry.subjectId,
      })
    })

    return Promise.resolve()
  }

  /**
   * Awaits the audit HTTP call and rethrows on failure so mutations can fail
   * closed (B2BTEAM-3982 / SDD Q5). Do not use on query/login paths.
   */
  public async sendEventStrict(auditEntry: AuditEntry): Promise<void> {
    const { logger } = this.context

    try {
      await this.dispatchEvent(auditEntry, { throwOnError: true })
    } catch (error) {
      logger.error({
        message: 'audit.sendEventError',
        error: describeClientError(error),
        auditOperation: auditEntry.operation,
        subjectId: auditEntry.subjectId,
      })
      throw error
    }
  }

  private async dispatchEvent(
    auditEntry: AuditEntry,
    options: { throwOnError?: boolean } = {}
  ): Promise<void> {
    const { meta, subjectId, operation } = auditEntry
    const { account, operationId, requestId, userAgent, logger, sessionToken } =
      this.context

    const throwOnError = options.throwOnError === true

    let authorId = 'unknown'

    if (sessionToken) {
      authorId = await this.getUserIdFromSession(sessionToken)
    }

    const auditEvent = {
      mainAccountName: account,
      accountName: account,
      id: requestId,
      subjectId,
      authorId,
      application: 'b2bOrganizations',
      operation,
      operationId,
      meta: {
        forwardFromVtexUserAgent: userAgent,
        ...meta,
      },
      date: new Date().toJSON(),
    }

    try {
      await this.http.post(`/api/audit/events?an=${account}`, auditEvent)
    } catch (error) {
      if (throwOnError) {
        throw error
      }

      logger.error({
        message: 'Error sending audit event',
        error: describeClientError(error),
        operation,
        subjectId,
      })
    }
  }
}
