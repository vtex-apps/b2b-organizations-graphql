import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient, Session } from '@vtex/api'

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
        error,
      })

      return 'unknown'
    }
  }

  public async sendEvent(auditEntry: AuditEntry): Promise<void> {
    const { meta, subjectId, operation } = auditEntry
    const { account, operationId, requestId, userAgent, logger, sessionToken } =
      this.context

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
      logger.error({
        message: 'Error sending audit event',
        error,
        auditEvent,
      })
    }
  }
}
