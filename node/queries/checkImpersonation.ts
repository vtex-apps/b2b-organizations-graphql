import gql from 'graphql-tag'

export default gql`
  query checkImpersonation {
    checkImpersonation {
      firstName
      lastName
      email
      userId
      error
    }
  }
`
