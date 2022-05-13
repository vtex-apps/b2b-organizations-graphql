import type { InstanceOptions, IOContext, RequestConfig } from '@vtex/api'
import { JanusClient } from '@vtex/api'

import { statusToError } from '../utils'

export default class OMSClient extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }

  public order = (id: string) =>
    this.get(this.routes.order(id), { metric: 'oms-order' })

  public search = (query: string) =>
    this.get(this.routes.search(query), { metric: 'oms-order-search' })

  protected get = <T>(url: string, config: RequestConfig = {}) => {
    config.headers = {
      ...config.headers,
    }

    return this.http.get<T>(url, config).catch(statusToError)
  }

  private get routes() {
    const base = '/api/oms'

    return {
      order: (id: string) => `${base}/pvt/admin/orders/${id}`,
      search: (query: string) => `${base}/pvt/orders?${query}`,
    }
  }
}
