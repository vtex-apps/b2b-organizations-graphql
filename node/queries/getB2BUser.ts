import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query user($id: ID!) {
    getB2BUser(id: $id) {
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
  }
`)
