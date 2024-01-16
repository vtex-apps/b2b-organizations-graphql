import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'

export default class Catalog extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        VtexIdClientAutCookie: ctx.authToken,
      },
    })
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

  public async collectionsAvailable(searchTerm: string) {
    return this.http.get<PagedCollectionsResponseAPI>(
      `/api/catalog_system/pvt/collection/search/${encodeURI(searchTerm)}`,
      {
        metric: 'catalog-collections-available',
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

interface Paging {
  pages: number
  page: number
  perPage: number
  total: number
}

interface CollectionItem {
  id: number
  name: string
  searchable: boolean
  highlight: boolean
  dateFrom: string
  dateTo: string
  totalProducts: number
  type: 'Hybrid' | 'Manual' | 'Automatic'
  lastModifiedBy: string | null
}

interface PagedCollectionsResponseAPI {
  paging: Paging
  items: CollectionItem[]
}
