/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { costCenterName, organizationName, role } from './fieldResolvers'
import Mutation from './Mutations'
import Query from './Queries'
import Routes from './Routes'

export const resolvers = {
  B2BUser: {
    costCenterName,
    organizationName,
    role,
  },
  Mutation,
  Query,
  Routes,
}
