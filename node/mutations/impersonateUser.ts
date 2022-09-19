import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  mutation impersonateUser($userId: ID) {
    impersonateUser(userId: $userId) {
      id
      status
      message
    }
  }
`)
