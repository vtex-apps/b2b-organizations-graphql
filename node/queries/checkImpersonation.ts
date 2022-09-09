import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query checkImpersonation {
    checkImpersonation {
      firstName
      lastName
      email
      userId
      error
    }
  }
`)
