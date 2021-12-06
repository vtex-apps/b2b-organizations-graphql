/* eslint-disable max-params */
import { QUERIES } from '.'

const getUsers = async (graphQLServer: any, roleSlug: string) => {
  const {
    data: { listRoles },
  } = await graphQLServer.query(
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

const message = ({ graphQLServer, logger, mail }: any) => {
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

  return { organizationCreated, organizationApproved, organizationDeclined }
}

export default message
