import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
} from '../mdSchema'
import GraphQLError, { getErrorMessage } from '../utils/GraphQLError'

export const organizationName = async (
  { orgId }: { orgId: string },
  _: any,
  ctx: Context
) => {
  const {
    clients: { masterdata },
    vtex: { logger },
  } = ctx

  try {
    const organization: Organization = await masterdata.getDocument({
      dataEntity: ORGANIZATION_DATA_ENTITY,
      fields: ORGANIZATION_FIELDS,
      id: orgId,
    })

    return organization.name
  } catch (error) {
    logger.error({
      error,
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
    clients: { masterdata },
    vtex: { logger },
  } = ctx

  try {
    const organization: Organization = await masterdata.getDocument({
      dataEntity: ORGANIZATION_DATA_ENTITY,
      fields: ORGANIZATION_FIELDS,
      id: orgId,
    })

    return organization.status
  } catch (error) {
    logger.error({
      error,
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
    clients: { masterdata },
    vtex: { logger },
  } = ctx

  try {
    const costCenter: CostCenter = await masterdata.getDocument({
      dataEntity: COST_CENTER_DATA_ENTITY,
      fields: COST_CENTER_FIELDS,
      id: costId,
    })

    return costCenter.name
  } catch (error) {
    logger.error({
      error,
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
        error,
        message: 'getRoleError',
      })
    })
}
