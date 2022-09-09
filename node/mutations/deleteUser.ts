import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  mutation deleteUser($id: ID!, $userId: ID, $email: String!) {
    deleteUser(id: $id, userId: $userId, email: $email) {
      id
      status
      message
    }
  }
`)
