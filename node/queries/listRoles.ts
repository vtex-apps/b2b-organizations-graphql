import gql from 'graphql-tag'

export default gql`
  query roles {
    listRoles {
      id
      name
      slug
    }
  }
`
