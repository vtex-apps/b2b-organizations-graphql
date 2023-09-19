import { randWord } from '@ngneat/falso'
import type { Logger } from '@vtex/api/lib/service/logger/logger'

import type { Seller } from '../../clients/sellers'
import { sendMetric } from './metrics'
import { sendUpdateOrganizationMetric } from './organization'

jest.mock('./metrics')
afterEach(() => {
  jest.resetAllMocks()
})

describe('given an organization to update data', () => {
  describe('when change all properties data', () => {
    const logger = jest.fn() as unknown as Logger

    const currentOrganization: Organization = {
      collections: [{ name: randWord() } as Collection],
      costCenters: [],
      created: randWord(),
      customFields: [{ name: randWord() } as CustomField],
      id: randWord(),
      name: randWord(),
      paymentTerms: [{ name: randWord() } as PaymentTerm],
      priceTables: [{ name: randWord() } as Price],
      salesChannel: randWord(),
      sellers: [{ name: randWord() } as Seller],
      status: randWord(),
      tradeName: randWord(),
    }

    const fieldsUpdated = {
      collections: [randWord()],
      customFields: [randWord()],
      name: randWord(),
      paymentTerms: [randWord()],
      priceTables: [randWord()],
      salesChannel: randWord(),
      sellers: [randWord()],
      status: randWord(),
      tradeName: randWord(),
    }

    beforeEach(async () => {
      await sendUpdateOrganizationMetric(
        logger,
        fieldsUpdated,
        currentOrganization
      )
    })

    it('should metric the all properties changed', () => {
      const metricParam = {
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
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })

  describe('when no change properties data', () => {
    const logger = jest.fn() as unknown as Logger

    const collections = [{ name: randWord() } as Collection]
    const customFields = [{ name: randWord() } as CustomField]
    const name = randWord()
    const paymentTerms = [{ name: randWord() } as PaymentTerm]
    const priceTables = [{ name: randWord() } as Price]
    const salesChannel = randWord()
    const sellers = [{ name: randWord() } as Seller]
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

    beforeEach(async () => {
      await sendUpdateOrganizationMetric(
        logger,
        fieldsUpdated,
        currentOrganization
      )
    })

    it('should metric no properties changed', () => {
      const metricParam = {
        description: 'Update Organization Action - Graphql',
        fields: {
          update_details: {
            properties: [],
          },
        },
        kind: 'update-organization-graphql-event',
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })
  describe('when just the name, status and tradeName', () => {
    const logger = jest.fn() as unknown as Logger

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

    beforeEach(async () => {
      await sendUpdateOrganizationMetric(
        logger,
        fieldsUpdated,
        currentOrganization
      )
    })

    it('should metric just the properties changed', () => {
      const metricParam = {
        description: 'Update Organization Action - Graphql',
        fields: {
          update_details: {
            properties: ['name', 'status', 'tradeName'],
          },
        },
        kind: 'update-organization-graphql-event',
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })
})
