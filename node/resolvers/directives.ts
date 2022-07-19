import { WithSession } from './directives/withSession'
import { WithPermissions } from './directives/withPermissions'

export const schemaDirectives = {
  withPermissions: WithPermissions as any,
  withSession: WithSession as any,
}
