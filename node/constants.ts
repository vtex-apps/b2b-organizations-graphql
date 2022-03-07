export const QUERIES = {
  getPermission: `query permissions {
      checkUserPermission @context(provider: "vtex.storefront-permissions"){
        role {
          id
          name
          slug
        }
        permissions
      }
    }`,
  listUsers: `query users($organizationId: ID, $costCenterId: ID, $roleId: ID) {
      listUsers(organizationId: $organizationId, costCenterId: $costCenterId, roleId: $roleId) @context(provider: "vtex.storefront-permissions") {
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
  listRoles: `query roles {
      listRoles @context(provider: "vtex.storefront-permissions") {
        id
        name
        slug
      }
    }`,
  getUser: `query user($id: ID!) {
      getUser(id: $id) @context(provider: "vtex.storefront-permissions") {
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
      getRole(id: $id) @context(provider: "vtex.storefront-permissions") {
        id
        name
        slug
      }
    }`,
  checkImpersonation: `query checkImpersonation {
      checkImpersonation @context(provider: "vtex.storefront-permissions") {
        firstName
        lastName
        email
        userId
        error
      }
    }`,
}

export const MUTATIONS = {
  saveUser: `mutation saveUser($id: ID, $roleId: ID!, $userId: ID, $orgId: ID, $costId: ID, $clId: ID, $canImpersonate: Boolean, $name: String!, $email: String!) {
      saveUser(id: $id, roleId: $roleId, userId: $userId, orgId: $orgId, costId: $costId, clId: $clId, canImpersonate: $canImpersonate, name: $name, email: $email) @context(provider: "vtex.storefront-permissions") {
        id
        status
        message
      }
    }`,
  deleteUser: `mutation deleteUser($id: ID!, $userId: ID, $email: String!) {
      deleteUser(id: $id, userId: $userId, email: $email) @context(provider: "vtex.storefront-permissions") {
        id
        status
        message
      }
    }`,
  impersonateUser: `mutation impersonateUser($userId: ID) {
        impersonateUser(userId: $userId) @context(provider: "vtex.storefront-permissions") {
            id
            status
            message
        }
    }`,
}

export const CONNECTOR = {
  PROMISSORY: 'Vtex.PaymentGateway.Connectors.PromissoryConnector',
} as const
