import { MessageSFPUserAddError, StatusAddUserError } from '../../constants'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import type { ImpersonateMetricParams } from '../../utils/metrics/impersonate'
import {
  sendImpersonateB2BUserMetric,
  sendImpersonateUserMetric,
} from '../../utils/metrics/impersonate'
import {
  sendAddUserMetric,
  sendRemoveUserMetric,
  sendUpdateUserMetric,
} from '../../utils/metrics/user'
import type { UserArgs } from '../../typings'

export const getUserRoleSlug: (
  id: string,
  ctx: Context
) => Promise<string> = async (id, ctx) => {
  const {
    clients: { storefrontPermissions },
    vtex: { logger },
  } = ctx

  return storefrontPermissions
    .getUser(id)
    .then((result: any) => {
      return result.data.getUser
    })
    .then((userData: any) => {
      return storefrontPermissions.getRole(userData.roleId)
    })
    .then((result: any) => {
      return result?.data?.getRole?.slug ?? ''
    })
    .catch((error: any) => {
      logger.warn({
        error,
        message: 'getUserRoleSlug-error',
      })

      return ''
    })
}

const isUserPermitted = ({
  storefrontPermissions,
  sessionData,
  orgId,
  roleSlug,
}: any) =>
  (storefrontPermissions?.permissions?.includes('add-users-organization') &&
    sessionData.namespaces['storefront-permissions']?.organization?.value ===
      orgId &&
    !roleSlug.includes('sales')) ||
  (storefrontPermissions?.permissions?.includes('add-sales-users-all') &&
    roleSlug.includes('sales'))

const getRoleSlug = async ({
  clId,
  ctx,
  logger,
  roleId,
  storefrontPermissionsClient,
}: any) =>
  clId
    ? getUserRoleSlug(clId, ctx)
    : storefrontPermissionsClient
        .getRole(roleId)
        .then((result: any) => {
          return result?.data?.getRole?.slug ?? ''
        })
        .catch((error: any) => {
          logger.warn({
            error,
            message: 'saveUser-getRoleError',
          })

          return ''
        })

const getUser = async ({ masterdata, logger, userId, clId }: any) =>
  (await masterdata
    .getDocument({
      dataEntity: 'CL',
      fields: ['userId'],
      id: clId,
    })
    .then((res: any) => {
      return res?.userId ?? undefined
    })
    .catch((error: any) => {
      logger.error({
        error,
        message: 'saveUser-getDocumentError',
      })

      return error
    })) ?? userId

const checkUserIsAllowed = async ({
  adminUserAuthToken,
  clId,
  ctx,
  logger,
  orgId,
  roleId,
  sessionData,
  storefrontPermissionsClient,
  storefrontPermissions,
}: any) => {
  if (!adminUserAuthToken) {
    if (!sessionData?.namespaces['storefront-permissions']?.organization) {
      throw new GraphQLError('organization-data-not-found')
    }

    const roleSlug = await getRoleSlug({
      clId,
      ctx,
      logger,
      roleId,
      storefrontPermissionsClient,
    })

    const permitted = isUserPermitted({
      orgId,
      roleSlug,
      sessionData,
      storefrontPermissions,
    })

    if (!permitted) {
      throw new GraphQLError('operation-not-permitted')
    }
  }
}

const getUserFromStorefrontPermissions = ({
  clId: clientId,
  storefrontPermissionsClient,
  logger,
}: {
  clId: string
  storefrontPermissionsClient: any
  logger: any
}) =>
  storefrontPermissionsClient
    .getUser(clientId)
    .then((result: any) => {
      return result?.data?.getUser ?? {}
    })
    .catch((error: any) => {
      logger.warn({
        error,
        message: 'impersonateUser-getUserError',
      })

      return error
    })

const Users = {
  impersonateB2BUser: async (_: void, { id }: { id: string }, ctx: Context) => {
    const {
      clients: { storefrontPermissions: storefrontPermissionsClient },

      vtex: { adminUserAuthToken, logger, sessionData, storefrontPermissions },
    } = ctx as Context | any

    const getB2BUserFromStorefrontPermissions = ({
      id: b2bId,
    }: {
      id: string
    }) =>
      storefrontPermissionsClient
        .getB2BUser(b2bId)
        .then((result: any) => result?.data?.getB2BUser ?? {})

    const user = await getB2BUserFromStorefrontPermissions({ id })

    if (!adminUserAuthToken) {
      if (!sessionData?.namespaces['storefront-permissions']?.organization) {
        throw new GraphQLError('organization-data-not-found')
      }

      const canImpersonateUsersWithCostCenterPermission =
        storefrontPermissions?.permissions?.includes(
          'impersonate-users-costcenter'
        ) &&
        user?.costId ===
          sessionData?.namespaces['storefront-permissions']?.costcenter?.value

      const canImpersonateUsersWithOrganizationPermission =
        storefrontPermissions?.permissions?.includes(
          'impersonate-users-organization'
        ) &&
        user?.orgId ===
          sessionData?.namespaces['storefront-permissions']?.organization?.value

      const canImpersonateUsersWithAllPermission =
        storefrontPermissions?.permissions?.includes('impersonate-users-all')

      if (
        !canImpersonateUsersWithCostCenterPermission &&
        !canImpersonateUsersWithOrganizationPermission &&
        !canImpersonateUsersWithAllPermission
      ) {
        throw new GraphQLError('operation-not-permitted')
      }
    }

    const impersonation = await storefrontPermissionsClient
      .impersonateUser({ userId: id })
      .catch((error: any) => {
        logger.error({
          error,
          message: 'impersonateUser-impersonateUserError',
        })

        return { status: 'error', message: error }
      })

    if (impersonation?.errors) {
      throw new GraphQLError(impersonation?.errors)
    }

    const {
      orgId: targetOrganizationId,
      costId: targetCostCenterId,
      id: targetId,
      email: targetEmail,
    } = user

    const metricParams: ImpersonateMetricParams = {
      account: sessionData?.namespaces?.account?.accountName,
      target: {
        costCenterId: targetCostCenterId,
        organizationId: targetOrganizationId,
        email: targetEmail,
        id: targetId,
      },
      user: {
        costCenterId:
          sessionData?.namespaces['storefront-permissions']?.costcenter.value,
        organizationId:
          sessionData?.namespaces['storefront-permissions']?.organization.value,
        email: sessionData?.namespaces?.profile?.email.value,
        id: sessionData?.namespaces['storefront-permissions']?.userId.value,
      },
    }

    sendImpersonateB2BUserMetric(ctx, metricParams)

    return (
      impersonation?.data?.impersonateUser ?? {
        status: 'error',
      }
    )
  },
  /**
   *
   * Mutation to impersonate a user
   *
   * @param _
   * @param clId
   * @param userId
   * @param ctx
   */
  impersonateUser: async (
    _: void,
    { clId, userId }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: {
        masterdata,
        storefrontPermissions: storefrontPermissionsClient,
      },

      vtex: { adminUserAuthToken, logger, sessionData, storefrontPermissions },
    } = ctx as Context | any

    if (!adminUserAuthToken && clId) {
      if (!sessionData?.namespaces['storefront-permissions']?.organization) {
        throw new GraphQLError('organization-data-not-found')
      }

      const userInfo = await getUserFromStorefrontPermissions({
        clId,
        logger,
        storefrontPermissionsClient,
      })

      const canImpersonateUsersWithCostCenterPermission =
        storefrontPermissions?.permissions?.includes(
          'impersonate-users-costcenter'
        ) &&
        userInfo?.costId ===
          sessionData?.namespaces['storefront-permissions']?.costcenter?.value

      const canImpersonateUsersWithOrganizationPermission =
        storefrontPermissions?.permissions?.includes(
          'impersonate-users-organization'
        ) &&
        userInfo?.orgId ===
          sessionData?.namespaces['storefront-permissions']?.organization?.value

      const canImpersonateUsersWithAllPermission =
        storefrontPermissions?.permissions?.includes('impersonate-users-all')

      if (
        !canImpersonateUsersWithCostCenterPermission &&
        !canImpersonateUsersWithOrganizationPermission &&
        !canImpersonateUsersWithAllPermission
      ) {
        throw new GraphQLError('operation-not-permitted')
      }
    }

    if (!userId && clId) {
      const userIdFromCl = await masterdata
        .getDocument({
          dataEntity: 'CL',
          fields: ['userId'],
          id: clId,
        })
        .then((res: any) => {
          return res?.userId ?? undefined
        })
        .catch((error: any) => {
          logger.warn({
            error,
            message: 'impersonateUser-getUserIdError',
          })

          return error
        })

      if (!userIdFromCl) {
        logger.warn({
          message: `userId ${userIdFromCl} not found in CL`,
        })

        return { status: 'error', message: 'userId not found in CL' }
      }

      userId = userIdFromCl

      const userData = await getUserFromStorefrontPermissions({
        clId,
        logger,
        storefrontPermissionsClient,
      })

      if (userData && !userData.userId) {
        await storefrontPermissionsClient.saveUser({
          ...userData,
          userId,
        })
      }
    }

    return impersonateUser(
      ctx,
      storefrontPermissionsClient,
      userId,
      logger,
      sessionData?.namespaces?.account?.accountName,
      sessionData?.namespaces['storefront-permissions']
    )
  },

  removeUserWithEmail: async (
    _: void,
    { orgId, costId, email }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: { events, storefrontPermissions: storefrontPermissionsClient },
      vtex: { logger },
    } = ctx as any

    return storefrontPermissionsClient
      .getUsersByEmail(email, orgId, costId)
      .then((result: any) => {
        const user = result.data.getUsersByEmail[0]

        if (!user) {
          logger.error({ message: 'User not found' })
          return { status: 'error', message: 'User not found' }
        }

        const { id } = user
        const { userId } = user

        const fields = {
          email,
          id,
          userId,
        }

        return storefrontPermissionsClient
          .deleteUser(fields)
          .then((response: any) => {
            events.sendEvent('', 'b2b-organizations-graphql.removeUser', {
              id,
              email,
            })
            sendRemoveUserMetric(ctx, logger, ctx.vtex.account, fields)

            return response.data.deleteUser
          })
          .catch((error: any) => {
            logger.error({
              error,
              message: 'removeUser-deleteUserError',
            })

            return { status: 'error', message: error }
          })
      })
      .catch((error: any) => {
        logger.error({
          error,
          message: 'getUsers-error',
        })
        throw new GraphQLError(getErrorMessage(error))
      })
  },

  /**
   *
   * Mutation to remove a user
   *
   * @param _
   * @param id
   * @param userId
   * @param email
   * @param clId
   * @param ctx
   */
  removeUser: async (
    _: void,
    { id, userId, email, clId }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: { events, storefrontPermissions: storefrontPermissionsClient },
      vtex: { adminUserAuthToken, logger, sessionData, storefrontPermissions },
    } = ctx as Context | any

    if (!id || !clId || !email) {
      throw new GraphQLError('user-information-not-provided')
    }

    if (!adminUserAuthToken) {
      if (!sessionData?.namespaces['storefront-permissions']?.organization) {
        throw new GraphQLError('organization-data-not-found')
      }

      const roleSlug = await getUserRoleSlug(clId, ctx)

      const permitted =
        (storefrontPermissions?.permissions?.includes(
          'remove-users-organization'
        ) &&
          !roleSlug.includes('sales')) ||
        storefrontPermissions?.permissions?.includes('remove-sales-users-all')

      if (!permitted) {
        throw new GraphQLError('operation-not-permitted')
      }
    }

    const fields = {
      email,
      id,
      userId,
    }

    return storefrontPermissionsClient
      .deleteUser(fields)
      .then((result: any) => {
        events.sendEvent('', 'b2b-organizations-graphql.removeUser', {
          id,
          email,
        })

        sendRemoveUserMetric(ctx, logger, ctx.vtex.account, fields)

        return result.data.deleteUser
      })
      .catch((error: any) => {
        logger.error({
          error,
          message: 'removeUser-deleteUserError',
        })

        return { status: 'error', message: error }
      })
  },

  addUser: async (
    _: void,
    { id, roleId, userId, orgId, costId, clId, name, email }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions: storefrontPermissionsClient },
      vtex: { adminUserAuthToken, logger, sessionData, storefrontPermissions },
    } = ctx as any

    try {
      await checkUserIsAllowed({
        adminUserAuthToken,
        clId,
        ctx,
        logger,
        orgId,
        roleId,
        sessionData,
        storefrontPermissions,
        storefrontPermissionsClient,
      })
    } catch (error) {
      logger.error({
        error,
        message: 'addUser-checkUserIsAllowedError',
      })
      throw error
    }

    const fields = {
      costId,
      email,
      id,
      name,
      orgId,
      roleId,
      userId,
    }

    return storefrontPermissionsClient
      .addUser(fields)
      .then((result: any) => {
        sendAddUserMetric(ctx, logger, ctx.vtex.account, fields)

        return result.data.addUser
      })
      .catch((error: any) => {
        logger.error({
          error,
          message: 'addUser-error',
        })

        const message = error.graphQLErrors[0]?.message ?? error.message
        let status = ''

        if (message.includes(MessageSFPUserAddError.DUPLICATED)) {
          status = StatusAddUserError.DUPLICATED
        } else if (
          message.includes(MessageSFPUserAddError.DUPLICATED_ORGANIZATION)
        ) {
          status = StatusAddUserError.DUPLICATED_ORGANIZATION
        } else {
          status = StatusAddUserError.ERROR
        }

        return { status, message }
      })
  },

  createUserWithEmail: async (
    _: void,
    { orgId, costId, roleId, name, email, canImpersonate }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions: storefrontPermissionsClient },
      vtex: { logger },
    } = ctx as any

    try {
      const result = await storefrontPermissionsClient.addUser({
        orgId,
        costId,
        roleId,
        name,
        email,
        canImpersonate,
      })

      return result.data.addUser
    } catch (error) {
      logger.error({
        error,
        message: 'createUserWithEmail-error',
      })
      const message = error.graphQLErrors?.[0]?.message ?? error.message
      let status = ''

      if (message.includes(MessageSFPUserAddError.DUPLICATED)) {
        status = StatusAddUserError.DUPLICATED
      } else if (
        message.includes(MessageSFPUserAddError.DUPLICATED_ORGANIZATION)
      ) {
        status = StatusAddUserError.DUPLICATED_ORGANIZATION
      } else {
        status = StatusAddUserError.ERROR
      }

      return { status, message }
    }
  },

  updateUser: async (
    _: void,
    { id, roleId, userId, orgId, costId, clId, name, email }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: {
        masterdata,
        storefrontPermissions: storefrontPermissionsClient,
      },
      vtex: { adminUserAuthToken, logger, sessionData, storefrontPermissions },
    } = ctx as any

    try {
      await checkUserIsAllowed({
        adminUserAuthToken,
        clId,
        ctx,
        logger,
        orgId,
        roleId,
        sessionData,
        storefrontPermissions,
        storefrontPermissionsClient,
      })
    } catch (error) {
      logger.error({
        error,
        message: 'addUser-checkUserIsAllowedError',
      })
      throw error
    }

    if (clId && !userId) {
      userId = await getUser({
        clId,
        logger,
        masterdata,
        userId,
      })
    }

    const fields = {
      clId,
      costId,
      email,
      id,
      name,
      orgId,
      roleId,
      userId,
    }

    return storefrontPermissionsClient
      .updateUser(fields)
      .then((result: any) => {
        sendUpdateUserMetric(ctx, logger, ctx.vtex.account, fields)

        return result.data.updateUser
      })
      .catch((error: any) => {
        logger.error({
          error,
          message: 'updateUser-error',
        })

        return { status: 'error', message: error }
      })
  },

  /**
   *
   * Create and update a user
   *
   * @deprecated
   *
   * @param _
   * @param id
   * @param roleId
   * @param userId
   * @param orgId
   * @param costId
   * @param clId
   * @param name
   * @param email
   * @param ctx
   */
  saveUser: async (
    _: void,
    { id, roleId, userId, orgId, costId, clId, name, email }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: {
        masterdata,
        storefrontPermissions: storefrontPermissionsClient,
      },
      vtex: { adminUserAuthToken, logger, sessionData, storefrontPermissions },
    } = ctx as any

    try {
      await checkUserIsAllowed({
        adminUserAuthToken,
        clId,
        ctx,
        logger,
        orgId,
        roleId,
        sessionData,
        storefrontPermissions,
        storefrontPermissionsClient,
      })
    } catch (error) {
      logger.error({
        error,
        message: 'addUser-checkUserIsAllowedError',
      })
      throw error
    }

    if (clId && !userId) {
      userId = await getUser({
        clId,
        logger,
        masterdata,
        userId,
      })
    }

    return storefrontPermissionsClient
      .saveUser({
        clId,
        costId,
        email,
        id,
        name,
        orgId,
        roleId,
        userId,
      })
      .then((result: any) => {
        return result.data.saveUser
      })
      .catch((error: any) => {
        logger.error({
          error,
          message: 'addUser-error',
        })

        return { status: 'error', message: error }
      })
  },
}

export default Users

async function impersonateUser(
  ctx: Context,
  storefrontPermissionsClient: any,
  userId: string | undefined,
  logger: any,
  accountName: string,
  storefrontPermissions: {
    costcenter: { value: string }
    userId: { value: string }
    organization: { value: string }
    storeUserEmail: { value: string }
  }
) {
  return storefrontPermissionsClient
    .impersonateUser({ userId })
    .then((_: any) => {
      const {
        costcenter,
        userId: userTargetId,
        organization,
        storeUserEmail,
      } = storefrontPermissions

      const metricParams: ImpersonateMetricParams = {
        account: accountName,
        target: {
          costCenterId: costcenter.value,
          organizationId: organization.value,
          email: storeUserEmail.value,
          id: userTargetId.value,
        },
        user: undefined, // no information about original user at this point
      }

      sendImpersonateUserMetric(ctx, metricParams)
    })
    .catch((error: any) => {
      logger.error({
        error,
        message: 'impersonateUser-impersonateUserError',
      })

      return { status: 'error', message: error }
    })
}
