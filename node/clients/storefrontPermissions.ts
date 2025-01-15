import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppGraphQLClient } from '@vtex/api'

import addUser from '../mutations/addUser'
import deleteUser from '../mutations/deleteUser'
import impersonateUser from '../mutations/impersonateUser'
import saveUser from '../mutations/saveUser'
import updateUser from '../mutations/updateUser'
import getB2BUser from '../queries/getB2BUser'
import getOrganizationsByEmail from '../queries/getOrganizationsByEmail'
import getOrganizationsPaginatedByEmail from '../queries/getOrganizationsPaginatedByEmail'
import getPermission from '../queries/getPermission'
import getRole from '../queries/getRole'
import getUser from '../queries/getUser'
import getUsersByEmail from '../queries/getUsersByEmail'
import listAllUsers from '../queries/listAllUsers'
import listRoles from '../queries/listRoles'
import listUsers from '../queries/listUsers'
import listUsersPaginated from '../queries/listUsersPaginated'

export default class StorefrontPermissions extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.storefront-permissions@1.x', ctx, options)
  }

  public checkUserPermission = async (app?: string): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(app),
      query: getPermission,
      variables: {},
    })
  }

  public getOrganizationsByEmail = async (email: string): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: getOrganizationsByEmail,
      variables: {
        email,
      },
    })
  }

  public getOrganizationsPaginatedByEmail = async (
    email: string,
    page: number,
    pageSize: number
  ): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: getOrganizationsPaginatedByEmail,
      variables: {
        email,
        page,
        pageSize,
      },
    })
  }

  public listRoles = async (): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: listRoles,
      variables: {},
    })
  }

  public getRole = async (roleId: string): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: getRole,
      variables: { id: roleId },
    })
  }

  public listAllUsers = async (): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: listAllUsers,
      variables: {},
    })
  }

  public listUsers = async ({
    roleId,
    organizationId,
    costCenterId,
  }: {
    roleId?: string
    organizationId?: string
    costCenterId?: string
  }): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: listUsers,
      variables: {
        roleId,
        ...(organizationId && { organizationId }),
        ...(costCenterId && { costCenterId }),
      },
    })
  }

  public listUsersPaginated = async ({
    roleId,
    organizationId,
    costCenterId,
    search = '',
    page = 1,
    pageSize = 25,
    sortOrder = 'asc',
    sortedBy = 'email',
  }: {
    roleId?: string
    organizationId?: string
    costCenterId?: string
    search?: string
    page?: number
    pageSize?: number
    sortOrder?: string
    sortedBy?: string
  }): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: listUsersPaginated,
      variables: {
        page,
        pageSize,
        roleId,
        search,
        sortOrder,
        sortedBy,
        ...(organizationId && { organizationId }),
        ...(costCenterId && { costCenterId }),
      },
    })
  }

  public getUser = async (userId: string): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: getUser,
      variables: { id: userId },
    })
  }

  public getUsersByEmail = async (
    email: string,
    orgId: string,
    costId: string
  ): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: getUsersByEmail,
      variables: { email, orgId, costId },
    })
  }

  public getB2BUser = async (id: string): Promise<any> => {
    return this.query({
      extensions: this.getPersistedQuery(),
      query: getB2BUser,
      variables: { id },
    })
  }

  public addUser = async ({
    id,
    roleId,
    userId,
    orgId,
    costId,
    name,
    email,
  }: {
    id?: string
    roleId: string
    userId?: string
    orgId?: string
    costId?: string
    clId?: string
    name: string
    email: string
  }): Promise<any> => {
    return this.graphql.mutate(
      {
        mutate: addUser,
        variables: {
          canImpersonate: false,
          costId,
          email,
          id,
          name,
          orgId,
          roleId,
          userId,
        },
      },
      {
        headers: this.getTokenToHeader(),
      }
    )
  }

  public updateUser = async ({
    id,
    roleId,
    userId,
    orgId,
    costId,
    clId,
    name,
    email,
  }: {
    id?: string
    roleId: string
    userId?: string
    orgId?: string
    costId?: string
    clId?: string
    name: string
    email: string
  }): Promise<any> => {
    return this.graphql.mutate(
      {
        mutate: updateUser,
        variables: {
          canImpersonate: false,
          clId,
          costId,
          email,
          id,
          name,
          orgId,
          roleId,
          userId,
        },
      },
      {
        headers: this.getTokenToHeader(),
      }
    )
  }

  // deprecated
  public saveUser = async ({
    id,
    roleId,
    userId,
    orgId,
    costId,
    clId,
    name,
    email,
  }: {
    id?: string
    roleId: string
    userId?: string
    orgId?: string
    costId?: string
    clId?: string
    name: string
    email: string
  }): Promise<any> => {
    return this.graphql.mutate(
      {
        mutate: saveUser,
        variables: {
          canImpersonate: false,
          clId,
          costId,
          email,
          id,
          name,
          orgId,
          roleId,
          userId,
        },
      },
      {
        headers: this.getTokenToHeader(),
      }
    )
  }

  public deleteUser = async ({
    id,
    userId,
    email,
  }: {
    id?: string
    userId?: string
    email: string
  }): Promise<any> => {
    return this.graphql.mutate(
      {
        mutate: deleteUser,
        variables: {
          email,
          id,
          userId,
        },
      },
      {
        headers: this.getTokenToHeader(),
      }
    )
  }

  public impersonateUser = async ({
    userId,
  }: {
    userId?: string
  }): Promise<any> => {
    const graphqlResult = this.graphql.mutate(
      {
        mutate: impersonateUser,
        variables: {
          userId,
        },
      },
      {
        headers: this.getTokenToHeader(),
        params: {
          locale: this.context.locale,
        },
      }
    )

    return graphqlResult
  }

  private getTokenToHeader = () => {
    // provide authToken (app token) as an admin token as this is a call
    // between b2b suite apps and no further token validation is needed
    const adminToken = this.context.authToken
    const userToken = this.context.storeUserAuthToken ?? null
    const { sessionToken, account } = this.context

    let allCookies = `VtexIdclientAutCookie=${adminToken}`

    if (userToken) {
      allCookies += `; VtexIdclientAutCookie_${account}=${userToken}`
    }

    return {
      'x-vtex-credential': this.context.authToken,
      VtexIdclientAutCookie: adminToken,
      cookie: allCookies,
      ...(sessionToken && {
        'x-vtex-session': sessionToken,
      }), // The axios client http doesn't allow undefined headers
    }
  }

  private getPersistedQuery = (
    sender = 'vtex.b2b-organizations-graphql@0.x'
  ) => {
    return {
      persistedQuery: {
        provider: 'vtex.storefront-permissions@1.x',
        sender,
      },
    }
  }

  private query = async (param: {
    query: string
    variables: any
    extensions: any
  }): Promise<any> => {
    const { query, variables, extensions } = param

    return this.graphql.query(
      {
        extensions,
        query,
        variables,
      },
      {
        headers: this.getTokenToHeader(),
        params: {
          locale: this.context.locale,
        },
      }
    )
  }
}
