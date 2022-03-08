/* eslint-disable max-params */
import type { Logger } from '@vtex/api'

import { QUERIES } from '../constants'
import type MailClient from '../clients/email'
import type { GraphQLServer } from '../clients/graphqlServer'

const getUsers = async (
  graphQLServer: GraphQLServer,
  roleSlug: string,
  organizationId?: string
) => {
  const {
    data: { listRoles },
  }: any = await graphQLServer.query(
    QUERIES.listRoles,
    {},
    {
      persistedQuery: {
        provider: 'vtex.storefront-permissions@1.x',
        sender: 'vtex.b2b-organizations@0.x',
      },
    }
  )

  const role = listRoles.find((r: any) => r.slug === roleSlug)

  if (!role) return []

  const {
    data: { listUsers },
  }: any = await graphQLServer.query(
    QUERIES.listUsers,
    {
      roleId: role.id,
      ...(organizationId && { organizationId }),
    },
    {
      persistedQuery: {
        provider: 'vtex.storefront-permissions@1.x',
        sender: 'vtex.b2b-organizations@0.x',
      },
    }
  )

  return listUsers
}

const message = ({
  graphQLServer,
  logger,
  mail,
}: {
  graphQLServer: GraphQLServer
  logger: Logger
  mail: MailClient
}) => {
  const organizationCreated = async (name: string) => {
    let users = []

    try {
      users = await getUsers(graphQLServer, 'sales-admin')
    } catch (err) {
      logger.error(err)
    }

    for (const user of users) {
      mail.sendMail({
        templateName: 'organization-created',
        jsonData: {
          message: { to: user.email },
          organization: { name, admin: user.name },
        },
      })
    }
  }

  const organizationApproved = async (
    name: string,
    admin: string,
    email: string,
    note: string
  ) => {
    mail.sendMail({
      templateName: 'organization-approved',
      jsonData: {
        message: { to: email },
        organization: { name, admin, note },
      },
    })
  }

  const organizationDeclined = async (
    name: string,
    admin: string,
    email: string,
    note: string
  ) => {
    mail.sendMail({
      templateName: 'organization-declined',
      jsonData: {
        message: { to: email },
        organization: { name, admin, note },
      },
    })
  }

  const organizationStatusChanged = async (
    name: string,
    id: string,
    status: string
  ) => {
    let users = []

    try {
      users = await getUsers(graphQLServer, 'customer-admin', id)
    } catch (err) {
      logger.error(err)
    }

    for (const user of users) {
      mail.sendMail({
        templateName: 'organization-status-changed',
        jsonData: {
          message: { to: user.email },
          organization: { name, admin: user.name, status },
        },
      })
    }
  }

  return {
    organizationCreated,
    organizationApproved,
    organizationDeclined,
    organizationStatusChanged,
  }
}

export default message
