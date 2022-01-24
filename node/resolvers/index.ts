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
import { organizationName, costCenterName, role } from './fieldResolvers'
import message from './message'
import templates from '../templates'

interface Settings {
  schemaHash: string | null
  templateHash: string | null
}

const getAppId = (): string => {
  return process.env.VTEX_APP_ID ?? ''
}

const CONNECTOR = {
  PROMISSORY: 'Vtex.PaymentGateway.Connectors.PromissoryConnector',
} as const

const defaultSettings = {
  schemaHash: null,
  templateHash: null,
}

const checkConfig = async (ctx: Context) => {
  const {
    vtex: { logger },
    clients: { mail, masterdata, vbase },
  } = ctx

  let settings: Settings = await vbase.getJSON('mdSchema', 'settings', true)

  let changed = false

  if (!settings?.schemaHash || !settings?.templateHash) {
    settings = defaultSettings
    changed = true
  }

  const currSchemaHash = toHash(schemas)
  const currTemplateHash = toHash(templates)

  if (!settings?.schemaHash || settings.schemaHash !== currSchemaHash) {
    const updates: any = []

    changed = true

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
        settings.schemaHash = currSchemaHash
      })
      .catch(e => {
        if (e.response?.status === 304) return
        logger.error({
          message: 'checkConfig-createOrUpdateSchemaError',
          error: e,
        })
        throw new Error(e)
      })
  }

  if (!settings?.templateHash || settings.templateHash !== currTemplateHash) {
    const updates: any = []

    changed = true

    templates.forEach(async template => {
      const existingData = await mail.getTemplate(template.Name)

      if (!existingData) {
        updates.push(mail.publishTemplate(template))
      }
    })

    await Promise.all(updates)
      .then(() => {
        settings.templateHash = currTemplateHash
      })
      .catch(e => {
        logger.error({
          message: 'checkConfig-publishTemplateError',
          error: e,
        })
        throw new Error(e)
      })
  }

  if (changed) await vbase.saveJSON('mdSchema', 'settings', settings)

  return settings
}

export const QUERIES = {
  getPermission: `query permissions {
    checkUserPermission @context(provider: "vtex.storefront-permissions"){
      role {
        id
        name
        slug
      }
      permissions
    }
  }`,
  listUsers: `query users($organizationId: ID, $costCenterId: ID, $roleId: ID) {
    listUsers(organizationId: $organizationId, costCenterId: $costCenterId, roleId: $roleId) @context(provider: "vtex.storefront-permissions") {
      id
      roleId
      userId
      clId
      orgId
      costId
      name
      email
      canImpersonate
    }
  }`,
  listRoles: `query roles {
    listRoles @context(provider: "vtex.storefront-permissions") {
      id
      name
      slug
    }
  }`,
  getUser: `query user($id: ID!) {
    getUser(id: $id) @context(provider: "vtex.storefront-permissions") {
      id
      roleId
      userId
      clId
      orgId
      costId
      name
      email
      canImpersonate
    }
  }`,
  getRole: `query role($id: ID!) {
    getRole(id: $id) @context(provider: "vtex.storefront-permissions") {
      id
      name
      slug
    }
  }`,
}

const MUTATIONS = {
  saveUser: `mutation saveUser($id: ID, $roleId: ID!, $userId: ID, $orgId: ID, $costId: ID, $clId: ID, $canImpersonate: Boolean, $name: String!, $email: String!) {
    saveUser(id: $id, roleId: $roleId, userId: $userId, orgId: $orgId, costId: $costId, clId: $clId, canImpersonate: $canImpersonate, name: $name, email: $email) @context(provider: "vtex.storefront-permissions") {
      id
      status
      message
    }
  }`,
  deleteUser: `mutation deleteUser($id: ID!, $userId: ID, $email: String!) {
    deleteUser(id: $id, userId: $userId, email: $email) @context(provider: "vtex.storefront-permissions") {
      id
      status
      message
    }
  }`,
}

const getUserRoleSlug = async (id: string, ctx: Context) => {
  const {
    clients: { graphQLServer },
    vtex: { logger },
  } = ctx

  return graphQLServer
    .query(
      QUERIES.getUser,
      { id },
      {
        persistedQuery: {
          provider: 'vtex.storefront-permissions@1.x',
          sender: 'vtex.b2b-organizations@0.x',
        },
      }
    )
    .then((result: any) => {
      return result.data.getUser
    })
    .then((userData: any) => {
      return graphQLServer.query(
        QUERIES.getRole,
        { id: userData.roleId },
        {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        }
      )
    })
    .then((result: any) => {
      return result?.data?.getRole?.slug ?? ''
    })
    .catch((error: any) => {
      logger.warn({
        message: 'getUserRoleSlug-error',
        error,
      })

      return ''
    })
}

export const resolvers = {
  Routes: {
    checkout: async (ctx: Context) => {
      const {
        vtex: { storeUserAuthToken, sessionToken, logger },
        clients: { session, masterdata },
      } = ctx

      const token: any = storeUserAuthToken
      const response: any = {}

      ctx.response.status = !token ? 403 : 200

      if (token) {
        const sessionData = await session
          .getSession(sessionToken as string, ['*'])
          .then((currentSession: any) => {
            return currentSession.sessionData
          })
          .catch((error: any) => {
            logger.error({
              message: 'getSession-error',
              error,
            })

            return null
          })

        if (sessionData?.namespaces['storefront-permissions']) {
          if (
            sessionData.namespaces['storefront-permissions']?.organization
              ?.value
          ) {
            const organization = await masterdata.getDocument({
              dataEntity: ORGANIZATION_DATA_ENTITY,
              fields: ['paymentTerms'],
              id:
                sessionData.namespaces['storefront-permissions']?.organization
                  ?.value,
            })

            response.organization = organization
          }

          if (
            sessionData.namespaces['storefront-permissions']?.costcenter?.value
          ) {
            const costcenter = await masterdata.getDocument({
              dataEntity: COST_CENTER_DATA_ENTITY,
              fields: ['addresses'],
              id:
                sessionData.namespaces['storefront-permissions']?.costcenter
                  ?.value,
            })

            response.costcenter = costcenter
          }
        }
      }

      ctx.set('Content-Type', 'application/json')
      ctx.set('Cache-Control', 'no-cache, no-store')

      ctx.response.body = response
    },
    orders: async (ctx: Context) => {
      const {
        vtex: { storeUserAuthToken, sessionToken, logger },
        clients: { vtexId, session, graphQLServer, oms },
      } = ctx

      const token: any = storeUserAuthToken

      if (!token) {
        throw new ForbiddenError('Access denied')
      }

      const authUser = await vtexId.getAuthenticatedUser(token)

      const sessionData = await session
        .getSession(sessionToken as string, ['*'])
        .then((currentSession: any) => {
          return currentSession.sessionData
        })
        .catch((error: any) => {
          logger.error({
            message: 'getSession-error',
            error,
          })

          return null
        })

      const filterByPermission = (permissions: string[]) => {
        if (permissions.indexOf('all-orders') !== -1) {
          return ``
        }

        if (permissions.indexOf('organization-orders') !== -1) {
          return `&f_UtmCampaign=${sessionData.namespaces['storefront-permissions'].organization.value}`
        }

        if (permissions.indexOf('costcenter-orders') !== -1) {
          return `&f_UtmMedium=${sessionData.namespaces['storefront-permissions'].costcenter.value}`
        }

        return `&clientEmail=${authUser.user}`
      }

      const {
        data: { checkUserPermission },
      }: any = await graphQLServer
        .query(
          QUERIES.getPermission,
          {},
          {
            persistedQuery: {
              provider: 'vtex.storefront-permissions@1.x',
              sender: 'vtex.b2b-orders-history@0.x',
            },
          }
        )
        .catch((error: any) => {
          logger.error({
            message: 'checkUserPermission-error',
            error,
          })

          return {
            data: {
              checkUserPermission: null,
            },
          }
        })

      const pastYear: any = new Date()

      pastYear.setDate(pastYear.getDate() - 365)

      const now = new Date().toISOString()
      let query = `f_creationDate=creationDate:[${pastYear.toISOString()} TO ${now}]&${
        ctx.request.querystring
      }`

      if (checkUserPermission?.permissions?.length) {
        query += filterByPermission(checkUserPermission.permissions)
      } else {
        query += `&clientEmail=${authUser.user}`
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
        clients: { oms },
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

        return { href: result.Href, id: result.DocumentId }
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
        clients: { masterdata, mail, graphQLServer },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      let organizationRequest: OrganizationRequest

      try {
        // get organization request
        organizationRequest = await masterdata.getDocument({
          dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
          id,
          fields: ORGANIZATION_REQUEST_FIELDS,
        })
      } catch (e) {
        logger.error({
          message: 'getOrganizationRequest-error',
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

      const { email, firstName } = organizationRequest.b2bCustomerAdmin

      if (status === 'approved') {
        // if status is approved:
        const now = new Date()

        try {
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
            paymentTerms: [],
            priceTables: [],
            costCenters: [],
          }

          const createOrganizationResult = await masterdata.createDocument({
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: organization,
            schema: ORGANIZATION_SCHEMA_VERSION,
          })

          const organizationId = createOrganizationResult.DocumentId

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

          // get roleId of org admin
          const roles = await graphQLServer
            .query(
              QUERIES.listRoles,
              {},
              {
                persistedQuery: {
                  provider: 'vtex.storefront-permissions@1.x',
                  sender: 'vtex.b2b-organizations@0.x',
                },
              }
            )
            .then((result: any) => {
              return result.data.listRoles
            })

          const roleId = roles.find(
            (roleItem: any) => roleItem.slug === 'customer-admin'
          ).id

          // check if user already exists in CL
          let existingUser = {} as any
          const clId = await masterdata
            .searchDocuments({
              dataEntity: 'CL',
              fields: ['id'],
              where: `email=${email}`,
              pagination: {
                page: 1,
                pageSize: 1,
              },
            })
            .then((res: any) => {
              return res[0]?.id ?? undefined
            })
            .catch(() => undefined)

          // check if user already exists in storefront-permissions
          if (clId) {
            await graphQLServer
              .query(
                QUERIES.getUser,
                { id: clId },
                {
                  persistedQuery: {
                    provider: 'vtex.storefront-permissions@1.x',
                    sender: 'vtex.b2b-organizations@0.x',
                  },
                }
              )
              .then((result: any) => {
                existingUser = result?.data?.getUser ?? {}
              })
              .catch(() => null)
          }

          // grant user org admin role, assign org and cost center
          const addUserResult = await graphQLServer
            .mutation(MUTATIONS.saveUser, {
              ...existingUser,
              roleId,
              orgId: organizationId,
              costId: createCostCenterResult.DocumentId,
              canImpersonate: existingUser?.canImpersonate ?? false,
              name: existingUser?.name || firstName,
              email,
            })
            .then((result: any) => {
              return result.data.saveUser
            })
            .catch((error: any) => {
              logger.error({
                message: 'addUser-error',
                error,
              })
            })

          if (addUserResult?.status === 'success') {
            message({ graphQLServer, logger, mail }).organizationApproved(
              organizationRequest.name,
              firstName,
              email,
              notes
            )
          }

          // notify sales admin
          message({ graphQLServer, logger, mail }).organizationCreated(
            organizationRequest.name
          )

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

        message({ graphQLServer, logger, mail }).organizationDeclined(
          organizationRequest.name,
          firstName,
          email,
          notes
        )

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
        clients: { masterdata, graphQLServer, mail },
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
          paymentTerms: [],
          priceTables: [],
          costCenters: [],
        }

        const createOrganizationResult = await masterdata.createDocument({
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: organization,
          schema: ORGANIZATION_SCHEMA_VERSION,
        })

        const organizationId = createOrganizationResult.DocumentId

        // create cost center
        const costCenter = {
          name: defaultCostCenter.name,
          addresses: [defaultCostCenter.address],
          organization: organizationId,
        }

        await masterdata.createDocument({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: costCenter,
          schema: COST_CENTER_SCHEMA_VERSION,
        })

        message({ graphQLServer, logger, mail }).organizationCreated(name)

        return {
          href: createOrganizationResult.Href,
          id: createOrganizationResult.DocumentId,
        }
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
        vtex,
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      if (!organizationId) {
        // get user's organization from session
        const { sessionData } = vtex as any

        if (!sessionData?.namespaces['storefront-permissions']) {
          throw new GraphQLError('organization-data-not-found')
        }

        const {
          organization: { value: userOrganizationId },
        } = sessionData.namespaces['storefront-permissions']

        organizationId = userOrganizationId
      }

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

        return {
          href: createCostCenterResult.Href,
          id: createCostCenterResult.DocumentId,
        }
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
        name,
        status,
        collections,
        paymentTerms,
        priceTables,
      }: {
        id: string
        name: string
        status: string
        collections: any[]
        paymentTerms: any[]
        priceTables: any[]
      },
      ctx: Context
    ) => {
      const {
        clients: { graphQLServer, mail, masterdata },
        vtex: { logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      try {
        const currentData: Organization = await masterdata.getDocument({
          dataEntity: ORGANIZATION_DATA_ENTITY,
          id,
          fields: ORGANIZATION_FIELDS,
        })

        if (currentData.status !== status) {
          await message({
            graphQLServer,
            logger,
            mail,
          }).organizationStatusChanged(name, id, status)
        }
      } catch (error) {
        logger.warn({
          message: 'updateOrganization-emailOnStatusChangeError',
          error,
        })
      }

      try {
        await masterdata.updatePartialDocument({
          id,
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: { name, status, collections, paymentTerms, priceTables },
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
        input: { name, addresses, paymentTerms },
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
          fields: {
            name,
            addresses,
            ...(paymentTerms ? { paymentTerms } : {}),
          },
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

      // TODO: also delete organization's cost centers?

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
    saveUser: async (
      _: any,
      {
        id,
        roleId,
        userId,
        orgId,
        costId,
        clId,
        canImpersonate = false,
        name,
        email,
      }: UserArgs,
      ctx: Context
    ) => {
      const {
        clients: { graphQLServer },
        vtex,
        vtex: { adminUserAuthToken, logger },
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const { sessionData, storefrontPermissions } = vtex as any

      if (
        !adminUserAuthToken &&
        !sessionData?.namespaces['storefront-permissions']?.organization
      ) {
        throw new GraphQLError('organization-data-not-found')
      }

      if (
        !adminUserAuthToken &&
        !storefrontPermissions?.permissions?.includes('add-users-organization')
      ) {
        throw new GraphQLError('operation-not-permitted')
      }

      if (
        !adminUserAuthToken &&
        sessionData.namespaces['storefront-permissions'].organization !== orgId
      ) {
        throw new GraphQLError('operation-not-permitted')
      }

      if (clId) {
        // check the role of the user to be saved
        const roleSlug = await getUserRoleSlug(clId, ctx)

        // organization admin can only save organization users
        if (roleSlug.indexOf('sales') !== -1) {
          throw new GraphQLError('operation-not-permitted')
        }
      } else {
        // check the role of the user being added
        const roleSlug: string = await graphQLServer
          .query(
            QUERIES.getRole,
            { id: roleId },
            {
              persistedQuery: {
                provider: 'vtex.storefront-permissions@1.x',
                sender: 'vtex.b2b-organizations@0.x',
              },
            }
          )
          .then((result: any) => {
            return result?.data?.getRole?.slug ?? ''
          })
          .catch((error: any) => {
            logger.warn({
              message: 'saveUser-getRoleError',
              error,
            })

            return ''
          })

        // organization admin can only add organization users
        if (roleSlug.indexOf('sales') !== -1) {
          throw new GraphQLError('operation-not-permitted')
        }
      }

      const addUserResult = await graphQLServer
        .mutation(MUTATIONS.saveUser, {
          id,
          roleId,
          userId,
          orgId,
          costId,
          clId,
          canImpersonate,
          name,
          email,
        })
        .then((result: any) => {
          return result.data.saveUser
        })
        .catch((error: any) => {
          logger.error({
            message: 'addUser-error',
            error,
          })

          return { status: 'error', message: error }
        })

      return addUserResult
    },
    removeUser: async (
      _: any,
      { id, userId, email, clId }: UserArgs,
      ctx: Context
    ) => {
      const {
        clients: { graphQLServer },
        vtex,
        vtex: { adminUserAuthToken, logger },
      } = ctx

      if (!id || !clId || !email) {
        throw new GraphQLError('user-information-not-provided')
      }

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const { sessionData, storefrontPermissions } = vtex as any

      if (
        !adminUserAuthToken &&
        !sessionData?.namespaces['storefront-permissions']?.organization
      ) {
        throw new GraphQLError('organization-data-not-found')
      }

      if (
        !adminUserAuthToken &&
        !storefrontPermissions?.permissions?.includes(
          'remove-users-organization'
        )
      ) {
        throw new GraphQLError('operation-not-permitted')
      }

      // check the role of the user to be removed
      const roleSlug = await getUserRoleSlug(clId, ctx)

      // organization admin can only remove organization users
      if (roleSlug.indexOf('sales') !== -1) {
        throw new GraphQLError('operation-not-permitted')
      }

      const deleteUserResult = await graphQLServer
        .mutation(MUTATIONS.deleteUser, {
          id,
          userId,
          email,
        })
        .then((result: any) => {
          return result.data.deleteUser
        })
        .catch((error: any) => {
          logger.error({
            message: 'removeUser-deleteUserError',
            error,
          })

          return { status: 'error', message: error }
        })

      return deleteUserResult
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

        status.forEach(stat => {
          statusArray.push(`status=${stat}`)
        })
        const statuses = `(${statusArray.join(' OR ')})`

        whereArray.push(statuses)
      }

      if (search) {
        whereArray.push(`name=*${encodeURI(search)}*`)
      }

      const where = whereArray.join(' AND ')

      try {
        const organizationRequests = await masterdata.searchDocumentsWithPaginationInfo(
          {
            dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
            fields: ORGANIZATION_REQUEST_FIELDS,
            schema: ORGANIZATION_REQUEST_SCHEMA_VERSION,
            pagination: { page, pageSize },
            sort: `${sortedBy} ${sortOrder}`,
            ...(where && { where }),
          }
        )

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

        status.forEach(stat => {
          statusArray.push(`status=${stat}`)
        })
        const statuses = `(${statusArray.join(' OR ')})`

        whereArray.push(statuses)
      }

      if (search) {
        whereArray.push(`name="*${search}*"`)
      }

      const where = whereArray.join(' AND ')

      try {
        const organizations = await masterdata.searchDocumentsWithPaginationInfo(
          {
            dataEntity: ORGANIZATION_DATA_ENTITY,
            fields: ORGANIZATION_FIELDS,
            schema: ORGANIZATION_SCHEMA_VERSION,
            pagination: { page, pageSize },
            sort: `${sortedBy} ${sortOrder}`,
            ...(where && { where }),
          }
        )

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
    getOrganizationByIdStorefront: async (
      _: any,
      { id }: { id: string },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex,
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const { sessionData } = vtex as any

      if (!sessionData?.namespaces['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
      } = sessionData.namespaces['storefront-permissions']

      if (!id) {
        // get user's organization from session
        id = userOrganizationId
      }

      if (id !== userOrganizationId) {
        throw new GraphQLError('operation-not-permitted')
      }

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
    getCostCenters: async (
      _: any,
      {
        search,
        page,
        pageSize,
        sortOrder,
        sortedBy,
      }: {
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

      let where = ''

      if (search) {
        where = `name=*${encodeURI(search)}*`
      }

      try {
        const costCenters = await masterdata.searchDocumentsWithPaginationInfo({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: COST_CENTER_FIELDS,
          schema: COST_CENTER_SCHEMA_VERSION,
          pagination: { page, pageSize },
          sort: `${sortedBy} ${sortOrder}`,
          ...(where && { where }),
        })

        return costCenters
      } catch (e) {
        logger.error({
          message: 'getCostCenters-error',
          e,
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

      let where = `organization=${id}`

      if (search) {
        where += ` AND name=*${encodeURI(search)}*`
      }

      try {
        const costCenters = await masterdata.searchDocumentsWithPaginationInfo({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: COST_CENTER_FIELDS,
          schema: COST_CENTER_SCHEMA_VERSION,
          pagination: { page, pageSize },
          sort: `${sortedBy} ${sortOrder}`,
          ...(where && { where }),
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
    getCostCentersByOrganizationIdStorefront: async (
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
        vtex,
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const { sessionData } = vtex as any

      if (!sessionData?.namespaces['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
      } = sessionData.namespaces['storefront-permissions']

      if (!id) {
        // get user's organization from session
        id = userOrganizationId
      }

      if (id !== userOrganizationId) {
        throw new GraphQLError('operation-not-permitted')
      }

      let where = `organization=${id}`

      if (search) {
        where += ` AND name=*${encodeURI(search)}*`
      }

      try {
        const costCenters = await masterdata.searchDocumentsWithPaginationInfo({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: COST_CENTER_FIELDS,
          schema: COST_CENTER_SCHEMA_VERSION,
          pagination: { page, pageSize },
          sort: `${sortedBy} ${sortOrder}`,
          ...(where && { where }),
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
        const costCenter: CostCenter = await masterdata.getDocument({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: COST_CENTER_FIELDS,
          id,
        })

        return costCenter
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
    getCostCenterByIdStorefront: async (
      _: any,
      { id }: { id: string },
      ctx: Context
    ) => {
      const {
        clients: { masterdata },
        vtex,
      } = ctx

      // create schema if it doesn't exist
      await checkConfig(ctx)

      const { sessionData } = vtex as any

      if (!sessionData?.namespaces['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
        costcenter: { value: userCostCenterId },
      } = sessionData.namespaces['storefront-permissions']

      if (!id) {
        // get user's organization from session
        id = userCostCenterId
      }

      try {
        const costCenter: CostCenter = await masterdata.getDocument({
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: COST_CENTER_FIELDS,
          id,
        })

        if (costCenter.organization !== userOrganizationId) {
          throw new GraphQLError('operation-not-permitted')
        }

        return costCenter
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
    getPaymentTerms: async (_: any, __: any, ctx: Context) => {
      const {
        clients: { payments },
      } = ctx

      try {
        const paymentRules = await payments.rules()

        const promissoryConnectors = paymentRules.filter(
          rule => rule.connector.implementation === CONNECTOR.PROMISSORY
        )

        return promissoryConnectors.map(connector => connector.paymentSystem)
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
    getUsers: async (
      _: any,
      {
        organizationId,
        costCenterId,
      }: { organizationId: string; costCenterId: string },
      ctx: Context
    ) => {
      const {
        clients: { graphQLServer },
        vtex: { logger },
        vtex,
      } = ctx

      const { sessionData } = vtex as any

      if (!sessionData?.namespaces['storefront-permissions']) {
        throw new GraphQLError('organization-data-not-found')
      }

      const {
        organization: { value: userOrganizationId },
      } = sessionData.namespaces['storefront-permissions']

      if (!organizationId) {
        // get user's organization from session
        organizationId = userOrganizationId
      }

      if (organizationId !== userOrganizationId) {
        throw new GraphQLError('operation-not-permitted')
      }

      const variables = {
        ...(organizationId && { organizationId }),
        ...(costCenterId && { costCenterId }),
      }

      const users = await graphQLServer
        .query(QUERIES.listUsers, variables, {
          persistedQuery: {
            provider: 'vtex.storefront-permissions@1.x',
            sender: 'vtex.b2b-organizations@0.x',
          },
        })
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

      return users
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
  },
  B2BUser: {
    organizationName,
    costCenterName,
    role,
  },
}
