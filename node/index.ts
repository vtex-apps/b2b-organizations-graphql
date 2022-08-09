import type {
  ClientsConfig,
  ParamsContext,
  RecorderState,
  ServiceContext,
} from '@vtex/api'
import { LRUCache, Service } from '@vtex/api'

import { Clients } from './clients'
import { resolvers } from './resolvers'
import { schemaDirectives } from './resolvers/directives'

const TIMEOUT_MS = 4000

// Create a LRU memory cache for the Status client.
// The @vtex/api HttpClient respects Cache-Control headers and uses the provided cache.
const memoryCache = new LRUCache<string, any>({ max: 5000 })

metrics.trackCache('status', memoryCache)

// This is the configuration for clients available in `ctx.clients`.
const clients: ClientsConfig<Clients> = {
  // We pass our custom implementation of the clients bag, containing the Status client.
  implementation: Clients,
  options: {
    // All IO Clients will be initialized with these options, unless otherwise specified.
    default: {
      retries: 2,
      timeout: TIMEOUT_MS,
    },
    // This key will be merged with the default options and add this cache to our Status client.
    status: {
      memoryCache,
    },
  },
}

declare global {
  type Context = ServiceContext<Clients>
}

export default new Service<Clients, RecorderState, ParamsContext>({
  clients,
  graphql: {
    resolvers: {
      B2BUser: resolvers.B2BUser,
      Mutation: resolvers.Mutation,
      Query: resolvers.Query,
    },
    schemaDirectives,
  },
  routes: resolvers.Routes,
})
