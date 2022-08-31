import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query role($id: ID!) {
    getRole(id: $id) {
      id
      name
      slug
    }
  }
`)
