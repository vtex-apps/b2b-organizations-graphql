import { ORGANIZATION_REQUEST_DATA_ENTITY } from '../mdSchema'
import GraphQLError from './GraphQLError'
import message from '../resolvers/message'

export const updateOrganizationRequest = async (
  organizationRequest: any,
  masterdata: any,
  id: string,
  firstName: string,
  email: string,
  mail: any,
  notes: string,
  status: string,
  storefrontPermissions: any,
  logger: any,
  paymentTerms: PaymentTerm[],
  priceTables: Price[],
  customFields: CustomField[],
  Organizations: any,
  ctx: any
) => {
  if (status === 'approved') {
    try {
      // update request status to approved
      masterdata.updatePartialDocument({
        dataEntity: ORGANIZATION_REQUEST_DATA_ENTITY,
        id,
        fields: { status },
      })

      const {
        costCenterId,
        id: organizationId,
      } = await Organizations.createOrganization(
        undefined,
        {
          input: {
            name: organizationRequest.name,
            ...(organizationRequest.tradeName && {
              tradeName: organizationRequest.tradeName,
            }),
            b2bCustomerAdmin: {
              email,
              firstName,
            },
            defaultCostCenter: {
              address: organizationRequest.defaultCostCenter.address,
              name: organizationRequest.defaultCostCenter.name,
              ...(organizationRequest.defaultCostCenter.phoneNumber && {
                phoneNumber: organizationRequest.defaultCostCenter.phoneNumber,
              }),
              ...(organizationRequest.defaultCostCenter.businessDocument && {
                businessDocument:
                  organizationRequest.defaultCostCenter.businessDocument,
              }),
              ...(organizationRequest.defaultCostCenter.customFields && {
                customFields:
                  organizationRequest.defaultCostCenter.customFields,
              }),
            },
            paymentTerms,
            priceTables,
            customFields,
          },
        },
        ctx
      )

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
          costId: costCenterId,
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

      return { status: 'success', message: '', id: organizationId }
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

  return null
}
