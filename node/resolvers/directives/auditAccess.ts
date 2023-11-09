import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

import sendAuthMetric, { AuthMetric } from '../../utils/metrics/auth'

export class AuditAccess extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      this.sendAuthMetric(field, context)

      return resolve(root, args, context, info)
    }
  }

  private async sendAuthMetric(field: GraphQLField<any, any>, context: any) {
    const {
      vtex: { adminUserAuthToken, storeUserAuthToken, account, logger },
      request,
    } = context

    const operation = field.astNode?.name?.value ?? request.url
    const forwardedHost = request.headers['x-forwarded-host'] as string
    const caller =
      context?.graphql?.query?.senderApp ??
      context?.graphql?.query?.extensions?.persistedQuery?.sender ??
      request.header['x-b2b-senderapp'] ??
      (request.headers['x-vtex-caller'] as string)

    const hasAdminToken = !!(
      adminUserAuthToken ?? (context?.headers.vtexidclientautcookie as string)
    )

    const hasStoreToken = !!storeUserAuthToken
    const hasApiToken = !!request.headers['vtex-api-apptoken']

    const authMetric = new AuthMetric(account, {
      caller,
      forwardedHost,
      hasAdminToken,
      hasApiToken,
      hasStoreToken,
      operation,
    })

    await sendAuthMetric(logger, authMetric)
  }
}
