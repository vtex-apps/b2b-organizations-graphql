/* eslint-disable max-params */
import type { Logger } from '@vtex/api'

import type MailClient from '../clients/email'
import type StorefrontPermissions from '../clients/storefrontPermissions'

const getUsers = async (
  storefrontPermissions: StorefrontPermissions,
  roleSlug: string,
  organizationId?: string
) => {
  const {
    data: { listRoles },
  }: any = await storefrontPermissions.listRoles()

  const role = listRoles.find((r: any) => r.slug === roleSlug)

  if (!role) return []

  const {
    data: { listUsers },
  }: any = await storefrontPermissions.listUsers({
    roleId: role.id,
    ...(organizationId && { organizationId }),
  })

  return listUsers
}

const message = ({
  storefrontPermissions,
  logger,
  mail,
}: {
  storefrontPermissions: StorefrontPermissions
  logger: Logger
  mail: MailClient
}) => {
  const organizationCreated = async (name: string) => {
    let users = []

    try {
      users = await getUsers(storefrontPermissions, 'sales-admin')
    } catch (err) {
      logger.error(err)
    }

    const promises = []

    for (const user of users) {
      promises.push(
        mail
          .sendMail({
            jsonData: {
              message: { to: user.email },
              organization: { name, admin: user.name },
            },
            templateName: 'organization-created',
          })
          .catch(err =>
            logger.error({
              message: {
                error: err,
                message: 'Error sending organization created email',
              },
            })
          )
      )
    }

    return Promise.all(promises)
  }

  const organizationApproved = async (
    name: string,
    admin: string,
    email: string,
    note: string
  ) => {
    return mail
      .sendMail({
        jsonData: {
          message: { to: email },
          organization: { name, admin, note },
        },
        templateName: 'organization-approved',
      })
      .catch(err =>
        logger.error({
          message: {
            error: err,
            message: 'Error sending organization approved email',
          },
        })
      )
  }

  const organizationDeclined = async (
    name: string,
    admin: string,
    email: string,
    note: string
  ) => {
    return mail
      .sendMail({
        jsonData: {
          message: { to: email },
          organization: { name, admin, note },
        },
        templateName: 'organization-declined',
      })
      .catch(err =>
        logger.error({
          message: {
            error: err,
            message: 'Error sending organization declined email',
          },
        })
      )
  }

  const organizationStatusChanged = async (
    name: string,
    id: string,
    status: string
  ) => {
    let users = []

    try {
      users = await getUsers(storefrontPermissions, 'customer-admin', id)
    } catch (err) {
      logger.error(err)
    }

    const promises = []

    for (const user of users) {
      promises.push(
        mail
          .sendMail({
            jsonData: {
              message: { to: user.email },
              organization: { name, admin: user.name, status },
            },
            templateName: 'organization-status-changed',
          })
          .catch(err =>
            logger.error({
              message: {
                error: err,
                message: 'Error sending organization status changed email',
              },
            })
          )
      )
    }

    return Promise.all(promises)
  }

  return {
    organizationApproved,
    organizationCreated,
    organizationDeclined,
    organizationStatusChanged,
  }
}

export default message
