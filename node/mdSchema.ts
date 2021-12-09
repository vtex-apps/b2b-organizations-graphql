export const ORGANIZATION_REQUEST_DATA_ENTITY = 'organization_requests'
export const ORGANIZATION_REQUEST_FIELDS = [
  'id',
  'name',
  'defaultCostCenter',
  'b2bCustomerAdmin',
  'status',
  'notes',
  'created',
]
export const ORGANIZATION_REQUEST_SCHEMA_VERSION = 'v0.0.3'

export const ORGANIZATION_DATA_ENTITY = 'organizations'
export const ORGANIZATION_FIELDS = [
  'id',
  'name',
  'collections',
  'paymentTerms',
  'priceTables',
  'costCenters',
  'status',
  'created',
]
export const ORGANIZATION_SCHEMA_VERSION = 'v0.0.5'

export const COST_CENTER_DATA_ENTITY = 'cost_centers'
export const COST_CENTER_FIELDS = [
  'id',
  'name',
  'addresses',
  'paymentTerms',
  'organization',
]
export const COST_CENTER_SCHEMA_VERSION = 'v0.0.3'

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
        defaultCostCenter: {
          type: 'object',
          title: 'Default Cost Center',
        },
        b2bCustomerAdmin: {
          type: 'object',
          title: 'B2B Customer Admin',
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
      'v-indexed': ['name', 'status', 'created'],
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
        // we probably don't need this
        costCenters: {
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
      'v-indexed': ['name', 'status'],
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
      },
      'v-indexed': ['name', 'organization'],
      'v-cache': false,
    },
  },
]
