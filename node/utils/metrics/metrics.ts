import axios from 'axios'

const ANALYTICS_URL = 'https://rc.vtex.com/api/analytics/schemaless-events'

export interface Metric {
  readonly account: string
  readonly kind: string
  readonly description: string
  readonly name: 'b2b-suite-buyerorg-data'
}

export const sendMetric = async (metric: Metric) => {
  await axios.post(ANALYTICS_URL, metric)
}
