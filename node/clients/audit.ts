import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export class AuditClient extends ExternalClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('http://analytics.vtex.com', ctx, {
      ...options,
      headers: {
        'Proxy-Authorization': ctx.adminUserAuthToken || '',
        VtexIdClientAutCookie: ctx.adminUserAuthToken || '',
        Authorization: ctx.authToken,
        'X-Vtex-Use-Https': 'true',
      },
    })
  }

  public async sendEvent(
    auditEntry: AuditEntry,
    sessionMeta: any
  ): Promise<void> {
    console.log('sendEvent', auditEntry)
    const { meta, subjectId, operation, authorId } = auditEntry
    const { account, operationId, requestId, userAgent, logger } = this.context

    console.log('sendEvent account', account)

    const auditEvent = {
      mainAccountName: account,
      accountName: account,
      id: requestId,
      subjectId,
      authorId,
      application: 'vtex.b2b-organizations-graphql',
      operation,
      operationId,
      meta: {
        fowardFromVtexUserAgent: userAgent,
        ...meta,
      },
      date: new Date().toJSON(),
    }

    console.log('auditEvent', auditEvent)

    try {
      await this.http.post(
        `http://analytics.vtex.com/api/audit/events?an=${account}`,
        auditEvent
      )
    } catch (error) {
      console.log(sessionMeta, logger)
      console.log('error ------', error)
    }
  }
}
