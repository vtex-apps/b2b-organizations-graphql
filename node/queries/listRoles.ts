import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query roles {
    listRoles {
      id
      name
      slug
    }
  }
`)
