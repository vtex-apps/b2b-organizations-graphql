/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InstanceOptions, IOContext } from '@vtex/api'
import { ExternalClient, ForbiddenError } from '@vtex/api'

import { B2B_LM_PRODUCT_CODE } from '../utils/constants'

export default class LMClient extends ExternalClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(`http://${ctx.account}.vtexcommercestable.com.br/`, ctx, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }

  public getUserAdminPermissions = async (account: string, userId: string) => {
    return this.get(
      `/api/license-manager/pvt/accounts/${encodeURI(
        account
      )}/logins/${encodeURI(userId)}/granted`
    ).then((res: any) => {
      return res
    })
  }

  public checkUserAdminPermission = async (
    account: string,
    userEmail: string,
    resourceCode: string
  ) => {
    const productCode = B2B_LM_PRODUCT_CODE // resource name on lincense manager = B2B

    const checkOrgPermission = await this.get<boolean>(
      `/api/license-manager/pvt/accounts/${account}/products/${productCode}/logins/${userEmail}/resources/${resourceCode}/granted`
    )

    if (!checkOrgPermission) {
      throw new ForbiddenError('Unauthorized Access')
    }

    return checkOrgPermission
  }

  public getAccount = async () => {
    return this.get<GetAccountResponse>(`/api/license-manager/account`).then(
      (res) => {
        return res
      }
    )
  }

  protected get = <T>(url: string) => {
    return this.http.get<T>(url)
  }
}

interface GetAccountResponse {
  isActive: boolean
  id: string
  name: string
  accountName: string
  lv: unknown
  isOperating: boolean
  defaultUrl: unknown
  district: unknown
  country: unknown
  complement: unknown
  compunknownName: string
  cnpj: string
  haveParentAccount: boolean
  parentAccountId: unknown
  parentAccountName: unknown
  city: unknown
  address: unknown
  logo: unknown
  hasLogo: boolean
  number: unknown
  postalCode: unknown
  state: unknown
  telephone: string
  tradingName: string
  licenses: unknown[]
  sponsor: {
    name: string
    email: string
    phone: string
  }
  contact: {
    name: string
    email: string
    phone: string
  }
  operationDate: unknown
  inactivationDate: unknown
  creationDate: string
  hosts: unknown[]
  sites: unknown[]
  appKeys: unknown[]
}
