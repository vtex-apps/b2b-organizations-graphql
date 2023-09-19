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
  currentOrganizationData: Organization
  updatedProperties: UpdatedOrganizationProps
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
