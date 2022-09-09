import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query organizations($email: String!) {
    getOrganizationsByEmail(email: $email) {
      costId
      orgId
      roleId
      id
      clId
    }
  }
`)
