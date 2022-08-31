import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppGraphQLClient } from '@vtex/api'

import addUser from '../mutations/addUser'
import deleteUser from '../mutations/deleteUser'
import impersonateUser from '../mutations/impersonateUser'
import saveUser from '../mutations/saveUser'
import updateUser from '../mutations/updateUser'
import checkImpersonation from '../queries/checkImpersonation'
import getPermission from '../queries/getPermission'
import getRole from '../queries/getRole'
import getUser from '../queries/getUser'
import listAllUsers from '../queries/listAllUsers'
import listRoles from '../queries/listRoles'
import listUsers from '../queries/listUsers'
import listUsersPaginated from '../queries/listUsersPaginated'
import getOrganizationsByEmail from '../queries/getOrganizationsByEmail'

export default class StorefrontPermissions extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.storefront-permissions@1.x', ctx, options)
  }

  public checkUserPermission = async (app?: string): Promise<any> => {
    return this.graphql.query(
      {
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: app ?? 'vtex.b2b-organizations@0.x',
          },
        },
        query: getPermission.toString(),
        variables: {},
      },
      {}
    )
  }

  public getOrganizationsByEmail = async (email: string): Promise<any> => {
    return this.graphql.query({
      extensions: {
        persistedQuery: {
          provider: 'vtex.storefront-permissions@1.x',
          sender: 'vtex.b2b-organizations@0.x',
        },
      },
      query: getOrganizationsByEmail,
      variables: {
        email,
      },
    })
  }

  public listRoles = async (): Promise<any> => {
    return this.graphql.query(
      {
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
        query: listRoles.toString(),
        variables: {},
      },
      {}
    )
  }

  public getRole = async (roleId: string): Promise<any> => {
    return this.graphql.query(
      {
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
        query: getRole.toString(),
        variables: { id: roleId },
      },
      {}
    )
  }

  public listAllUsers = async (): Promise<any> => {
    return this.graphql.query(
      {
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
        query: listAllUsers.toString(),
        variables: {},
      },
      {}
    )
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
    return this.graphql.query(
      {
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
        query: listUsers.toString(),
        variables: {
          roleId,
          ...(organizationId && { organizationId }),
          ...(costCenterId && { costCenterId }),
        },
      },
      {}
    )
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
    return this.graphql.query(
      {
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
        query: listUsersPaginated.toString(),
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
      },
      {}
    )
  }

  public getUser = async (userId: string): Promise<any> => {
    return this.graphql.query({
      extensions: {
        persistedQuery: {
          provider: 'vtex.storefront-permissions@1.x',
          sender: 'vtex.b2b-organizations@0.x',
        },
      },
      query: getUser.toString(),
      variables: { id: userId },
    })
  }

  public checkImpersonation = async (): Promise<any> => {
    return this.graphql.query(
      {
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
        query: checkImpersonation.toString(),
        variables: {},
      },
      {}
    )
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
        mutate: addUser.toString(),
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
        headers: {
          ...(this.context.authToken && {
            cookie: `VtexIdclientAutCookie=${this.context.authToken}`,
          }),
        },
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
        mutate: updateUser.toString(),
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
        headers: {
          ...(this.context.authToken && {
            cookie: `VtexIdclientAutCookie=${this.context.authToken}`,
          }),
        },
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
        mutate: saveUser.toString(),
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
        headers: {
          ...(this.context.authToken && {
            cookie: `VtexIdclientAutCookie=${this.context.authToken}`,
          }),
        },
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
        mutate: deleteUser.toString(),
        variables: {
          email,
          id,
          userId,
        },
      },
      {
        headers: {
          ...(this.context.authToken && {
            cookie: `VtexIdclientAutCookie=${this.context.authToken}`,
          }),
        },
      }
    )
  }

  public impersonateUser = async ({
    userId,
  }: {
    userId?: string
  }): Promise<any> => {
    return this.graphql.mutate(
      {
        mutate: impersonateUser.toString(),
        variables: {
          userId,
        },
      },
      {
        headers: {
          ...(this.context.sessionToken && {
            sessionToken: this.context.sessionToken,
          }),
        },
        params: {
          locale: this.context.locale,
        },
      }
    )
  }
}
