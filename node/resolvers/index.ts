/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenError } from '@vtex/api'

import {
  schemas,
  ORGANIZATION_REQUEST_DATA_ENTITY,
  ORGANIZATION_REQUEST_FIELDS,
  ORGANIZATION_REQUEST_SCHEMA_VERSION,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  ORGANIZATION_SCHEMA_VERSION,
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
  COST_CENTER_SCHEMA_VERSION,
} from '../mdSchema'
import { toHash } from '../utils'
import GraphQLError from '../utils/GraphQLError'

const getAppId = (): string => {
  return process.env.VTEX_APP_ID ?? ''
}

interface OrganizationInput {
  name: string
  b2bCustomerAdmin: B2BCustomerInput
  defaultCostCenter: DefaultCostCenterInput
}

interface B2BCustomerInput {
  firstName: string
  lastName: string
  email: string
}

// interface B2BCustomerInputWithRole extends B2BCustomerInput {
//   role: string
// }

interface DefaultCostCenterInput {
  name: string
  address: AddressInput
}

interface CostCenterInput {
  name: string
  addresses: [AddressInput]
}

interface AddressInput {
  addressId: string
  addressType: string
  postalCode: string
  country: string
  receiverName: string
  city: string
  state: string
  street: string
  number: string
  complement: string
  neighborhood: string
  geoCoordinates: [number]
}

interface OrganizationRequest {
  name: string
  defaultCostCenter: DefaultCostCenterInput
  b2bCustomerAdmin: string
  status: string
  created: string
}

interface Organization {
  name: string
  costCenters: string[]
  status: string
  created: string
}

const defaultSettings = {
  adminSetup: {
    schemaHash: null,
  },
}

const checkConfig = async (ctx: Context) => {
  const {
    vtex: { logger },
    clients: { apps, masterdata },
  } = ctx

  const app: string = getAppId()
  let settings = await apps.getAppSettings(app)
  let changed = false

  if (!settings.adminSetup) {
    settings = defaultSettings
    changed = true
  }

  const currHash = toHash(schemas)

  if (
    !settings.adminSetup?.schemaHash ||
    settings.adminSetup?.schemaHash !== currHash
  ) {
    const updates: any = []

    changed = true

    schemas.forEach((schema) => {
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
              logger.error({
                message: 'checkConfig-createOrUpdateSchemaError',
                error: e,
              })
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
      .catch((e) => {
        if (e.response?.status !== 304) {
          logger.error({
            message: 'checkConfig-createOrUpdateSchemaError',
            error: e,
          })
          throw new Error(e)
        }
      })
  }

  if (changed) await apps.saveAppSettings(app, settings)

  return settings
}
const QUERIES = {
  getPermission: `query permissions {
    checkUserPermission{
      role {
        id
        name
        slug
      }
      permissions
    }
  }`,
}

export const resolvers = {
  Routes: {
    orders: async (ctx: Context) => {
      const {
        vtex: { storeUserAuthToken, sessionToken, logger },
        clients: {
          vtexId,
          session,
          sfpGraphQL,
          oms,
        },
      } = ctx


      const token: any = storeUserAuthToken

      if (!token ) {
        throw new ForbiddenError('Access denied')
      }

      const authUser = await vtexId.getAuthenticatedUser(token)

      const sessionData = await session
        .getSession(sessionToken as string, ['*'])
        .then((currentSession: any) => {
          return currentSession.sessionData
        })
        .catch((err: any) => {
          logger.error(err)
          return null
        })

        const filterByPermission = (permissions: String[]) => {
          if (permissions.indexOf('organization-orders') !== -1) {
            return `&f_UtmCampaign=${sessionData.namespaces['storefront-permissions'].organization.value}`
          }
          if (permissions.indexOf('costcenter-orders') !== -1) {
            return `&f_UtmMedium=${sessionData.namespaces['storefront-permissions'].costcenter.value}`
          }
          return `&clientEmail=${authUser.user}`
        }

        const appPermissions: any = await sfpGraphQL.query(
          QUERIES.getPermission,
          { },
          {
            persistedQuery: {
              provider: 'vtex.storefront-permissions@1.x',
              sender: 'vtex.b2b-organizations-graphql@0.x',
            },
          }
        ).catch((err: any) => {
          logger.error(err)
          return null
        })

      const pastYear: any = new Date()
            pastYear.setDate(pastYear.getDate()-365)

      const now = new Date().toISOString()
      let query = `f_creationDate=creationDate:[${pastYear.toISOString()} TO ${now}]&${ctx.request.querystring}`

      if (appPermissions?.data?.checkUserPermission?.permissions?.length) {
        query+=filterByPermission(appPermissions.data?.checkUserPermission.permissions)
      } else {
        query+= `&clientEmail=${authUser.user}`
      }

      const orders: any = await oms.search(query)

      ctx.set('Content-Type', 'application/json')
      ctx.set('Cache-Control', 'no-cache, no-store')

      ctx.response.body = orders

      ctx.response.status = 200
    },
    order: async (ctx: Context) => {
      const {
        vtex: {
          route: {
            params: { orderId },
          },
        },
        clients: {
          oms
        }
      } = ctx

      const order: any = await oms.order(String(orderId))

      ctx.set('Content-Type', 'application/json')
      ctx.set('Cache-Control', 'no-cache, no-store')

      ctx.response.body = order

      ctx.response.status = 200
    },
  },
  Mutation: {
    createOrganizationRequest: async (
      _: any,
      {
        input: { name, b2bCustomerAdmin, defaultCostCenter },
      }: { input: OrganizationInput },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx

      // const b2bCustomerAdmin = (ctx.vtex as any).userEmail

      // if (!b2bCustomerAdmin) throw new GraphQLError('email-not-found')

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const now = new Date()

      const organizationRequest = {
        name,
        defaultCostCenter,
        b2bCustomerAdmin,
        status: 'pending',
        notes: '',
        created: now,
      }

      try {
        const result = await masterdata.createDocument({
          dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
          fields: organizationRequest,
          schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
        })

        return result
      } catch (e) {
        logger.error({
          message: 'createOrganizationRequest-error',
          error: e,
        })
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    updateOrganizationRequest: async (
      _: any,
      { id, status, notes }: { id: string; status: string; notes: string },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      if (status === 'approved') {
        // if status is approved:
        const now = new Date()

        try {
          // get organization request
          const organizationRequest: OrganizationRequest =
            await masterdata.getDocument({
              dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
              id,
              fields: ORGANIZATION_REQUEST_FIELDS,
            })

          if (organizationRequest.status === 'approved') {
            throw new GraphQLError('organization-already-approved')
          }

          // update request status to approved
          masterdata.updatePartialDocument({
            dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
            id,
            fields: { status },
          })

          // create organization
          const organization = {
            name: organizationRequest.name,
            status: 'active',
            created: now,
            collections: [],
            priceTables: [],
            costCenters: [],
          }

          const createOrganizationResult = await masterdata.createDocument({
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: organization,
            schema: ORGANIZATION_SCHEMA_VERSION,
          })

          const organizationId = createOrganizationResult.Id.replace(
            'organizations-',
            ''
          )

          // create cost center
          const costCenter = {
            name: organizationRequest.defaultCostCenter.name,
            addresses: [organizationRequest.defaultCostCenter.address],
            organization: organizationId,
          }

          const createCostCenterResult = await masterdata.createDocument({
            dataEntity: COST_CENTER_DATA_ENTITY,
            fields: costCenter,
            schema: COST_CENTER_SCHEMA_VERSION,
          })

          // update organization with cost center ID
          await masterdata.updatePartialDocument({
            id: organizationId,
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: {
              costCenters: [
                createCostCenterResult.Id.replace('cost_centers-', ''),
              ],
            },
            schema: ORGANIZATION_SCHEMA_VERSION,
          })

          // TODO: grant B2B Customer Admin role to user
          // TODO: assign organization ID and cost center ID to user
          // TODO: send email to user

          return { status: 'success', message: '' }
        } catch (e) {
          logger.error({
            message: 'updateOrganizationRequest-error',
            error: e,
          })
          if (e.message) {
            throw new GraphQLError(e.message)
          } else if (e.response?.data?.message) {
            throw new GraphQLError(e.response.data.message)
          } else {
            throw new GraphQLError(e)
          }
        }
      }

      try {
        // if status is declined:
        // update request status to declined
        await masterdata.updatePartialDocument({
          dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
          id,
          fields: { status, notes },
        })
        // TODO: send email to user

        return { status: 'success', message: '' }
      } catch (e) {
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    deleteOrganizationRequest: async (
      _: any,
      { id }: { id: string },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
      } = ctx

      try {
        await masterdata.deleteDocument({
          id,
          dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        })

        return { status: 'success', message: '' }
      } catch (e) {
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    createOrganization: async (
      _: any,
      { input: { name, defaultCostCenter } }: { input: OrganizationInput },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const now = new Date()

      try {
        // create organization
        const organization = {
          name,
          status: 'active',
          created: now,
          collections: [],
          priceTables: [],
          costCenters: [],
        }

        const createOrganizationResult = await masterdata.createDocument({
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: organization,
          schema: ORGANIZATION_SCHEMA_VERSION,
        })

        // create cost center
        const costCenter = {
          name: defaultCostCenter.name,
          addresses: [defaultCostCenter.address],
          organization: createOrganizationResult.Id,
        }

        const createCostCenterResult = await masterdata.createDocument({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: costCenter,
          schema: COST_CENTER_SCHEMA_VERSION,
        })

        // update organization with cost center ID
        masterdata.updatePartialDocument({
          id: createOrganizationResult.Id,
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: { costCenters: [createCostCenterResult.Id] },
          schema: ORGANIZATION_SCHEMA_VERSION,
        })

        return createOrganizationResult
      } catch (e) {
        logger.error({
          message: 'createOrganization-error',
          error: e,
        })
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    createCostCenter: async (
      _: any,
      {
        organizationId,
        input: { name, addresses },
      }: { organizationId: string; input: CostCenterInput },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      try {
        const costCenter = {
          name,
          addresses,
          organization: organizationId,
        }

        const createCostCenterResult = await masterdata.createDocument({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: costCenter,
          schema: COST_CENTER_SCHEMA_VERSION,
        })

        const organization: Organization = await masterdata.getDocument({
          dataEntity: ORGANIZATION_DATA_ENTITY,
          id: organizationId,
          fields: ORGANIZATION_FIELDS,
        })

        const costCenters = organization.costCenters.push(
          createCostCenterResult.Id
        )

        await masterdata.updatePartialDocument({
          dataEntity: ORGANIZATION_DATA_ENTITY,
          id: organizationId,
          fields: { costCenters },
        })

        return createCostCenterResult
      } catch (e) {
        logger.error({
          message: 'createCostCenter-error',
          error: e,
        })
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    updateOrganization: async (
      _: any,
      {
        id,
        status,
        collections,
        priceTables,
      }: { id: string; status: string; collections: any[]; priceTables: any[] },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      try {
        await masterdata.updatePartialDocument({
          id,
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: { status, collections, priceTables },
        })

        return { status: 'success', message: '' }
      } catch (e) {
        logger.error({
          message: 'updateOrganization-error',
          error: e,
        })
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    updateCostCenter: async (
      _: any,
      {
        id,
        input: { name, addresses },
      }: { id: string; input: CostCenterInput },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      try {
        await masterdata.updatePartialDocument({
          id,
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: { name, addresses },
        })

        return { status: 'success', message: '' }
      } catch (e) {
        logger.error({
          message: 'updateCostCenter-error',
          error: e,
        })
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    deleteOrganization: async (
      _: any,
      { id }: { id: string },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
      } = ctx

      try {
        await masterdata.deleteDocument({
          id,
          dataEntity: ORGANIZATION_DATA_ENTITY,
        })

        return { status: 'success', message: '' }
      } catch (e) {
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    deleteCostCenter: async (_: any, { id }: { id: string }, ctx: Context) => {
      const {
        clients: { masterdata },
      } = ctx

      try {
        await masterdata.deleteDocument({
          id,
          dataEntity: COST_CENTER_DATA_ENTITY,
        })

        return { status: 'success', message: '' }
      } catch (e) {
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    saveAppSettings: async (_: any, __: any, ctx: Context) => {
      const {
        clients: { apps },
      } = ctx

      const app: string = getAppId()

      const newSettings = {}

      try {
        await apps.saveAppSettings(app, newSettings)

        return { status: 'success', message: '' }
      } catch (e) {
        return { status: 'error', message: e }
      }
    },
  },
  Query: {
    getOrganizationRequests: async (
      _: any,
      {
        status,
        search,
        page,
        pageSize,
        sortOrder,
        sortedBy,
      }: {
        status: string[]
        search: string
        page: number
        pageSize: number
        sortOrder: string
        sortedBy: string
      },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const whereArray = []

      if (status?.length) {
        const statusArray = [] as string[]

        status.forEach((stat) => {
          statusArray.push(`status=${stat}`)
        })
        const statuses = `(${statusArray.join(' OR ')})`

        whereArray.push(statuses)
      }

      const where = whereArray.join(' AND ')

      try {
        const organizationRequests =
          await masterdata.searchDocumentsWithPaginationInfo({
            dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
            fields: ORGANIZATION_REQUEST_FIELDS,
            schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
            pagination: { page, pageSize },
            sort: `${sortedBy} ${sortOrder}`,
            ...(where ? { where } : {}),
            ...(search ? { keyword: search } : {}),
          })

        return organizationRequests
      } catch (e) {
        logger.error({
          message: 'getOrganizationRequests-error',
          error: e,
        })
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    getOrganizationRequestById: async (
      _: any,
      { id }: { id: string },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      try {
        const organizationRequest = await masterdata.getDocument({
          dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
          fields: ORGANIZATION_REQUEST_FIELDS,
          id,
        })

        return organizationRequest
      } catch (e) {
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    getOrganizations: async (
      _: any,
      {
        status,
        search,
        page,
        pageSize,
        sortOrder,
        sortedBy,
      }: {
        status: string[]
        search: string
        page: number
        pageSize: number
        sortOrder: string
        sortedBy: string
      },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const whereArray = []

      if (status?.length) {
        const statusArray = [] as string[]

        status.forEach((stat) => {
          statusArray.push(`status=${stat}`)
        })
        const statuses = `(${statusArray.join(' OR ')})`

        whereArray.push(statuses)
      }

      const where = whereArray.join(' AND ')

      try {
        const organizations =
          await masterdata.searchDocumentsWithPaginationInfo({
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: ORGANIZATION_FIELDS,
            schema: ORGANIZATION_SCHEMA_VERSION,
            pagination: { page, pageSize },
            sort: `${sortedBy} ${sortOrder}`,
            ...(where ? { where } : {}),
            ...(search ? { keyword: search } : {}),
          })

        return organizations
      } catch (e) {
        logger.error({
          message: 'getOrganizations-error',
          error: e,
        })
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    getOrganizationById: async (
      _: any,
      { id }: { id: string },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      try {
        const organization = await masterdata.getDocument({
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: ORGANIZATION_FIELDS,
          id,
        })

        return organization
      } catch (e) {
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    getCostCentersByOrganizationId: async (
      _: any,
      {
        id,
        search,
        page,
        pageSize,
        sortOrder,
        sortedBy,
      }: {
        id: string
        search: string
        page: number
        pageSize: number
        sortOrder: string
        sortedBy: string
      },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const where = `organization=${id}`

      try {
        const costCenters = await masterdata.searchDocumentsWithPaginationInfo({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: COST_CENTER_FIELDS,
          schema: COST_CENTER_SCHEMA_VERSION,
          pagination: { page, pageSize },
          sort: `${sortedBy} ${sortOrder}`,
          ...(where ? { where } : {}),
          ...(search ? { keyword: search } : {}),
        })

        return costCenters
      } catch (e) {
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    getCostCenterById: async (_: any, { id }: { id: string }, ctx: Context) => {
      const {
        clients: { masterdata },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      try {
        const organization = await masterdata.getDocument({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: COST_CENTER_FIELDS,
          id,
        })

        return organization
      } catch (e) {
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    },
    getAppSettings: async (_: any, __: any, ctx: Context) => {
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

        schemas.forEach((schema) => {
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
          .catch((e) => {
            if (e.response.status !== 304) {
              throw new Error(e)
            }
          })

        await apps.saveAppSettings(app, settings)
      }

      return settings
    },
  },
}
