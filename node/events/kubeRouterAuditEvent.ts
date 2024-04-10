import type { EventContext } from '@vtex/api'

import type { Clients } from '../clients'
import checkConfig from '../resolvers/config'

export async function kubeRouterAuditEvent(ctx: EventContext<Clients>) {
  const {
    vtex: { logger },
    body: { operation },
  } = ctx

  logger.debug({
    message: '[B2B Organizations GraphQL] Received kubeRouterAuditEvent',
    body: ctx.body,
  })

  // As first iteration, we'll only send the workspace installed apps from master.
  if (operation === 'promote') {
    // Update schemas.
    checkConfig(ctx)
  }
}
