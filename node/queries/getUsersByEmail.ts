import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query getUsersByEmail($orgId: ID, $costId: ID, $email: String!) {
    getUsersByEmail(orgId: $orgId, costId: $costId, email: $email) {
      id
      roleId
      userId
      orgId
      costId
      name
      email
    }
  }
`)
