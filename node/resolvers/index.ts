/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  costCenterName,
  organizationName,
  organizationStatus,
  role,
} from './fieldResolvers'
import CostCentersMutation from './Mutations/CostCenters'
import MarketingTagsMutation from './Mutations/MarketingTags'
import OrganizationsMutation from './Mutations/Organizations'
import SettingsMutation from './Mutations/Settings'
import UsersMutation from './Mutations/Users'
import CostCentersQuery from './Queries/CostCenters'
import MarketingTagsQuery from './Queries/MarketingTags'
import OrganizationsQuery from './Queries/Organizations'
import SettingsQuery from './Queries/Settings'
import UsersQuery from './Queries/Users'
import Routes from './Routes'

export const resolvers = {
  B2BOrganization: {
    costCenterName,
    organizationName,
    organizationStatus,
    role,
  },
  B2BUser: {
    costCenterName,
    organizationName,
    role,
  },
  Mutation: {
    ...CostCentersMutation,
    ...MarketingTagsMutation,
    ...OrganizationsMutation,
    ...SettingsMutation,
    ...UsersMutation,
  },
  Query: {
    ...CostCentersQuery,
    ...MarketingTagsQuery,
    ...OrganizationsQuery,
    ...SettingsQuery,
    ...UsersQuery,
  },
  Routes,
}
