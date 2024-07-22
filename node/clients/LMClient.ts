/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

export default class LMClient extends ExternalClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(`http://${ctx.account}.vtexcommercestable.com.br/`, ctx, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }

  public getUserAdminPermissions = async (account: string, userId: string) => {
    return this.get(
      `/api/license-manager/pvt/accounts/${encodeURI(
        account
      )}/logins/${encodeURI(userId)}/granted`
    ).then((res: any) => {
      return res
    })
  }

  protected get = <T>(url: string) => {
    return this.http.get<T>(url)
  }
}
