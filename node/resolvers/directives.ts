import { WithSession } from './directives/withSession'
import { WithPermissions } from './directives/withPermissions'
import { ValidateAdminUserAccess } from './directives/validateAdminUserAccess'
import { ValidateAdminUserEditAccess } from './directives/validateAdminUserEditAccess'
import { ValidateStoreUserAccess } from './directives/validateStoreUserAccess'
import { AuditAccess } from './directives/auditAccess'

export const schemaDirectives = {
  validateAdminUserAccess: ValidateAdminUserAccess as any,
  validateAdminUserEditAccess: ValidateAdminUserEditAccess as any,
  validateStoreUserAccess: ValidateStoreUserAccess as any,
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
  auditAccess: AuditAccess as any,
}
