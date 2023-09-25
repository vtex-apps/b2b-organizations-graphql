import type { Logger } from '@vtex/api/lib/service/logger/logger'
import { isEqual } from 'lodash'

import type { Metric } from './metrics'
import { sendMetric } from './metrics'

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

class UpdateOrganizationMetric implements Metric {
  public readonly description = 'Update Organization Action - Graphql'
  public readonly kind = 'update-organization-graphql-event'
  public readonly account: string
  public readonly fields: UpdateOrganizationFieldsMetric
  public readonly name = 'b2b-suite-buyerorg-data'

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
  logger: Logger,
  updateOrganizationParams: UpdateOrganizationParams
) => {
  try {
    const fieldsNamesUpdated = getPropNamesByUpdateParams(
      updateOrganizationParams
    )

    const metric = buildUpdateOrganizationMetric(
      updateOrganizationParams.account,
      fieldsNamesUpdated
    )

    await sendMetric(metric)
  } catch (error) {
    logger.error({
      error,
      message: 'Error to send metrics from updateOrganization',
    })
  }
}
