import gql from 'graphql-tag'

export default gql`
  query permissions {
    checkUserPermission {
      role {
        id
        name
        slug
      }
      permissions
    }
  }
`
