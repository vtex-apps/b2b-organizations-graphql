import axios from 'axios'

const ANALYTICS_URL = 'https://rc.vtex.com/api/analytics/schemaless-events'

type ImpersonateUserMetric = {
  kind: 'impersonate-user-graphql-event'
  description: 'Impersonate User Action - Graphql'
}

type ImpersonateB2BUserMetric = {
  kind: 'impersonate-b2b-user-graphql-event'
  description: 'Impersonate B2B User Action - Graphql'
}

export type Metric = {
  name: 'b2b-suite-buyerorg-data'
  account: string
} & (ImpersonateUserMetric | ImpersonateB2BUserMetric)

export const sendMetric = async (metric: Metric) => {
  try {
    await axios.post(ANALYTICS_URL, metric)
  } catch (error) {
    console.warn('Unable to log metrics', error)
  }
}
