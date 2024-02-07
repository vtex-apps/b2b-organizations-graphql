import axios from 'axios'

const ANALYTICS_URL = 'https://rc.vtex.com/api/analytics/schemaless-events'
const MAX_RETRIES = 2
const RETRY_INTERVAL = 1000 // 1 second

export const B2B_METRIC_NAME = 'b2b-suite-buyerorg-data'

export interface Metric {
  readonly account: string
  readonly kind: string
  readonly description: string
  readonly name: typeof B2B_METRIC_NAME
}

export const sendMetric = async (metric: Metric, retries = 0) => {
  try {
    await axios.post(ANALYTICS_URL, metric)
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL))
      await sendMetric(metric, retries + 1)
    } else {
      throw new Error(`${error.message} - after ${MAX_RETRIES} retries.`)
    }
  }
}
