import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { Metric } from './metrics'
import { sendMetric } from './metrics'

interface UpdateOrganizationFieldsMetric {
  update_details: { properties: string[] }
}

type UpdateOrganization = Metric & {
  fields: UpdateOrganizationFieldsMetric
}

const buildUpdateOrganizationMetric = (
  updatedProperties: string[]
): UpdateOrganization => {
  const updateOrganizationFields: UpdateOrganizationFieldsMetric = {
    update_details: { properties: updatedProperties },
  }

  return {
    description: 'Update Organization Action - Graphql',
    fields: updateOrganizationFields,
    kind: 'update-organization-graphql-event',
  } as UpdateOrganization
}

const getFieldsNamesByFieldsUpdated = (
  currentOrganizationData: Organization,
  updatedProperties: UpdatedOrganizationProps
): string[] => {
  const updatedPropName: string[] = []

  for (const key in updatedProperties) {
    if (Object.prototype.hasOwnProperty.call(updatedProperties, key)) {
      const value = updatedProperties[key as keyof typeof updatedProperties]

      // I tried to compare the objects value !== currentOrganizationData[key as keyof Organization,
      // but it was not working, so I use JSON.stringify
      if (
        JSON.stringify(value) !==
        JSON.stringify(currentOrganizationData[key as keyof Organization])
      ) {
        updatedPropName.push(key)
      }
    }
  }

  return updatedPropName
}

export interface UpdatedOrganizationProps {
  priceTables: any[]
  collections: any[]
  customFields: any[]
  name: string
  paymentTerms: any[]
  salesChannel?: string
  sellers?: any[]
  status: string
  tradeName?: string
}

export const sendUpdateOrganizationMetric = async (
  logger: Logger,
  fieldsUpdated: UpdatedOrganizationProps,
  currentOrganizationData: Organization
) => {
  try {
    const fieldsNamesUpdated = getFieldsNamesByFieldsUpdated(
      currentOrganizationData,
      fieldsUpdated
    )

    const metric = buildUpdateOrganizationMetric(fieldsNamesUpdated)

    await sendMetric(metric)
  } catch (error) {
    logger.error({
      error,
      message: 'Error to send metrics from updateOrganization',
    })
  }
}
