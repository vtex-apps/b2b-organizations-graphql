import gql from 'graphql-tag'

export default gql`
  query users {
    listAllUsers {
      id
      orgId
      costId
      name
      email
    }
  }
`
