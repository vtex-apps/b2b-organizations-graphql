import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { Metric } from './metrics'
import { sendMetric } from './metrics'

interface UserMetricType {
  description: string
  kind: string
}

const userMetricType = {
  add: {
    description: 'Add User Action - Graphql',
    kind: 'add-user-graphql-event',
  } as UserMetricType,
  remove: {
    description: 'Remove User Action - Graphql',
    kind: 'remove-user-graphql-event',
  } as UserMetricType,
  update: {
    description: 'Update User Action - Graphql',
    kind: 'update-user-graphql-event',
  } as UserMetricType,
}

class UserMetric implements Metric {
  public readonly description: string
  public readonly kind: string
  public readonly account: string
  public readonly fields: Partial<UserArgs>
  public readonly name = 'b2b-suite-buyerorg-data'

  constructor(
    account: string,
    { kind, description }: UserMetricType,
    fields: Partial<UserArgs>
  ) {
    this.account = account
    this.fields = fields
    this.kind = kind
    this.description = description
  }
}

const sendUserMetric = async (logger: Logger, userMetric: UserMetric) => {
  try {
    await sendMetric(userMetric)
  } catch (error) {
    logger.error({
      error,
      message: `Error to send metrics from user action ${userMetric.kind}`,
    })
  }
}

export const sendRemoveUserMetric = async (
  logger: Logger,
  account: string,
  userArgs: Partial<UserArgs>
) => {
  await sendUserMetric(
    logger,
    new UserMetric(account, userMetricType.remove, userArgs)
  )
}

export const sendAddUserMetric = async (
  logger: Logger,
  account: string,
  userArgs: Partial<UserArgs>
) => {
  await sendUserMetric(
    logger,
    new UserMetric(account, userMetricType.add, userArgs)
  )
}

export const sendUpdateUserMetric = async (
  logger: Logger,
  account: string,
  userArgs: Partial<UserArgs>
) => {
  await sendUserMetric(
    logger,
    new UserMetric(account, userMetricType.update, userArgs)
  )
}
