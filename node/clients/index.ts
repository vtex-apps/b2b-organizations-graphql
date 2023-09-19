import { IOClients } from '@vtex/api'

import VtexId from './vtexId'
import PaymentsClient from './payments'
import MailClient from './email'
import Checkout from './checkout'
import OMSClient from './Oms'
import OrdersClient from './Orders'
import StorefrontPermissions from './storefrontPermissions'
import IdentityClient from './IdentityClient'
import Catalog from './catalog'
import SellersClient from './sellers'

// Extend the default IOClients implementation with our own custom clients.
export class Clients extends IOClients {
  public get checkout() {
    return this.getOrSet('checkout', Checkout)
  }

  public get payments() {
    return this.getOrSet('payments', PaymentsClient)
  }

  public get mail() {
    return this.getOrSet('mail', MailClient)
  }

  public get oms() {
    return this.getOrSet('oms', OMSClient)
  }

  public get orders() {
    return this.getOrSet('orders', OrdersClient)
  }

  public get storefrontPermissions() {
    return this.getOrSet('storefrontPermissions', StorefrontPermissions)
  }

  public get vtexId() {
    return this.getOrSet('vtexId', VtexId)
  }

  public get identity() {
    return this.getOrSet('identity', IdentityClient)
  }

  public get catalog() {
    return this.getOrSet('catalog', Catalog)
  }

  public get sellers() {
    return this.getOrSet('sellers', SellersClient)
  }
}
