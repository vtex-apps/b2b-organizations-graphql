import gql from 'graphql-tag'

export default gql`
  mutation deleteUser($id: ID!, $userId: ID, $email: String!) {
    deleteUser(id: $id, userId: $userId, email: $email) {
      id
      status
      message
    }
  }
`
