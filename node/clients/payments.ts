import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'
import { CREDIT_CARDS } from '../constants'

export default class PaymentsClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdClientAutCookie: context.authToken,
      },
    })
  }

  public rules = () =>
    this.http.get<Rule[]>(`api/payments/pvt/rules`, {
      metric: 'payments-get-rules',
    })

  public async getPaymentTerms() {
    const paymentRules = await this.rules()

    const enabledConnectors = paymentRules.filter(
      (rule) => rule.enabled === true
    )

    const enabledPaymentSystems = enabledConnectors.map(
      (connector) => connector.paymentSystem
    )

    const uniquePaymentSystems = enabledPaymentSystems.filter(
      (value, index, self) => {
        return (
          index ===
          self.findIndex((t) => t.id === value.id && t.name === value.name)
        )
      }
    )

    const uniquePaymentSystemsWithoutCreditCards =
      uniquePaymentSystems.filter((value) => {
        return !CREDIT_CARDS.includes(value.name)
      })

    uniquePaymentSystemsWithoutCreditCards.unshift({
      id: 999999,
      implementation: null,
      name: 'Credit card',
    })

    return uniquePaymentSystemsWithoutCreditCards
  }
}

interface Rule {
  id: string
  name: string
  salesChannels: Array<{
    id: string
  }>
  paymentSystem: { id: number; name: string; implementation: string | null }
  connector: {
    implementation: string
    affiliationId: string
  }
  issuer: { name: string | null }
  antifraud: { implementation: string | null; affiliationId: string | null }
  installmentOptions: string | null
  isSelfAuthorized: string | null
  requiresAuthentication: string | null
  enabled: boolean
  installmentsService: boolean
  isDefault: string | null
  beginDate: string | null
  endDate: string | null
  condition: string | null
  multiMerchantList: string | null
  country: string | null
  dateIntervals: string | null
  externalInterest: boolean
  minimumValue: string | null
  deadlines: string[]
  cobrand: { name: string | null }
  cardLevel: { name: string | null }
  excludedBinsRanges: string | null
}
