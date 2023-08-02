import type { Metric } from './metrics'
import { sendMetric } from './metrics'

type ImpersonatePerson = {
  email: string
  buyer_org_id: string
  cost_center_id: string
  person_id: string
}

type ImpersonateFieldsMetric = {
  user?: ImpersonatePerson
  target: ImpersonatePerson
  date: string
}

type ImpersonateMetric = Metric & { fields: ImpersonateFieldsMetric }

type ImpersonatePersonParams = {
  costCenterId: string
  organizationId: string
  email: string
  id: string
}

export type ImpersonateMetricParams = {
  account: string
  target: ImpersonatePersonParams
  user?: ImpersonatePersonParams
}

const buildMetric = (metricParams: ImpersonateMetricParams) => {
  const { account, user, target } = metricParams

  const userParam = user
    ? {
        email: user?.email,
        buyer_org_id: user?.organizationId,
        cost_center_id: user?.costCenterId,
        person_id: user?.id,
      }
    : undefined

  const metric = {
    name: 'b2b-suite-buyerorg-data' as const,
    account,
    fields: {
      user: userParam,
      target: {
        email: target.email,
        buyer_org_id: target.organizationId,
        cost_center_id: target.costCenterId,
        person_id: target.id,
      },
      date: new Date().toISOString(),
    },
  }

  return metric
}

const buildImpersonateUserMetric = (
  metricParams: ImpersonateMetricParams
): ImpersonateMetric => {
  const metric: ImpersonateMetric = {
    kind: 'impersonate-user-graphql-event',
    description: 'Impersonate User Action - Graphql',
    ...buildMetric(metricParams),
  }

  return metric
}

const buildImpersonateB2BUserMetric = (
  metricParams: ImpersonateMetricParams
): ImpersonateMetric => {
  const metric: ImpersonateMetric = {
    kind: 'impersonate-b2b-user-graphql-event',
    description: 'Impersonate B2B User Action - Graphql',
    ...buildMetric(metricParams),
  }

  return metric
}

export const sendImpersonateUserMetric = async (
  metricParams: ImpersonateMetricParams
) => {
  try {
    const metric = buildImpersonateUserMetric(metricParams)

    await sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log metrics', error)
  }
}

export const sendImpersonateB2BUserMetric = async (
  metricParams: ImpersonateMetricParams
) => {
  try {
    const metric = buildImpersonateB2BUserMetric(metricParams)

    await sendMetric(metric)
  } catch (error) {
    console.warn('Unable to log metrics', error)
  }
}
