import gql from 'graphql-tag'

export default gql`
  mutation(
    $id: ID
    $userId: ID
    $roleId: ID!
    $orgId: ID!
    $costId: ID!
    $name: String!
    $canImpersonate: Boolean!
    $email: String!
  ) {
    addUser(
      id: $id
      userId: $userId
      roleId: $roleId
      orgId: $orgId
      costId: $costId
      name: $name
      canImpersonate: $canImpersonate
      email: $email
    ) {
      id
      status
      message
    }
  }
`
