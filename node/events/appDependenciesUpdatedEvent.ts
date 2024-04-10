import type { EventContext } from '@vtex/api'

import type { Clients } from '../clients'
import checkConfig from '../resolvers/config'

export async function appDependenciesUpdatedEvent(ctx: EventContext<Clients>) {
  const {
    vtex: { logger, workspace },
    body,
  } = ctx

  logger.debug({
    message: '[B2B Organizations GraphQL] Received appDependenciesUpdatedEvent',
    body,
  })

  // As a first iteration, we'll only send the workspace installed apps from master.
  if (workspace !== 'master') {
    return
  }

  checkConfig(ctx)
}
