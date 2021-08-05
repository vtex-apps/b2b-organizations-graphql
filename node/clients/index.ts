import { IOClients } from '@vtex/api'

import VtexId from './vtexId'

// Extend the default IOClients implementation with our own custom clients.
export class Clients extends IOClients {
  public get vtexId() {
    return this.getOrSet('vtexId', VtexId)
  }
}
