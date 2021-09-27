import { IOClients } from '@vtex/api'

import VtexId from './vtexId'
import { OMSClient } from './Oms'
import { SFPGraphQL } from './SFPGraphQL'

// Extend the default IOClients implementation with our own custom clients.
export class Clients extends IOClients {
  public get vtexId() {
    return this.getOrSet('vtexId', VtexId)
  }
  public get oms() {
    return this.getOrSet('oms', OMSClient)
  }
  public get sfpGraphQL() {
    return this.getOrSet('sfpGraphQL', SFPGraphQL)
  }
}
