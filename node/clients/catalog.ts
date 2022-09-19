import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export default class Catalog extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, { ...options })
  }

  public async salesChannelAvailable(email: string) {
    return this.http.get<SalesChannelAvailable[]>(
      `/api/catalog_system/pub/saleschannel/available?email=${encodeURIComponent(
        email
      )}`,
      {
        metric: 'catalog-sales-channel-available',
      }
    )
  }
}

interface SalesChannelAvailable {
  Id: number
  Name: string
  IsActive: boolean
  ProductClusterId: string | null
  CountryCode: string
  CultureInfo: string
  TimeZone: string
  CurrencyCode: string
  CurrencySymbol: string
  CurrencyLocale: number
  CurrencyFormatInfo: unknown
  Position: number
  ConditionRule: string | null
  CurrencyDecimalDigits: null | number
}
