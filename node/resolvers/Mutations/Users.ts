import { MessageSFPUserAddError, StatusAddUserError } from '../../constants'
import GraphQLError, { getErrorMessage } from '../../utils/GraphQLError'
import { describeClientError } from '../../utils/clientError'
import { sendMutationAudit } from '../../utils/sendMutationAudit'
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
import {
  accessLookupFailedError,
  authDenied,
  isAccessErrorLogged,
  logAccessError,
  logAccessLookupFailed,
} from '../../utils/authDenied'

/**
 * The role slug that decides access. A failed lookup still falls back to ''
 * (so the permission decision is the same as before), but the failure is
 * returned to the caller: it is an infrastructure error, not a deny.
 */
interface RoleLookup {
  roleSlug: string
  lookupError?: unknown
}

export const getUserRoleSlug: (
  id: string,
  ctx: Context
) => Promise<RoleLookup> = async (id, ctx) => {
  const {
    clients: { storefrontPermissions },
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
      return { roleSlug: result?.data?.getRole?.slug ?? '' }
    })
    .catch((lookupError: any) => ({ lookupError, roleSlug: '' }))
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
  roleId,
  storefrontPermissionsClient,
}: any): Promise<RoleLookup> =>
  clId
    ? getUserRoleSlug(clId, ctx)
    : storefrontPermissionsClient
        .getRole(roleId)
        .then((result: any) => {
          return { roleSlug: result?.data?.getRole?.slug ?? '' }
        })
        .catch((lookupError: any) => ({ lookupError, roleSlug: '' }))

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
        message: 'saveUser.error',
        error: describeClientError(error),
        operation: 'saveUser',
        entity: 'User',
      })

      return error
    })) ?? userId

const checkUserIsAllowed = async ({
  adminUserAuthToken,
  clId,
  ctx,
  logger,
  operation,
  orgId,
  roleId,
  sessionData,
  storefrontPermissionsClient,
  storefrontPermissions,
}: any) => {
  if (!adminUserAuthToken) {
    if (!sessionData?.namespaces['storefront-permissions']?.organization) {
      throw authDenied(logger, {
        operation,
        orgId,
        reason: 'organization-data-not-found',
      })
    }

    const { roleSlug, lookupError } = await getRoleSlug({
      clId,
      ctx,
      roleId,
      storefrontPermissionsClient,
    })

    if (lookupError) {
      logAccessLookupFailed(
        logger,
        { entity: 'User', operation, orgId, reason: 'role-lookup-failed' },
        lookupError
      )
    }

    const permitted = isUserPermitted({
      orgId,
      roleSlug,
      sessionData,
      storefrontPermissions,
    })

    if (!permitted) {
      // Without the role there was no real decision: not a deny.
      if (lookupError) {
        throw accessLookupFailedError()
      }

      throw authDenied(logger, {
        operation,
        orgId,
        reason: 'not-permitted',
      })
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
      ip,
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
        throw authDenied(logger, {
          operation: 'impersonateB2BUser',
          reason: 'organization-data-not-found',
          targetUserId: id,
        })
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
        throw authDenied(logger, {
          operation: 'impersonateB2BUser',
          orgId: user?.orgId,
          reason: 'not-permitted',
          targetUserId: id,
        })
      }
    }

    const impersonation = await storefrontPermissionsClient
      .impersonateUser({ userId: id })
      .catch((error: any) => {
        logAccessError(
          logger,
          'impersonateB2BUser.error',
          { operation: 'impersonateB2BUser', targetUserId: id },
          error
        )

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

    const result = impersonation?.data?.impersonateUser ?? { status: 'error' }

    await sendMutationAudit(ctx, {
      subjectId: 'impersonate-b2b-user-event',
      operation: 'IMPERSONATE_B2B_USER',
      meta: {
        entityName: 'User',
        remoteIpAddress: ip,
        entityBeforeAction: JSON.stringify(null),
        entityAfterAction: JSON.stringify(user),
      },
    })

    return result
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
      ip,
    } = ctx as Context | any

    if (!adminUserAuthToken && clId) {
      if (!sessionData?.namespaces['storefront-permissions']?.organization) {
        throw authDenied(logger, {
          operation: 'impersonateUser',
          reason: 'organization-data-not-found',
          targetUserId: clId,
        })
      }

      // Own lookup (not getUserFromStorefrontPermissions, which hands the
      // error back as the user): a failure here is not a deny.
      const { userInfo, lookupError } = await storefrontPermissionsClient
        .getUser(clId)
        .then((result: any) => ({ userInfo: result?.data?.getUser ?? {} }))
        .catch((error: any) => ({ lookupError: error, userInfo: {} }))

      if (lookupError) {
        logAccessLookupFailed(
          logger,
          {
            entity: 'User',
            operation: 'impersonateUser',
            reason: 'user-lookup-failed',
            targetUserId: clId,
          },
          lookupError
        )
      }

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
        if (lookupError) {
          throw accessLookupFailedError()
        }

        throw authDenied(logger, {
          operation: 'impersonateUser',
          orgId: userInfo?.orgId,
          reason: 'not-permitted',
          targetUserId: clId,
        })
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

    const result = await impersonateUser(
      ctx,
      storefrontPermissionsClient,
      userId,
      logger,
      sessionData?.namespaces?.account?.accountName,
      sessionData?.namespaces['storefront-permissions']
    )

    await sendMutationAudit(ctx, {
      subjectId: 'impersonate-user-event',
      operation: 'IMPERSONATE_USER',
      meta: {
        entityName: 'User',
        remoteIpAddress: ip,
        entityBeforeAction: JSON.stringify(null),
        entityAfterAction: JSON.stringify(result),
      },
    })

    return result
  },

  removeUserWithEmail: async (
    _: void,
    { orgId, costId, email }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: { events, storefrontPermissions: storefrontPermissionsClient },
      vtex: { logger },
      ip,
    } = ctx as any

    return storefrontPermissionsClient
      .getUsersByEmail(email, orgId, costId)
      .then((result: any) => {
        const user = result.data.getUsersByEmail[0]

        if (!user) {
          logger.warn({
            entity: 'User',
            message: 'removeUserWithEmail.notFound',
            operation: 'removeUserWithEmail',
          })

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
          .then(async (response: any) => {
            await sendMutationAudit(ctx, {
              subjectId: 'remove-user-with-email-event',
              operation: 'REMOVE_USER_WITH_EMAIL',
              meta: {
                entityName: 'User',
                remoteIpAddress: ip,
                entityBeforeAction: JSON.stringify({
                  orgId,
                  costId,
                  email,
                  user,
                }),
                entityAfterAction: JSON.stringify(null),
              },
            })

            events.sendEvent('', 'b2b-organizations-graphql.removeUser', {
              id,
              email,
            })
            sendRemoveUserMetric(ctx, logger, ctx.vtex.account, fields)

            return response.data.deleteUser
          })
          .catch((error: any) => {
            logger.error({
              message: 'removeUser.error',
              error: describeClientError(error),
              operation: 'removeUser',
              entity: 'User',
            })

            return { status: 'error', message: error }
          })
      })
      .catch((error: any) => {
        logger.error({
          message: 'removeUserWithEmail.error',
          error: describeClientError(error),
          operation: 'removeUserWithEmail',
          entity: 'User',
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
      ip,
    } = ctx as Context | any

    if (!id || !clId || !email) {
      throw new GraphQLError('user-information-not-provided')
    }

    if (!adminUserAuthToken) {
      if (!sessionData?.namespaces['storefront-permissions']?.organization) {
        throw authDenied(logger, {
          operation: 'removeUser',
          reason: 'organization-data-not-found',
          targetUserId: id,
        })
      }

      const { roleSlug, lookupError } = await getUserRoleSlug(clId, ctx)

      if (lookupError) {
        logAccessLookupFailed(
          logger,
          {
            entity: 'User',
            operation: 'removeUser',
            reason: 'role-lookup-failed',
            targetUserId: id,
          },
          lookupError
        )
      }

      const permitted =
        (storefrontPermissions?.permissions?.includes(
          'remove-users-organization'
        ) &&
          !roleSlug.includes('sales')) ||
        storefrontPermissions?.permissions?.includes('remove-sales-users-all')

      if (!permitted) {
        if (lookupError) {
          throw accessLookupFailedError()
        }

        throw authDenied(logger, {
          operation: 'removeUser',
          reason: 'not-permitted',
          targetUserId: id,
        })
      }
    }

    const fields = {
      email,
      id,
      userId,
    }

    return storefrontPermissionsClient
      .deleteUser(fields)
      .then(async (result: any) => {
        await sendMutationAudit(ctx, {
          subjectId: 'remove-user-event',
          operation: 'REMOVE_USER',
          meta: {
            entityName: 'User',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify({
              id,
              userId,
              email,
              clId,
            }),
            entityAfterAction: JSON.stringify(null),
          },
        })

        events.sendEvent('', 'b2b-organizations-graphql.removeUser', {
          id,
          email,
        })

        sendRemoveUserMetric(ctx, logger, ctx.vtex.account, fields)

        return result.data.deleteUser
      })
      .catch((error: any) => {
        logger.error({
          message: 'removeUser.error',
          error: describeClientError(error),
          operation: 'removeUser',
          entity: 'User',
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
      ip,
    } = ctx as any

    try {
      await checkUserIsAllowed({
        adminUserAuthToken,
        clId,
        ctx,
        logger,
        operation: 'addUser',
        orgId,
        roleId,
        sessionData,
        storefrontPermissions,
        storefrontPermissionsClient,
      })
    } catch (error) {
      if (!isAccessErrorLogged(error)) {
        logAccessError(
          logger,
          'addUser.checkUserIsAllowedError',
          { operation: 'addUser' },
          error
        )
      }

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
      .then(async (result: any) => {
        await sendMutationAudit(ctx, {
          subjectId: 'add-user-event',
          operation: 'ADD_USER',
          meta: {
            entityName: 'User',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify(null),
            entityAfterAction: JSON.stringify({
              id: result.data.addUser.id,
              userId: result.data.addUser.userId,
              orgId,
              costId,
              clId,
              name,
              email,
              roleId,
            }),
          },
        })

        sendAddUserMetric(ctx, logger, ctx.vtex.account, fields)

        return result.data.addUser
      })
      .catch((error: any) => {
        logger.error({
          message: 'addUser.error',
          error: describeClientError(error),
          operation: 'addUser',
          entity: 'User',
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
      ip,
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

      await sendMutationAudit(ctx, {
        subjectId: 'create-user-with-email-event',
        operation: 'CREATE_USER_WITH_EMAIL',
        meta: {
          entityName: 'User',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(null),
          entityAfterAction: JSON.stringify({
            id: result.data.addUser.id,
            userId: result.data.addUser.userId,
            orgId,
            costId,
            roleId,
            name,
            email,
            canImpersonate,
          }),
        },
      })

      return result.data.addUser
    } catch (error) {
      logger.error({
        message: 'createUserWithEmail.error',
        error: describeClientError(error),
        operation: 'createUserWithEmail',
        entity: 'User',
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
    {
      id,
      roleId,
      userId,
      orgId,
      costId,
      clId,
      name,
      email,
      canImpersonate,
    }: UserArgs,
    ctx: Context
  ) => {
    const {
      clients: {
        masterdata,
        storefrontPermissions: storefrontPermissionsClient,
      },
      vtex: { adminUserAuthToken, logger, sessionData, storefrontPermissions },
      ip,
    } = ctx as any

    try {
      await checkUserIsAllowed({
        adminUserAuthToken,
        clId,
        ctx,
        logger,
        operation: 'updateUser',
        orgId,
        roleId,
        sessionData,
        storefrontPermissions,
        storefrontPermissionsClient,
      })
    } catch (error) {
      if (!isAccessErrorLogged(error)) {
        logAccessError(
          logger,
          'updateUser.checkUserIsAllowedError',
          { operation: 'updateUser' },
          error
        )
      }

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
      canImpersonate,
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
      .then(async (result: any) => {
        let currentUserData = null

        try {
          currentUserData = await storefrontPermissionsClient.getUser({
            userId,
          })
        } catch (error) {
          currentUserData = null
        }

        await sendMutationAudit(ctx, {
          subjectId: 'update-user-event',
          operation: 'UPDATE_USER',
          meta: {
            entityName: 'User',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify(currentUserData),
            entityAfterAction: JSON.stringify(result.data.updateUser),
          },
        })

        sendUpdateUserMetric(ctx, logger, ctx.vtex.account, fields)

        return result.data.updateUser
      })
      .catch((error: any) => {
        logger.error({
          message: 'updateUser.error',
          error: describeClientError(error),
          operation: 'updateUser',
          entity: 'User',
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
      ip,
    } = ctx as any

    try {
      await checkUserIsAllowed({
        adminUserAuthToken,
        clId,
        ctx,
        logger,
        operation: 'saveUser',
        orgId,
        roleId,
        sessionData,
        storefrontPermissions,
        storefrontPermissionsClient,
      })
    } catch (error) {
      if (!isAccessErrorLogged(error)) {
        logAccessError(
          logger,
          'saveUser.checkUserIsAllowedError',
          { operation: 'saveUser' },
          error
        )
      }

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
      .then(async (result: any) => {
        await sendMutationAudit(ctx, {
          subjectId: 'save-user-event',
          operation: 'SAVE_USER',
          meta: {
            entityName: 'User',
            remoteIpAddress: ip,
            entityBeforeAction: JSON.stringify(null),
            entityAfterAction: JSON.stringify(result.data.saveUser),
          },
        })

        return result.data.saveUser
      })
      .catch((error: any) => {
        logger.error({
          message: 'saveUser.error',
          error: describeClientError(error),
          operation: 'saveUser',
          entity: 'User',
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
      logAccessError(
        logger,
        'impersonateUser.error',
        { operation: 'impersonateUser', targetUserId: userId },
        error
      )

      return { status: 'error', message: error }
    })
}
