import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppGraphQLClient } from '@vtex/api'

export const QUERIES = {
  getPermission: `query permissions {
    checkUserPermission {
      role {
        id
        name
        slug
      }
      permissions
    }
  }`,
  listAllUsers: `query users {
    listAllUsers {
      id
      orgId
      costId
      name
      email      
    }
  }`,
  listUsers: `query users($organizationId: ID, $costCenterId: ID, $roleId: ID) {
    listUsers(organizationId: $organizationId, costCenterId: $costCenterId, roleId: $roleId) {
      id
      roleId
      userId
      clId
      orgId
      costId
      name
      email
      canImpersonate
    }
  }`,
  listUsersPaginated: `query users($organizationId: ID, $costCenterId: ID, $roleId: ID, $page: Int, $pageSize: Int, $search: String, $sortOrder: String, $sortedBy: String) {
    listUsersPaginated(organizationId: $organizationId, costCenterId: $costCenterId, roleId: $roleId, page: $page, pageSize: $pageSize, search: $search, sortOrder: $sortOrder, sortedBy: $sortedBy) {
      data {
        id
        roleId
        userId
        clId
        orgId
        costId
        name
        email
        canImpersonate
      }
      pagination {
        total
      }
    }
  }`,
  listRoles: `query roles {
    listRoles {
      id
      name
      slug
    }
  }`,
  getUser: `query user($id: ID!) {
    getUser(id: $id) {
      id
      roleId
      userId
      clId
      orgId
      costId
      name
      email
      canImpersonate
    }
  }`,
  getRole: `query role($id: ID!) {
    getRole(id: $id) {
      id
      name
      slug
    }
  }`,
  checkImpersonation: `query checkImpersonation {
    checkImpersonation {
      firstName
      lastName
      email
      userId
      error
    }
  }`,
}

export const MUTATIONS = {
  addUser: `mutation ($id: ID $userId: ID $roleId: ID! $orgId: ID! $costId: ID! $name: String! $canImpersonate: Boolean! $email: String!) {
    addUser (id:$id, userId: $userId, roleId: $roleId, orgId: $orgId, costId: $costId, name: $name, canImpersonate: $canImpersonate, email: $email) {
      id
      status
      message
    }
  }`,

  saveUser: `mutation saveUser($id: ID, $roleId: ID!, $userId: ID, $orgId: ID, $costId: ID, $clId: ID, $canImpersonate: Boolean, $name: String!, $email: String!) {
    saveUser(id: $id, roleId: $roleId, userId: $userId, orgId: $orgId, costId: $costId, clId: $clId, canImpersonate: $canImpersonate, name: $name, email: $email) {
      id
      status
      message
    }
  }`,

  updateUser: `mutation ($id: ID $clId: ID! $userId: ID $roleId: ID! $orgId: ID! $costId: ID! $canImpersonate: Boolean!, $name: String, $email: String) {
    updateUser (id:$id, clId: $clId, userId: $userId, roleId: $roleId, orgId: $orgId, costId: $costId, canImpersonate: $canImpersonate, name: $name, email: $email) {
      id
      status
      message
    }
  }`,

  deleteUser: `mutation deleteUser($id: ID!, $userId: ID, $email: String!) {
    deleteUser(id: $id, userId: $userId, email: $email) {
      id
      status
      message
    }
  }`,
  impersonateUser: `mutation impersonateUser($userId: ID) {
      impersonateUser(userId: $userId) {
          id
          status
          message
      }
  }`,
}

export default class StorefrontPermissions extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.storefront-permissions@1.x', ctx, options)
  }

  public checkUserPermission = async (app?: string): Promise<any> => {
    return this.graphql.query(
      {
        query: QUERIES.getPermission,
        variables: {},
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: app ?? 'vtex.b2b-organizations@0.x',
          },
        },
      },
      {}
    )
  }

  public listRoles = async (): Promise<any> => {
    return this.graphql.query(
      {
        query: QUERIES.listRoles,
        variables: {},
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
      },
      {}
    )
  }

  public getRole = async (roleId: string): Promise<any> => {
    return this.graphql.query(
      {
        query: QUERIES.getRole,
        variables: { id: roleId },
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
      },
      {}
    )
  }

  public listAllUsers = async (): Promise<any> => {
    return this.graphql.query(
      {
        query: QUERIES.listAllUsers,
        variables: {},
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
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
        query: QUERIES.listUsers,
        variables: {
          roleId,
          ...(organizationId && { organizationId }),
          ...(costCenterId && { costCenterId }),
        },
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
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
        query: QUERIES.listUsersPaginated,
        variables: {
          roleId,
          page,
          pageSize,
          search,
          sortOrder,
          sortedBy,
          ...(organizationId && { organizationId }),
          ...(costCenterId && { costCenterId }),
        },
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
      },
      {}
    )
  }

  public getUser = async (userId: string): Promise<any> => {
    return this.graphql.query({
      query: QUERIES.getUser,
      variables: { id: userId },
      extensions: {
        persistedQuery: {
          provider: 'vtex.storefront-permissions@1.x',
          sender: 'vtex.b2b-organizations@0.x',
        },
      },
    })
  }

  public checkImpersonation = async (): Promise<any> => {
    return this.graphql.query(
      {
        query: QUERIES.checkImpersonation,
        variables: {},
        extensions: {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        },
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
    return this.graphql.mutate({
      mutate: MUTATIONS.addUser,
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
    })
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
    return this.graphql.mutate({
      mutate: MUTATIONS.updateUser,
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
    })
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
    return this.graphql.mutate({
      mutate: MUTATIONS.saveUser,
      variables: {
        id,
        roleId,
        userId,
        orgId,
        costId,
        clId,
        name,
        email,
        canImpersonate: false,
      },
    })
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
    return this.graphql.mutate({
      mutate: MUTATIONS.deleteUser,
      variables: {
        id,
        userId,
        email,
      },
    })
  }

  public impersonateUser = async ({
    userId,
  }: {
    userId?: string
  }): Promise<any> => {
    return this.graphql.mutate(
      {
        mutate: MUTATIONS.impersonateUser,
        variables: {
          userId,
        },
      },
      {
        params: {
          locale: this.context.locale,
        },
        headers: {
          ...(this.context.sessionToken && {
            sessionToken: this.context.sessionToken,
          }),
        },
      }
    )
  }
}
