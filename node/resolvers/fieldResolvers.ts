import GraphQLError, { getErrorMessage } from '../utils/GraphQLError'
import { describeClientError } from '../utils/clientError'
import {
  loadCostCenter,
  loadOrganization,
} from '../services/organizationDocuments'

export const organizationName = async (
  { orgId }: { orgId: string },
  _: any,
  ctx: Context
) => {
  const {
    vtex: { logger },
  } = ctx

  try {
    const organization = await loadOrganization(ctx, orgId)

    return organization.name
  } catch (error) {
    logger.error({
      error: describeClientError(error),
      message: 'getOrganizationName-error',
    })
    throw new GraphQLError(getErrorMessage(error))
  }
}

export const organizationStatus = async (
  { orgId }: { orgId: string },
  _: any,
  ctx: Context
) => {
  const {
    vtex: { logger },
  } = ctx

  try {
    const organization = await loadOrganization(ctx, orgId)

    return organization.status
  } catch (error) {
    logger.error({
      error: describeClientError(error),
      message: 'getOrganizationStatus-error',
    })
    throw new GraphQLError(getErrorMessage(error))
  }
}

export const costCenterName = async (
  { costId }: { costId: string },
  _: any,
  ctx: Context
) => {
  const {
    vtex: { logger },
  } = ctx

  try {
    const costCenter = await loadCostCenter(ctx, costId)

    return costCenter.name
  } catch (error) {
    logger.error({
      error: describeClientError(error),
      message: 'getCostCenterName-error',
    })
    throw new GraphQLError(getErrorMessage(error))
  }
}

export const role = async (
  { roleId }: { roleId: string },
  _: any,
  ctx: Context
) => {
  const {
    clients: { storefrontPermissions },
    vtex: { logger },
  } = ctx

  return storefrontPermissions
    .getRole(roleId)
    .then((result: any) => {
      return result.data.getRole
    })
    .catch((error: any) => {
      logger.error({
        error: describeClientError(error),
        message: 'getRoleError',
      })
    })
}
