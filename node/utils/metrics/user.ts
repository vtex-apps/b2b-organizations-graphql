import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { UserArgs } from '../../typings'
import type { Metric } from '../../clients/analytics'
import { B2B_METRIC_NAME } from '../../clients/analytics'

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
  public readonly name = B2B_METRIC_NAME

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

const sendUserMetric = async (
  ctx: Context,
  logger: Logger,
  userMetric: UserMetric
) => {
  const {
    clients: { analytics },
  } = ctx

  try {
    await analytics.sendMetric(userMetric)
  } catch (error) {
    logger.error({
      error,
      message: `Error to send metrics from user action ${userMetric.kind}`,
    })
  }
}

export const sendRemoveUserMetric = async (
  ctx: Context,
  logger: Logger,
  account: string,
  userArgs: Partial<UserArgs>
) => {
  await sendUserMetric(
    ctx,
    logger,
    new UserMetric(account, userMetricType.remove, userArgs)
  )
}

export const sendAddUserMetric = async (
  ctx: Context,
  logger: Logger,
  account: string,
  userArgs: Partial<UserArgs>
) => {
  await sendUserMetric(
    ctx,
    logger,
    new UserMetric(account, userMetricType.add, userArgs)
  )
}

export const sendUpdateUserMetric = async (
  ctx: Context,
  logger: Logger,
  account: string,
  userArgs: Partial<UserArgs>
) => {
  await sendUserMetric(
    ctx,
    logger,
    new UserMetric(account, userMetricType.update, userArgs)
  )
}
