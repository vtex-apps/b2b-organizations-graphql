import type { Logger } from '@vtex/api/lib/service/logger/logger'
import { isEqual } from 'lodash'

import type { Organization } from '../../typings'
import type { Metric } from '../../clients/analytics'
import { B2B_METRIC_NAME } from '../../clients/analytics'

interface UpdateOrganizationFieldsMetric {
  update_details: { properties: string[] }
}

type UpdateOrganization = Metric & {
  fields: UpdateOrganizationFieldsMetric
}

export interface UpdateOrganizationParams {
  account: string
  currentOrganizationData?: Organization
  updatedProperties: Partial<Organization>
}

export interface OrganizationStatusParams {
  account: string
  status: string
}

class UpdateOrganizationMetric implements Metric {
  public readonly description = 'Update Organization Action - Graphql'
  public readonly kind = 'update-organization-graphql-event'
  public readonly account: string
  public readonly fields: UpdateOrganizationFieldsMetric
  public readonly name = B2B_METRIC_NAME

  constructor(account: string, fields: UpdateOrganizationFieldsMetric) {
    this.account = account
    this.fields = fields
  }
}

const buildUpdateOrganizationMetric = (
  account: string,
  updatedProperties: string[]
): UpdateOrganization => {
  const updateOrganizationFields: UpdateOrganizationFieldsMetric = {
    update_details: { properties: updatedProperties },
  }

  return new UpdateOrganizationMetric(account, updateOrganizationFields)
}

const getPropNamesByUpdateParams = (
  updateOrganizationParams: UpdateOrganizationParams
): string[] => {
  const updatedPropName: string[] = []

  const { currentOrganizationData, updatedProperties } =
    updateOrganizationParams

  if (!currentOrganizationData) {
    return updatedPropName
  }

  Object.entries(updatedProperties).forEach(
    ([updatedPropertyKey, updatedPropertyValue]) => {
      if (
        !isEqual(
          updatedPropertyValue,
          currentOrganizationData[updatedPropertyKey as keyof Organization]
        )
      ) {
        updatedPropName.push(updatedPropertyKey)
      }
    }
  )

  return updatedPropName
}

export const sendUpdateOrganizationMetric = async (
  ctx: Context,
  logger: Logger,
  updateOrganizationParams: UpdateOrganizationParams
) => {
  const {
    clients: { analytics },
  } = ctx

  try {
    const fieldsNamesUpdated = getPropNamesByUpdateParams(
      updateOrganizationParams
    )

    const metric = buildUpdateOrganizationMetric(
      updateOrganizationParams.account,
      fieldsNamesUpdated
    )

    await analytics.sendMetric(metric)
  } catch (error) {
    logger.error({
      error,
      message: 'Error to send metrics from updateOrganization',
    })
  }
}

export const sendOrganizationStatusMetric = async (
  ctx: Context,
  logger: Logger,
  statusParams: OrganizationStatusParams
) => {
  const {
    clients: { analytics },
  } = ctx

  try {
    await analytics.sendMetric({
      account: statusParams.account,
      description: 'Change Organization Status Action - Graphql',
      fields: {
        status: statusParams.status,
      },
      kind: 'change-organization-status-graphql-event',
      name: B2B_METRIC_NAME,
    } as unknown as Metric)
  } catch (error) {
    logger.error({
      error,
      message: 'Error to send metrics from organization status change',
    })
  }
}
