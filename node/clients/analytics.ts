import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient } from '@vtex/api'

const ENDPOINT = 'http://rc.vtex.com'
const METRICS_PATH = '/api/analytics/schemaless-events'
const MAX_RETRIES = 2
const RETRY_INTERVAL = 1000 // 1 second

export const B2B_METRIC_NAME = 'b2b-suite-buyerorg-data'

export interface Metric {
  readonly account: string
  readonly kind: string
  readonly description: string
  readonly name: typeof B2B_METRIC_NAME
}

export default class AnalyticsClient extends ExternalClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(ENDPOINT, context, {
      ...options,
      headers: {
        'X-Vtex-Use-Https': 'true',
      },
    })
  }

  public async sendMetric(metric: Metric, retries = 0) {
    try {
      await this.http.post(METRICS_PATH, metric)
    } catch (error) {
      if (retries < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL))
        await this.sendMetric(metric, retries + 1)
      } else {
        throw new Error(`${error.message} - after ${MAX_RETRIES} retries.`)
      }
    }
  }
}
