import gql from 'graphql-tag'

export default gql`
  mutation(
    $id: ID
    $clId: ID!
    $userId: ID
    $roleId: ID!
    $orgId: ID!
    $costId: ID!
    $canImpersonate: Boolean!
    $name: String
    $email: String
  ) {
    updateUser(
      id: $id
      clId: $clId
      userId: $userId
      roleId: $roleId
      orgId: $orgId
      costId: $costId
      canImpersonate: $canImpersonate
      name: $name
      email: $email
    ) {
      id
      status
      message
    }
  }
`
