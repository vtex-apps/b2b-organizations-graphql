import gql from 'graphql-tag'

export default gql`
  mutation impersonateUser($userId: ID) {
    impersonateUser(userId: $userId) {
      id
      status
      message
    }
  }
`
