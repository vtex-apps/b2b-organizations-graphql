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

  public async getSellers(opts?: GetSellersOpts): Promise<GetSellersResponse> {
    const argsWithDefaults = {
      ...INITIAL_LIST_OPTIONS,
      ...opts,
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
        from: (argsWithDefaults.page - 1) * argsWithDefaults.pageSize,
        to: argsWithDefaults.page * argsWithDefaults.pageSize,
      },
    })

    if (!result.items) {
      return {
        items: [],
        pagination: {
          page: 1,
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
    // Sorts the sellers first based on whether the name is a number, then sorts by the actual name
    return orderBy(
      sellers,
      [
        (seller: Seller) => {
          const name = seller.name ?? ''
          // Check if the name is a number and not an empty string
          const isNumber = !isNaN(name) && name !== ''

          // Returns 1 if the name is a number, or 0 if not, to prioritize sorting numbers first
          return isNumber ? 1 : 0
        },
        (seller: Seller) => {
          const name = seller.name ?? ''

          // If the name is not a number, return the name as a string for alphabetical sorting
          // If it is a number, convert it to a number for numeric sorting

          return isNaN(name) ? name : Number(name)
        },
      ],
      // Sort both criteria in ascending order
      ['asc', 'asc']
    )
  }
}
