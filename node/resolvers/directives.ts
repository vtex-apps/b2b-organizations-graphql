import { AuditAccess } from './directives/auditAccess'
import { CheckAccessWithFeatureFlag } from './directives/checkAccessWithFeatureFlag'
import { CheckAdminAccess } from './directives/checkAdminAccess'
import { CheckUserAccess } from './directives/checkUserAccess'
import { WithPermissions } from './directives/withPermissions'
import { WithSession } from './directives/withSession'

export const schemaDirectives = {
  auditAccess: AuditAccess as any,
  checkAccessWithFeatureFlag: CheckAccessWithFeatureFlag as any,
  checkAdminAccess: CheckAdminAccess as any,
  checkUserAccess: CheckUserAccess as any,
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
}
