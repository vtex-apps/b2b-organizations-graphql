import { print } from 'graphql'
import gql from 'graphql-tag'

export default print(gql`
  query organizationsPaginated($email: String!, $page: Int, $pageSize: Int) {
    getOrganizationsByEmailPaginated(
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
