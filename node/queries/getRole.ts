import gql from 'graphql-tag'

export default gql`
  query role($id: ID!) {
    getRole(id: $id) {
      id
      name
      slug
    }
  }
`
