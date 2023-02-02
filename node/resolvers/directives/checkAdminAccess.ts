import { SchemaDirectiveVisitor } from 'graphql-tools'
import { AuthenticationError, ForbiddenError } from '@vtex/api'
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'

export class CheckAdminAccess extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      const {
        vtex: { adminUserAuthToken, logger },
        clients: { identity },
      } = context

      let token = adminUserAuthToken

      if (context?.headers['x-vtex-credential']) {
        token = context?.headers['x-vtex-credential'] as string
      }

      if (!token) {
        throw new AuthenticationError('No token was provided')
      }

      try {
        await identity.validateToken({ token })
      } catch (err) {
        logger.warn({
          error: err,
          message: 'CheckAdminAccess: Invalid token',
          token: adminUserAuthToken,
        })
        throw new ForbiddenError('Unauthorized Access')
      }

      return resolve(root, args, context, info)
    }
  }
}
