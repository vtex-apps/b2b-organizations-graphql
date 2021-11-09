import { IOClients } from '@vtex/api'

import VtexId from './vtexId'
import PaymentsClient from './payments'
import MailClient from './email'
import { OMSClient } from './Oms'
import { GraphQLServer } from './graphqlServer'

// Extend the default IOClients implementation with our own custom clients.
export class Clients extends IOClients {
  public get vtexId() {
    return this.getOrSet('vtexId', VtexId)
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

  public get graphQLServer() {
    return this.getOrSet('graphQLServer', GraphQLServer)
  }
}
