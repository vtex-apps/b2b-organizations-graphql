import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
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
`)
