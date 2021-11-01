import { WithSession } from './directives/withSession'
import { WithPermissions } from './directives/withPermissions'

export const schemaDirectives = {
  withSession: WithSession as any,
  withPermissions: WithPermissions as any,
}
