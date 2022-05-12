import type { IOContext, InstanceOptions } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export default class Checkout extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, { ...options })
  }

  public async requestCancellation(orderId: string) {
    return this.http.postRaw(
      `${this.routes.requestCancellation(orderId)}`,
      {},
      {
        headers: {
          VtexIdclientAutCookie: this.context.authToken,
        },
        metric: 'checkout-requestCancellation',
      }
    )
  }

  private get routes() {
    const basePvt = '/api/checkout/pvt'

    return {
      requestCancellation: (orderId: string) =>
        `${basePvt}/orders/${orderId}/cancelation-request`,
    }
  }
}
