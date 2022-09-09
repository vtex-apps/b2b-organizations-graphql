import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query users(
    $organizationId: ID
    $costCenterId: ID
    $roleId: ID
    $page: Int
    $pageSize: Int
    $search: String
    $sortOrder: String
    $sortedBy: String
  ) {
    listUsersPaginated(
      organizationId: $organizationId
      costCenterId: $costCenterId
      roleId: $roleId
      page: $page
      pageSize: $pageSize
      search: $search
      sortOrder: $sortOrder
      sortedBy: $sortedBy
    ) {
      data {
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
      pagination {
        total
      }
    }
  }
`)
