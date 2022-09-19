import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query users($organizationId: ID, $costCenterId: ID, $roleId: ID) {
    listUsers(
      organizationId: $organizationId
      costCenterId: $costCenterId
      roleId: $roleId
    ) {
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
`)
