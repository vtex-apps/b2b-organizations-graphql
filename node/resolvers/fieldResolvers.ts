import GraphQLError from '../utils/GraphQLError'
import {
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_FIELDS,
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_FIELDS,
} from '../mdSchema'

const QUERIES = {
  getRole: `query role($id: ID!) {
    getRole(id: $id) @context(provider: "vtex.storefront-permissions") {
        id
        name
        slug
    }
  }`,
}

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
  } catch (e) {
    logger.error({
      message: 'getOrganizationName-error',
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
  } catch (e) {
    logger.error({
      message: 'getCostCenterName-error',
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
}

export const role = async (
  { roleId }: { roleId: string },
  _: any,
  ctx: Context
) => {
  const {
    clients: { graphQLServer },
    vtex: { logger },
  } = ctx

  const roleData = await graphQLServer
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
      return result.data.getRole
    })
    .catch((error: any) => {
      console.error(error)
      logger.error({
        message: 'getRoleError',
        error,
      })
    })

  return roleData
}
