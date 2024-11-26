import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query OrganizationsPaginated($email: String!, $page: Int, $pageSize: Int) {
    getOrganizationsPaginatedByEmail(
      email: $email
      page: $page
      pageSize: $pageSize
    ) {
      data {
        costId
        orgId
        roleId
        id
        clId
      }
      pagination {
        page
        pageSize
        total
      }
    }
  }
`)
