import { WithSession } from './directives/withSession'
import { WithPermissions } from './directives/withPermissions'
import { CheckAdminAccess } from './directives/checkAdminAccess'
import { CheckUserAccess } from './directives/checkUserAccess'

export const schemaDirectives = {
  checkAdminAccess: CheckAdminAccess as any,
  checkUserAccess: CheckUserAccess as any,
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
}
