import { WithSession } from './directives/withSession'
import { WithPermissions } from './directives/withPermissions'
import { CheckAdminAccess } from './directives/checkAdminAccess'
import { CheckUserAccess } from './directives/checkUserAccess'
import { AuditAccess } from './directives/auditAccess'

export const schemaDirectives = {
  checkAdminAccess: CheckAdminAccess as any,
  checkUserAccess: CheckUserAccess as any,
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
  auditAccess: AuditAccess as any,
}
