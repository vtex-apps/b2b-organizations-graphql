/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { costCenterName, organizationName, role } from './fieldResolvers'
import CostCentersMutation from './Mutations/CostCenters'
import OrganizationsMutation from './Mutations/Organizations'
import SettingsMutation from './Mutations/Settings'
import UsersMutation from './Mutations/Users'
import CostCentersQuery from './Queries/CostCenters'
import OrganizationsQuery from './Queries/Organizations'
import UsersQuery from './Queries/Users'
import Routes from './Routes'

export const resolvers = {
  B2BUser: {
    costCenterName,
    organizationName,
    role,
  },
  Mutation: {
    ...CostCentersMutation,
    ...OrganizationsMutation,
    ...SettingsMutation,
    ...UsersMutation,
  },
  Query: {
    ...CostCentersQuery,
    ...OrganizationsQuery,
    ...UsersQuery,
  },
  Routes,
}
