import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient, Session } from '@vtex/api'


export class AuditClient extends ExternalClient {
  private session: Session
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
    this.session = new Session(ctx, options)
  }

  private async getUserIdFromSession(sessionToken: string): Promise<string> {
    try {
      const { sessionData } = await this.session.getSession(sessionToken, ['*'])
      
      const userId = 
        sessionData?.namespaces?.authentication?.adminUserId?.value ||
        sessionData?.namespaces?.authentication?.storeUserId?.value ||
        sessionData?.namespaces?.profile?.id?.value ||
        'anonymous'
      
      return userId
    } catch (error) {
      console.error('Error getting session:', error)
      return 'anonymous'
    }
  }
  

  public async sendEvent(
    auditEntry: AuditEntry,
    sessionMeta: any
  ): Promise<void> {
    const { meta, subjectId, operation } = auditEntry
    const { account, operationId, requestId, userAgent, logger, sessionToken } = this.context

    let authorId = 'anonymous'
    
    if (sessionToken) {
      authorId = await this.getUserIdFromSession(sessionToken)
    }

    const auditEvent = {
      mainAccountName: account,
      accountName: account,
      id: requestId,
      subjectId,
      authorId: authorId,
      application: 'vtex.b2b-organizations-graphql',
      operation,
      operationId,
      meta: {
        fowardFromVtexUserAgent: userAgent,
        ...meta,
      },
      date: new Date().toJSON(),
    }

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
