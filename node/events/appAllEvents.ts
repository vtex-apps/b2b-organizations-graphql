import type { EventContext } from '@vtex/api'

import type { Clients } from '../clients'

export async function appAllEvents(ctx: EventContext<Clients>) {
  const {
    vtex: { logger },
    body,
  } = ctx

  logger.debug({
    message: '[B2B Organizations GraphQL] Received appEvent',
    body,
  })
}
