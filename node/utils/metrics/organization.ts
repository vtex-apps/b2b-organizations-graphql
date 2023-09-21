import type { Logger } from '@vtex/api/lib/service/logger/logger'

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

const getFieldsNamesByFieldsUpdated = (
  updateOrganizationParams: UpdateOrganizationParams
): string[] => {
  const updatedPropName: string[] = []

  const { currentOrganizationData, updatedProperties } =
    updateOrganizationParams

  for (const key in updatedProperties) {
    if (Object.prototype.hasOwnProperty.call(updatedProperties, key)) {
      const value = updatedProperties[key as keyof typeof updatedProperties]

      // I tried to compare the objects value !== currentOrganizationData[key as keyof Organization,
      // but it was not working, so I use JSON.stringify
      if (
        JSON.stringify(value) !==
        JSON.stringify(
          !currentOrganizationData ||
            currentOrganizationData[key as keyof Organization]
        )
      ) {
        updatedPropName.push(key)
      }
    }
  }

  return updatedPropName
}

export const sendUpdateOrganizationMetric = async (
  logger: Logger,
  updateOrganizationParams: UpdateOrganizationParams
) => {
  try {
    const fieldsNamesUpdated = getFieldsNamesByFieldsUpdated(
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
