import gql from 'graphql-tag'

export default gql`
  query user($id: ID!) {
    getUser(id: $id) {
      id
      roleId
      userId
      clId
      orgId
      costId
      name
      email
      canImpersonate
    }
  }
`
