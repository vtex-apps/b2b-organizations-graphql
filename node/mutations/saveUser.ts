import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  mutation saveUser(
    $id: ID
    $roleId: ID!
    $userId: ID
    $orgId: ID
    $costId: ID
    $clId: ID
    $canImpersonate: Boolean
    $name: String!
    $email: String!
  ) {
    saveUser(
      id: $id
      roleId: $roleId
      userId: $userId
      orgId: $orgId
      costId: $costId
      clId: $clId
      canImpersonate: $canImpersonate
      name: $name
      email: $email
    ) {
      id
      status
      message
    }
  }
`)
