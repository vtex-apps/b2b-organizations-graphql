/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenError } from '@vtex/api'

import { CONNECTOR } from '../constants'
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

  let schemaChanged = false
  let templatesChanged = false

  if (!settings?.schemaHash || !settings?.templateHash) {
    settings = defaultSettings
  }

  const currSchemaHash = toHash(schemas)
  const currTemplateHash = toHash(templates)

  if (!settings?.schemaHash || settings.schemaHash !== currSchemaHash) {
    const updates: any = []

    logger.info({
      message: 'checkConfig-updatingSchema',
    })

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

              return false
            }

            return true
          })
      )
    })

    await Promise.all(updates).then(results => {
      if (results.every(res => res === true)) {
        settings.schemaHash = currSchemaHash
        schemaChanged = true
      }
    })
  }

  if (!settings?.templateHash || settings.templateHash !== currTemplateHash) {
    const updates: any = []

    logger.info({
      message: 'checkConfig-updatingTemplates',
    })

    templates.forEach(async template => {
      const existingData = await mail.getTemplate(template.Name)

      if (!existingData) {
        updates.push(mail.publishTemplate(template))
      }
    })

    await Promise.all(updates)
      .then(() => {
        settings.templateHash = currTemplateHash
        templatesChanged = true
      })
      .catch(e => {
        logger.error({
          message: 'checkConfig-publishTemplateError',
          error: e,
        })
        throw new Error(e)
      })
  }

  if (schemaChanged || templatesChanged) {
    await vbase.saveJSON('mdSchema', 'settings', settings)
  }

  return settings
}

const getUserRoleSlug: (id: string, ctx: Context) => Promise<string> = async (
  id,
  ctx
) => {
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
        clients: { vtexId, session, oms, storefrontPermissions },
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
      }: any = await storefrontPermissions
        .checkUserPermission()
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
      _: void,
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
      _: void,
      { id, status, notes }: { id: string; status: string; notes: string },
      ctx: Context
    ) => {
      const {
        clients: { masterdata, mail, storefrontPermissions },
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
          const roles = await storefrontPermissions
            .listRoles()
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
            await storefrontPermissions
              .getUser(clId)
              .then((result: any) => {
                existingUser = result?.data?.getUser ?? {}
              })
              .catch(() => null)
          }

          // grant user org admin role, assign org and cost center
          const addUserResult = await storefrontPermissions
            .saveUser({
              ...existingUser,
              roleId,
              orgId: organizationId,
              costId: createCostCenterResult.DocumentId,
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
            message({
              storefrontPermissions,
              logger,
              mail,
            }).organizationApproved(
              organizationRequest.name,
              firstName,
              email,
              notes
            )
          }

          // notify sales admin
          message({ storefrontPermissions, logger, mail }).organizationCreated(
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

        message({ storefrontPermissions, logger, mail }).organizationDeclined(
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
      _: void,
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
      _: void,
      { input: { name, defaultCostCenter } }: { input: OrganizationInput },
      ctx: Context
    ) => {
      const {
        clients: { masterdata, storefrontPermissions, mail },
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

        message({ storefrontPermissions, logger, mail }).organizationCreated(
          name
        )

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
      _: void,
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
      _: void,
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
        clients: { storefrontPermissions, mail, masterdata },
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
            storefrontPermissions,
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
      _: void,
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
      _: void,
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
    deleteCostCenter: async (_: void, { id }: { id: string }, ctx: Context) => {
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
      _: void,
      { id, roleId, userId, orgId, costId, clId, name, email }: UserArgs,
      ctx: Context
    ) => {
      const {
        clients: {
          masterdata,
          storefrontPermissions: storefrontPermissionsClient,
        },
        vtex,
        vtex: { adminUserAuthToken, logger },
      } = ctx

      const { sessionData, storefrontPermissions } = vtex as any

      if (!adminUserAuthToken) {
        if (!sessionData?.namespaces['storefront-permissions']?.organization) {
          throw new GraphQLError('organization-data-not-found')
        }

        let permitted = false

        let roleSlug = ''

        if (clId) {
          // check the role of the user to be saved
          roleSlug = await getUserRoleSlug(clId, ctx)
        } else {
          // check the role of the user being added
          roleSlug = await storefrontPermissionsClient
            .getRole(roleId)
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
        }

        if (
          storefrontPermissions?.permissions?.includes(
            'add-users-organization'
          ) &&
          sessionData.namespaces['storefront-permissions'].organization ===
            orgId
        ) {
          // organization admin can only add or save organization users
          if (!roleSlug.includes('sales')) {
            permitted = true
          }
        }

        if (
          storefrontPermissions?.permissions?.includes('add-sales-users-all')
        ) {
          // sales admin can only add or save sales users
          if (roleSlug.includes('sales')) {
            permitted = true
          }
        }

        if (!permitted) {
          throw new GraphQLError('operation-not-permitted')
        }
      }

      if (clId && !userId) {
        const userIdFromCl = await masterdata
          .getDocument({
            dataEntity: 'CL',
            id: clId,
            fields: ['userId'],
          })
          .then((res: any) => {
            return res?.userId ?? undefined
          })
          .catch(() => undefined)

        if (userIdFromCl) userId = userIdFromCl
      }

      const addUserResult = await storefrontPermissionsClient
        .saveUser({
          id,
          roleId,
          userId,
          orgId,
          costId,
          clId,
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
      _: void,
      { id, userId, email, clId }: UserArgs,
      ctx: Context
    ) => {
      const {
        clients: { storefrontPermissions: storefrontPermissionsClient },
        vtex,
        vtex: { adminUserAuthToken, logger },
      } = ctx

      if (!id || !clId || !email) {
        throw new GraphQLError('user-information-not-provided')
      }

      const { sessionData, storefrontPermissions } = vtex as any

      if (!adminUserAuthToken) {
        if (!sessionData?.namespaces['storefront-permissions']?.organization) {
          throw new GraphQLError('organization-data-not-found')
        }

        let permitted = false

        // check the role of the user to be removed
        const roleSlug = await getUserRoleSlug(clId, ctx)

        if (
          storefrontPermissions?.permissions?.includes(
            'remove-users-organization'
          )
        ) {
          // organization admin can only remove organization users
          if (!roleSlug.includes('sales')) {
            permitted = true
          }
        }

        if (
          storefrontPermissions?.permissions?.includes('remove-sales-users-all')
        ) {
          // sales admin can only remove sales users
          if (roleSlug.includes('sales')) {
            permitted = true
          }
        }

        if (!permitted) {
          throw new GraphQLError('operation-not-permitted')
        }
      }

      const deleteUserResult = await storefrontPermissionsClient
        .deleteUser({
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
        vtex,
        vtex: { adminUserAuthToken, logger },
      } = ctx

      const { sessionData, storefrontPermissions } = vtex as any

      if (!adminUserAuthToken && clId) {
        if (!sessionData?.namespaces['storefront-permissions']?.organization) {
          throw new GraphQLError('organization-data-not-found')
        }

        let permitted = false

        // check the role of the user to be impersonated
        const roleSlug = await getUserRoleSlug(clId, ctx)

        if (!roleSlug.includes('sales')) {
          const userInfo = await storefrontPermissionsClient
            .getUser(clId)
            .then((result: any) => {
              return result?.data?.getUser ?? {}
            })
            .catch((error: any) => {
              logger.warn({
                message: 'impersonateUser-getUserError',
                error,
              })

              return null
            })

          if (
            storefrontPermissions?.permissions?.includes(
              'impersonate-users-costcenter'
            )
          ) {
            if (
              !roleSlug.includes('admin') &&
              userInfo?.costId ===
                sessionData?.namespaces['storefront-permissions']?.costcenter
            ) {
              permitted = true
            }
          }

          if (
            storefrontPermissions?.permissions?.includes(
              'impersonate-users-organization'
            )
          ) {
            if (
              userInfo?.orgId ===
              sessionData?.namespaces['storefront-permissions']?.organization
            ) {
              permitted = true
            }
          }

          if (
            storefrontPermissions?.permissions?.includes(
              'impersonate-users-all'
            )
          ) {
            permitted = true
          }
        }

        if (!permitted) {
          throw new GraphQLError('operation-not-permitted')
        }
      }

      if (!userId && clId) {
        const userIdFromCl = await masterdata
          .getDocument({
            dataEntity: 'CL',
            id: clId,
            fields: ['userId'],
          })
          .then((res: any) => {
            return res?.userId ?? undefined
          })
          .catch(() => undefined)

        if (!userIdFromCl)
          return { status: 'error', message: 'userId not found in CL' }

        userId = userIdFromCl

        const userData = await storefrontPermissionsClient
          .getUser(clId)
          .then(res => {
            return res?.data?.getUser
          })
          .catch(() => undefined)

        if (userData && !userData.userId) {
          await storefrontPermissionsClient.saveUser({
            ...userData,
            userId,
          })
        }
      }

      const impersonateUserResult = await storefrontPermissionsClient
        .impersonateUser({ userId })
        .catch((error: any) => {
          logger.error({
            message: 'impersonateUser-impersonateUserError',
            error,
          })

          return { status: 'error', message: error }
        })

      return impersonateUserResult
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
      _: void,
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
      _: void,
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
      _: void,
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
      _: void,
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
      _: void,
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
      _: void,
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
        where = `name="*${search}*"`
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
      _: void,
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
        where += ` AND name="*${search}*"`
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
      _: void,
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
        where += ` AND name="*${search}*"`
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
    getCostCenterById: async (
      _: void,
      { id }: { id: string },
      ctx: Context
    ) => {
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
      _: void,
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
    getPaymentTerms: async (_: void, __: void, ctx: Context) => {
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

      const users = await storefrontPermissions
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

      return users
    },
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
  },
  B2BUser: {
    organizationName,
    costCenterName,
    role,
  },
}
