export const ORGANIZATION_REQUEST_DATA_ENTITY = 'organization_requests'
export const ORGANIZATION_REQUEST_FIELDS = [
  'id',
  'name',
  'tradeName',
  'defaultCostCenter',
  'b2bCustomerAdmin',
  'costCenters',
  'status',
  'notes',
  'created',
  'priceTables',
  'paymentTerms',
  'salesChannel',
  'sellers',
  'customFields',
]
export const ORGANIZATION_REQUEST_SCHEMA_VERSION = 'v0.1.1'

export const ORGANIZATION_DATA_ENTITY = 'organizations'
export const ORGANIZATION_FIELDS = [
  'id',
  'name',
  'tradeName',
  'collections',
  'paymentTerms',
  'priceTables',
  'salesChannel',
  'costCenters',
  'sellers',
  'status',
  'created',
  'customFields',
]
export const ORGANIZATION_SCHEMA_VERSION = 'v0.0.8'

export const COST_CENTER_DATA_ENTITY = 'cost_centers'
export const COST_CENTER_FIELDS = [
  'id',
  'name',
  'addresses',
  'paymentTerms',
  'organization',
  'phoneNumber',
  'businessDocument',
  'customFields',
  'stateRegistration',
  'sellers',
]
export const COST_CENTER_SCHEMA_VERSION = 'v0.0.8'

export const schemas = [
  {
    name: ORGANIZATION_REQUEST_DATA_ENTITY,
    version: ORGANIZATION_REQUEST_SCHEMA_VERSION,
    body: {
      properties: {
        name: {
          type: 'string',
          title: 'Name',
        },
        tradeName: {
          type: ['string', 'null'],
          title: 'Trade Name',
        },
        defaultCostCenter: {
          type: 'object',
          title: 'Default Cost Center',
        },
        b2bCustomerAdmin: {
          type: 'object',
          title: 'B2B Customer Admin',
          properties: {
            email: {
              type: 'string',
            },
          },
          'v-indexed': ['email'],
        },
        costCenters: {
          type: 'array',
          title: 'All Cost Centers',
        },
        status: {
          type: 'string',
          title: 'Status',
        },
        notes: {
          type: 'string',
          title: 'Notes',
        },
        created: {
          type: 'string',
          title: 'Created',
          format: 'date-time',
        },
        priceTables: {
          type: 'array',
          title: 'Price Tables',
        },
        paymentTerms: {
          type: 'array',
          title: 'Payment Terms',
        },
        salesChannel: {
          type: ['string', 'null'],
          title: 'Sales Channel',
        },
        customFields: {
          type: 'array',
          title: 'Custom Fields',
        },
      },
      'v-indexed': ['name', 'b2bCustomerAdmin', 'status', 'created'],
      'v-immediate-indexing': true,
      'v-cache': false,
    },
  },
  {
    name: ORGANIZATION_DATA_ENTITY,
    version: ORGANIZATION_SCHEMA_VERSION,
    body: {
      properties: {
        name: {
          type: 'string',
          title: 'Name',
        },
        tradeName: {
          type: ['string', 'null'],
          title: 'Trade Name',
        },
        collections: {
          type: 'array',
          title: 'Collections',
        },
        paymentTerms: {
          type: 'array',
          title: 'Payment Terms',
        },
        priceTables: {
          type: 'array',
          title: 'Price Tables',
        },
        salesChannel: {
          type: ['string', 'null'],
          title: 'Sales Channel',
        },
        costCenters: {
          type: 'array',
          title: 'Cost Centers',
        },
        sellers: {
          type: ['array', 'null'],
          title: 'Sellers',
        },
        status: {
          type: 'string',
          title: 'Status',
        },
        created: {
          type: 'string',
          title: 'Created',
          format: 'date-time',
        },
        customFields: {
          type: 'array',
          title: 'Custom Fields',
        },
      },
      'v-indexed': ['name', 'status', 'created'],
      'v-immediate-indexing': true,
      'v-cache': false,
    },
  },
  {
    name: COST_CENTER_DATA_ENTITY,
    version: COST_CENTER_SCHEMA_VERSION,
    body: {
      properties: {
        name: {
          type: 'string',
          title: 'Name',
        },
        addresses: {
          type: 'array',
          title: 'Addresses',
        },
        paymentTerms: {
          type: 'array',
          title: 'Payment Terms',
        },
        organization: {
          type: 'string',
          title: 'Organization',
        },
        businessDocument: {
          type: ['string', 'null'],
          title: 'Business Document',
        },
        stateRegistration: {
          type: ['string', 'null'],
          title: 'State Registration',
        },
        phoneNumber: {
          type: ['string', 'null'],
          title: 'Phone Number',
        },
        customFields: {
          type: ['array', 'null'],
          title: 'Custom Fields',
        },
        sellers: {
          type: ['array', 'null'],
          title: 'Sellers',
        },
      },
      'v-indexed': [
        'name',
        'organization',
        'businessDocument',
        'stateRegistration',
      ],
      'v-immediate-indexing': true,
      'v-cache': false,
    },
  },
]
