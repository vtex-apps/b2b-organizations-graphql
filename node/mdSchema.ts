export const ORGANIZATION_REQUEST_DATA_ENTITY = 'organization_requests'
export const ORGANIZATION_REQUEST_FIELDS = [
  'id',
  'name',
  'tradeName',
  'defaultCostCenter',
  'b2bCustomerAdmin',
  'status',
  'notes',
  'created',
]
export const ORGANIZATION_REQUEST_SCHEMA_VERSION = 'v0.0.5'

export const ORGANIZATION_DATA_ENTITY = 'organizations'
export const ORGANIZATION_FIELDS = [
  'id',
  'name',
  'tradeName',
  'collections',
  'paymentTerms',
  'priceTables',
  'costCenters',
  'status',
  'created',
]
export const ORGANIZATION_SCHEMA_VERSION = 'v0.0.7'

export const COST_CENTER_DATA_ENTITY = 'cost_centers'
export const COST_CENTER_FIELDS = [
  'id',
  'name',
  'addresses',
  'paymentTerms',
  'organization',
  'phoneNumber',
  'businessDocument',
]
export const COST_CENTER_SCHEMA_VERSION = 'v0.0.6'

export const B2B_SETTINGS_DATA_ENTITY = 'b2b_settings'
export const B2B_SETTINGS_FIELDS = [
  'id',
  'autoApprove',
  'defaultPaymentTerms',
  'defaultPriceTables'
]
export const B2B_SETTINGS_SCHEMA_VERSION = 'v0.0.8'

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
        costCenters: {
          // deprecated
          type: 'array',
          title: 'Cost Centers',
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
        phoneNumber: {
          type: ['string', 'null'],
          title: 'Phone Number',
        },
      },
      'v-indexed': ['name', 'organization', 'businessDocument'],
      'v-immediate-indexing': true,
      'v-cache': false,
    },
  },
  {
    name: B2B_SETTINGS_DATA_ENTITY,
    version: B2B_SETTINGS_SCHEMA_VERSION,
    body: {
      properties: {
        autoApprove: {
          type: 'boolean',
          title: 'Auto Approve',
        },
        defaultPaymentTerms: {
          type: 'array',
          title: 'Default Payment Terms',
        },
        defaultPriceTables: {
          type: 'array',
          title: 'Default Price Tables',
        },
      },
      'v-indexed': ['autoApprove', 'defaultPaymentTerms', 'defaultPriceTables'],
      'v-immediate-indexing': true,
      'v-cache': false,
    },
  },
]
