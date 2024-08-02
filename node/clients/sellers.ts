import type { InstanceOptions, IOContext } from '@vtex/api'
import { JanusClient } from '@vtex/api'
import { isNaN, orderBy } from 'lodash'

const SELLERS_PATH = '/api/seller-register/pvt/sellers'

export interface Seller {
  id: string
  name: string
  email: string
}

export interface GetSellersResponse {
  items: Seller[]
  pagination: {
    page: number
    pageSize: number
    total: number
  }
}

export interface GetSellersOpts {
  page: number
  pageSize: number
}

const INITIAL_LIST_OPTIONS = {
  page: 1,
  pageSize: 100,
}

export default class SellersClient extends JanusClient {
  constructor(context: IOContext, options?: InstanceOptions) {
    super(context, {
      ...options,
      headers: {
        VtexIdClientAutCookie: context.authToken,
      },
    })
  }

  public async getSellers(args?: GetSellersOpts): Promise<GetSellersResponse> {
    const argsWithDefaults = {
      ...INITIAL_LIST_OPTIONS,
      ...args,
    }

    const result = await this.http.get<{
      paging: {
        from: number
        to: number
        total: number
      }
      items: Seller[]
    }>(SELLERS_PATH, {
      metric: 'sellers-get',
      params: {
        from: argsWithDefaults?.page ?? INITIAL_LIST_OPTIONS.page,
        to: argsWithDefaults?.pageSize ?? INITIAL_LIST_OPTIONS.pageSize,
      },
    })

    if (!result.items) {
      return {
        items: [],
        pagination: {
          page: 0,
          pageSize: 0,
          total: 0,
        },
      }
    }

    if (result.items.length > 1) {
      result.items = this.sortSellers(result.items)
    }

    return {
      items: result.items,
      pagination: {
        page: argsWithDefaults.page,
        pageSize: argsWithDefaults.pageSize,
        total: result.paging.total,
      },
    }
  }

  private sortSellers(sellers: Seller[]) {
    return orderBy(
      sellers,
      [
        (seller: Seller) => {
          const name = seller.name ?? ''
          const isNumber = !isNaN(name) && name !== ''

          return isNumber ? 1 : 0
        },
        (seller: Seller) => {
          const name = seller.name ?? ''

          return isNaN(name) ? name : Number(name)
        },
      ],
      ['asc', 'asc']
    )
  }
}
