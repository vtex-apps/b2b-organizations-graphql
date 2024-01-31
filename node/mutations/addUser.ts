import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  mutation (
    $id: ID
    $userId: ID
    $roleId: ID!
    $orgId: ID!
    $costId: ID!
    $canImpersonate: Boolean!
    $name: String!
    $email: String!
    $isCorporate: Boolean
    $corporateName: String
    $corporateDocument: String
    $tradeName: String
  ) {
    addUser(
      id: $id
      userId: $userId
      roleId: $roleId
      orgId: $orgId
      costId: $costId
      canImpersonate: $canImpersonate
      name: $name
      email: $email
      isCorporate: $isCorporate
      corporateName: $corporateName
      corporateDocument: $corporateDocument
      tradeName: $tradeName
    ) {
      id
      status
      message
    }
  }
`)
