import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

const MAIL_SERVICE_PATH = '/api/mail-service/pvt/sendmail'
const TEMPLATE_RENDER_PATH = '/api/template-render/pvt/templates'

export default class MailClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        VtexIdClientAutCookie: context.authToken,
      },
    })
  }

  public async sendMail(mailData: MailData): Promise<string> {
    return this.http.post(MAIL_SERVICE_PATH, mailData, {
      metric: 'mail-post-send',
    })
  }

  public getTemplate(name: string) {
    return this.http.get<Template>(`${TEMPLATE_RENDER_PATH}/${name}`, {
      metric: 'mail-get-template',
    })
  }

  public publishTemplate(template: Template) {
    return this.http.post(TEMPLATE_RENDER_PATH, template, {
      metric: 'mail-post-template',
    })
  }
}

export interface MailData {
  templateName: string
  jsonData: JsonData
}

export interface JsonData {
  message: {
    to: string
  }
  organization: {
    name: string
    admin?: string
    note?: string
    status?: string
  }
}

interface Template {
  AccountId?: string
  AccountName?: string
  ApplicationId?: string
  Description?: string
  FriendlyName: string
  IsDefaultTemplate: boolean
  IsPersisted: boolean
  IsRemoved: boolean
  Name: string
  Type: string
  Templates: {
    email: {
      To: string
      CC?: string
      BCC?: string
      Subject: string
      Message: string
      Type: string
      ProviderId: string
      ProviderName?: string
      IsActive: boolean
      withError: boolean
    }
    sms: {
      Type: string
      ProviderId?: string
      ProviderName?: string
      IsActive: boolean
      withError: boolean
      Parameters: string[]
    }
  }
}
