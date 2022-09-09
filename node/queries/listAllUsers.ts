import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query users {
    listAllUsers {
      id
      orgId
      costId
      name
      email
    }
  }
`)
