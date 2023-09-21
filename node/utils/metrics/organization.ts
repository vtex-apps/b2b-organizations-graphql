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

const buildUpdateOrganizationMetric = (
  account: string,
  updatedProperties: string[]
): UpdateOrganization => {
  const updateOrganizationFields: UpdateOrganizationFieldsMetric = {
    update_details: { properties: updatedProperties },
  }

  return {
    account,
    description: 'Update Organization Action - Graphql',
    fields: updateOrganizationFields,
    kind: 'update-organization-graphql-event',
    name: 'b2b-suite-buyerorg-data',
  } as UpdateOrganization
}

const getFieldsNamesByFieldsUpdated = (
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
      if (updatedPropertyValue instanceof Array) {
        // I tried to compare the objects value !== currentOrganizationData[key as keyof Organization,
        // but it was not working, so I use JSON.stringify
        if (
          JSON.stringify(updatedPropertyValue) !==
          JSON.stringify(
            currentOrganizationData[updatedPropertyKey as keyof Organization]
          )
        ) {
          updatedPropName.push(updatedPropertyKey)
        }
      } else if (
        updatedPropertyValue !==
        currentOrganizationData[updatedPropertyKey as keyof Organization]
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
