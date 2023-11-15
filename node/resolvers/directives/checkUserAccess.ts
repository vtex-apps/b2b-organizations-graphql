import { AuthenticationError, ForbiddenError } from '@vtex/api'
import type { GraphQLField } from 'graphql'
import { defaultFieldResolver } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'

export async function checkUserOrAdminTokenAccess(
  ctx: Context,
  token?: string,
  operation?: string
) {
  const {
    vtex: { storeUserAuthToken, logger },
    clients: { identity, vtexId },
  } = ctx

  if (!token && !storeUserAuthToken) {
    logger.warn({
      message: `CheckUserAccess: No admin or store token was provided for ${operation}`,
      operation,
    })
    throw new AuthenticationError('No admin or store token was provided')
  }

  if (token) {
    try {
      await identity.validateToken({ token })
    } catch (err) {
      logger.warn({
        error: err,
        message: `CheckUserAccess: Invalid admin token for ${operation}`,
        operation,
        token,
      })
      throw new ForbiddenError('Unauthorized Access')
    }
  } else if (storeUserAuthToken) {
    let authUser = null

    try {
      authUser = await vtexId.getAuthenticatedUser(storeUserAuthToken)
      if (!authUser?.user) {
        logger.warn({
          message: `CheckUserAccess: No valid user found by store user token for ${operation}`,
          operation,
        })
        authUser = null
      }
    } catch (err) {
      logger.warn({
        error: err,
        message: `CheckUserAccess: Invalid store user token for ${operation}`,
        operation,
        token: storeUserAuthToken,
      })
      authUser = null
    }

    if (!authUser) {
      throw new ForbiddenError('Unauthorized Access')
    }
  }
}

export class CheckUserAccess extends SchemaDirectiveVisitor {
  public visitFieldDefinition(field: GraphQLField<any, any>) {
    const { resolve = defaultFieldResolver } = field

    field.resolve = async (
      root: any,
      args: any,
      context: Context,
      info: any
    ) => {
      const {
        vtex: { adminUserAuthToken },
        clients: { identity },
      } = context

      let token = adminUserAuthToken

      const apiToken = context?.headers['vtex-api-apptoken'] as string
      const appKey = context?.headers['vtex-api-appkey'] as string

      if (apiToken?.length && appKey?.length) {
        token = (
          await identity.getToken({ appkey: appKey, apptoken: apiToken })
        ).token
        context.cookies.set('VtexIdclientAutCookie', token)
        context.vtex.adminUserAuthToken = token
      }

      await checkUserOrAdminTokenAccess(
        context,
        token,
        field.astNode?.name?.value
      )

      return resolve(root, args, context, info)
    }
  }
}
