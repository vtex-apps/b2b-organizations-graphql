import {
  randAirportName,
  randAlpha,
  randAlphaNumeric,
  randCompanyName,
  randFirstName,
  randFullName,
  randLastName,
  randPastDate,
  randStatus,
  randSuperheroName,
  randWord,
} from '@ngneat/falso'
import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { Seller } from '../../clients/sellers'
import { ORGANIZATION_REQUEST_STATUSES } from '../constants'
import { B2B_METRIC_NAME } from '../../clients/analytics'
import type {
  OrganizationStatusParams,
  UpdateOrganizationParams,
} from './organization'
import {
  sendOrganizationStatusMetric,
  sendUpdateOrganizationMetric,
} from './organization'
import type {
  Collection,
  CustomField,
  Organization,
  PaymentTerm,
} from '../../typings'

const mockContext = () => {
  return {
    clients: {
      analytics: {
        sendMetric: jest.fn(),
      },
    },
  } as unknown as Context
}

afterEach(() => {
  jest.resetAllMocks()
})

describe('given an organization to update data', () => {
  describe('when change all properties', () => {
    const context = mockContext()

    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const currentOrganization: Organization = {
      collections: [{ name: randWord() } as Collection],
      costCenters: [],
      created: randPastDate().toISOString(),
      customFields: [{ name: randWord() } as CustomField],
      id: randAlphaNumeric().toString(),
      name: randCompanyName(),
      paymentTerms: [{ name: randAlphaNumeric() } as PaymentTerm],
      priceTables: [randAlpha()],
      salesChannel: randAlpha(),
      sellers: [{ name: randFullName() } as Seller],
      status: randAlpha(),
      tradeName: randCompanyName(),
    }

    const fieldsUpdated: Partial<Organization> = {
      collections: [{ name: randSuperheroName() } as Collection],
      costCenters: [],
      customFields: [{ name: randAirportName() } as CustomField],
      name: randCompanyName(),
      paymentTerms: [{ name: randLastName() } as PaymentTerm],
      priceTables: [randFirstName()],
      salesChannel: randAirportName(),
      sellers: [{ name: randFullName() } as Seller],
      status: randStatus(),
      tradeName: randCompanyName(),
    }

    const updateOrganizationParams: UpdateOrganizationParams = {
      account,
      currentOrganizationData: currentOrganization,
      updatedProperties: fieldsUpdated,
    }

    beforeEach(async () => {
      await sendUpdateOrganizationMetric(
        context,
        logger,
        updateOrganizationParams
      )
    })

    it('should metrify that all properties changed', () => {
      const metricParam = {
        account,
        description: 'Update Organization Action - Graphql',
        fields: {
          update_details: {
            properties: [
              'collections',
              'customFields',
              'name',
              'paymentTerms',
              'priceTables',
              'salesChannel',
              'sellers',
              'status',
              'tradeName',
            ],
          },
        },
        kind: 'update-organization-graphql-event',
        name: B2B_METRIC_NAME,
      }

      expect(context.clients.analytics.sendMetric).toHaveBeenCalledWith(
        metricParam
      )
    })
  })

  describe('when no change properties data', () => {
    const context = mockContext()

    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const collections = [{ name: randWord() } as Collection]
    const customFields = [{ name: randWord() } as CustomField]
    const name = randWord()
    const paymentTerms = [{ name: randWord() } as PaymentTerm]
    const priceTables = [randWord()]
    const salesChannel = randWord()
    const sellers = [{ name: randFullName() } as Seller]
    const status = randWord()
    const tradeName = randWord()

    const currentOrganization: Organization = {
      collections,
      costCenters: [],
      created: randWord(),
      customFields,
      id: randWord(),
      name,
      paymentTerms,
      priceTables,
      salesChannel,
      sellers,
      status,
      tradeName,
    }

    const fieldsUpdated = {
      collections,
      customFields,
      name,
      paymentTerms,
      priceTables,
      salesChannel,
      sellers,
      status,
      tradeName,
    }

    const updateOrganizationParams: UpdateOrganizationParams = {
      account,
      currentOrganizationData: currentOrganization,
      updatedProperties: fieldsUpdated,
    }

    beforeEach(async () => {
      await sendUpdateOrganizationMetric(
        context,
        logger,
        updateOrganizationParams
      )
    })

    it('should metric no properties changed', () => {
      const metricParam = {
        account,
        description: 'Update Organization Action - Graphql',
        fields: {
          update_details: {
            properties: [],
          },
        },
        kind: 'update-organization-graphql-event',
        name: B2B_METRIC_NAME,
      }

      expect(context.clients.analytics.sendMetric).toHaveBeenCalledWith(
        metricParam
      )
    })
  })
  describe('when just the name, status and tradeName', () => {
    const context = mockContext()

    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const currentOrganization: Organization = {
      collections: [{ id: '149', name: 'Teste 2 Jay' }],
      costCenters: [],
      created: '2023-05-26T17:59:51.665Z',
      customFields: [],
      id: '166d3921-fbef-11ed-83ab-16759f4a0add',
      name: 'Antes',
      paymentTerms: [],
      priceTables: [],
      salesChannel: '1',
      sellers: [],
      status: 'inactive',
      tradeName: 'Antes',
    }

    const fieldsUpdated = {
      collections: [{ id: '149', name: 'Teste 2 Jay' }],
      customFields: [],
      name: 'Depois',
      paymentTerms: [],
      priceTables: [],
      salesChannel: '1',
      sellers: [],
      status: 'active',
      tradeName: 'Depois',
    }

    const updateOrganizationParams: UpdateOrganizationParams = {
      account,
      currentOrganizationData: currentOrganization,
      updatedProperties: fieldsUpdated,
    }

    beforeEach(async () => {
      await sendUpdateOrganizationMetric(
        context,
        logger,
        updateOrganizationParams
      )
    })

    it('should metric just the properties changed', () => {
      const metricParam = {
        account,
        description: 'Update Organization Action - Graphql',
        fields: {
          update_details: {
            properties: ['name', 'status', 'tradeName'],
          },
        },
        kind: 'update-organization-graphql-event',
        name: B2B_METRIC_NAME,
      }

      expect(context.clients.analytics.sendMetric).toHaveBeenCalledWith(
        metricParam
      )
    })
  })

  describe('when need to update status', () => {
    const context = mockContext()

    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const updateOrganizationParams: OrganizationStatusParams = {
      account,
      status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
    }

    beforeEach(async () => {
      await sendOrganizationStatusMetric(
        context,
        logger,
        updateOrganizationParams
      )
    })

    it('should metrify the status changed', () => {
      const metricParam = {
        account,
        description: 'Change Organization Status Action - Graphql',
        fields: {
          status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
        },
        kind: 'change-organization-status-graphql-event',
        name: B2B_METRIC_NAME,
      }

      expect(context.clients.analytics.sendMetric).toHaveBeenCalledWith(
        metricParam
      )
    })
  })
})
