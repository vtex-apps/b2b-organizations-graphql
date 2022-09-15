import { IOClients } from '@vtex/api'

import VtexId from './vtexId'
import PaymentsClient from './payments'
import MailClient from './email'
import Checkout from './checkout'
import OMSClient from './Oms'
import StorefrontPermissions from './storefrontPermissions'
import IdentityClient from './IdentityClient'

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

  public get storefrontPermissions() {
    return this.getOrSet('storefrontPermissions', StorefrontPermissions)
  }

  public get vtexId() {
    return this.getOrSet('vtexId', VtexId)
  }

  public get identity() {
    return this.getOrSet('identity', IdentityClient)
  }
}
