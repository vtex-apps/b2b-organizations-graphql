/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-params */
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import { describeClientError } from '../../utils/clientError'

export class WithSession extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (root: any, args: any, context: any, info: any) => {
      const {
        clients: { session },
        vtex: { logger, sessionToken },
      } = context

      // Fail-closed: without a session the resolver denies (and logs
      // `auth.denied`). Always warn, even on 5xx (SDD Q3, B2BTEAM-3985).
      context.vtex.sessionData = await session
        .getSession(sessionToken as string, ['*'])
        .then((currentSession: any) => {
          return currentSession.sessionData
        })
        .catch((error: any) => {
          logger.warn({
            error: describeClientError(error),
            message: 'withSession.getSessionError',
            operation: info?.fieldName,
          })

          return null
        })

      return resolve(root, args, context, info)
    }
  }
}
