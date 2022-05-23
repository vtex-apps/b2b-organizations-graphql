import { schemas } from '../../mdSchema'
import { toHash } from '../../utils'
import GraphQLError from '../../utils/GraphQLError'
import { getAppId } from '../config'
import CostCenters from './CostCenters'
import Organizations from './Organizations'

const Index = {
  ...CostCenters,
  ...Organizations,

  getAppSettings: async (_: void, __: void, ctx: Context) => {
    const {
      clients: { apps, masterdata },
    } = ctx

    const app: string = getAppId()
    const settings = await apps.getAppSettings(app)

    if (!settings.adminSetup) {
      settings.adminSetup = {}
    }

    const currHash = toHash(schemas)

    if (
      !settings.adminSetup?.schemaHash ||
      settings.adminSetup?.schemaHash !== currHash
    ) {
      const updates: any = []

      schemas.forEach(schema => {
        updates.push(
          masterdata
            .createOrUpdateSchema({
              dataEntity: schema.name,
              schemaName: schema.version,
              schemaBody: schema.body,
            })
            .then(() => true)
            .catch((e: any) => {
              if (e.response.status !== 304) {
                throw e
              }

              return true
            })
        )
      })

      await Promise.all(updates)
        .then(() => {
          settings.adminSetup.schemaHash = currHash
        })
        .catch(e => {
          if (e.response.status !== 304) {
            throw new Error(e)
          }
        })

      await apps.saveAppSettings(app, settings)
    }

    return settings
  },
  getUsers: async (
    _: void,
    {
      organizationId,
      costCenterId,
    }: { organizationId: string; costCenterId: string },
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions },
      vtex: { adminUserAuthToken, logger },
      vtex,
    } = ctx

    const { sessionData } = vtex as any

    if (!adminUserAuthToken) {
      if (!sessionData?.namespaces['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
      } = sessionData?.namespaces['storefront-permissions']

      if (!organizationId) {
        // get user's organization from session
        organizationId = userOrganizationId
      }

      if (organizationId !== userOrganizationId) {
        throw new GraphQLError('operation-not-permitted')
      }
    }

    const variables = {
      ...(organizationId && { organizationId }),
      ...(costCenterId && { costCenterId }),
    }

    return storefrontPermissions
      .listUsers(variables)
      .then((result: any) => {
        return result.data.listUsers
      })
      .catch(error => {
        logger.error({
          message: 'getUsers-error',
          error,
        })
        if (error.message) {
          throw new GraphQLError(error.message)
        } else if (error.response?.data?.message) {
          throw new GraphQLError(error.response.data.message)
        } else {
          throw new GraphQLError(error)
        }
      })
  },

  getUsersPaginated: async (
    _: void,
    {
      organizationId,
      costCenterId,
      search = '',
      page = 1,
      pageSize = 25,
      sortOrder = 'asc',
      sortedBy = 'email',
    }: {
      organizationId: string
      costCenterId: string
      search: string
      page: number
      pageSize: number
      sortOrder: string
      sortedBy: string
    },
    ctx: Context
  ) => {
    const {
      clients: { storefrontPermissions },
      vtex: { adminUserAuthToken, logger },
      vtex,
    } = ctx

    const { sessionData } = vtex as any

    const {
      data: { checkUserPermission },
    }: any = await storefrontPermissions
      .checkUserPermission('vtex.b2b-organizations@1.x')
      .catch((error: any) => {
        logger.error({
          error,
          message: 'checkUserPermission-error',
        })

        return {
          data: {
            checkUserPermission: null,
          },
        }
      })

    const isSalesAdmin = checkUserPermission?.role.slug.match(/sales-admin/)

    if (!adminUserAuthToken && !isSalesAdmin) {
      if (!sessionData?.namespaces['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
      } = sessionData?.namespaces['storefront-permissions']

      if (!organizationId) {
        // get user's organization from session
        organizationId = userOrganizationId
      }

      if (organizationId !== userOrganizationId) {
        throw new GraphQLError('operation-not-permitted')
      }
    }

    const variables = {
      ...(organizationId && { organizationId }),
      ...(costCenterId && { costCenterId }),
      page,
      pageSize,
      search,
      sortOrder,
      sortedBy,
    }

    return storefrontPermissions
      .listUsers(variables)
      .then((result: any) => {
        return result.data.listUsersPaginated
      })
      .catch(error => {
        logger.error({
          message: 'getUsers-error',
          error,
        })
        if (error.message) {
          throw new GraphQLError(error.message)
        } else if (error.response?.data?.message) {
          throw new GraphQLError(error.response.data.message)
        } else {
          throw new GraphQLError(error)
        }
      })
  },
}

export default Index
