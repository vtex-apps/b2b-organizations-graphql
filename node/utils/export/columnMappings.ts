import type { ExportType } from './constants'

export type ColumnTransform = 'array' | 'json' | 'default'

export interface ColumnDef {
  header: string
  field: string
  transform?: ColumnTransform
}

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/\s+/g, ' ')

const buildAliasMap = (aliases: Record<string, string>) => {
  const map: Record<string, string> = {}

  Object.entries(aliases).forEach(([alias, field]) => {
    map[normalizeHeader(alias)] = field
  })

  return map
}

export const ORGANIZATION_COLUMNS: ColumnDef[] = [
  { header: 'Id', field: 'id' },
  { header: 'Name', field: 'name' },
  { header: 'Trade Name', field: 'tradeName' },
  { header: 'Collections', field: 'collections', transform: 'array' },
  { header: 'Price Tables', field: 'priceTables', transform: 'array' },
  { header: 'Payment Terms', field: 'paymentTerms', transform: 'array' },
  { header: 'Sales Channel', field: 'salesChannel' },
  { header: 'Sellers', field: 'sellers', transform: 'array' },
  { header: 'Status', field: 'status' },
  { header: 'Created', field: 'created' },
  { header: 'Custom Fields', field: 'customFields', transform: 'json' },
]

export const COST_CENTER_COLUMNS: ColumnDef[] = [
  { header: 'Organization Id', field: 'organization' },
  { header: 'Cost Center Id', field: 'id' },
  { header: 'Name', field: 'name' },
  { header: 'Payment Terms', field: 'paymentTerms', transform: 'array' },
  { header: 'Phone Number', field: 'phoneNumber' },
  { header: 'Business Document', field: 'businessDocument' },
  { header: 'State Registration', field: 'stateRegistration' },
  { header: 'Sellers', field: 'sellers', transform: 'array' },
  { header: 'Custom Fields', field: 'customFields', transform: 'json' },
]

const ORGANIZATION_HEADER_ALIASES = buildAliasMap({
  collections: 'collections',
  created: 'created',
  'custom fields': 'customFields',
  customfields: 'customFields',
  id: 'id',
  name: 'name',
  'payment terms': 'paymentTerms',
  paymentterms: 'paymentTerms',
  'price tables': 'priceTables',
  pricetables: 'priceTables',
  'sales channel': 'salesChannel',
  saleschannel: 'salesChannel',
  sellers: 'sellers',
  status: 'status',
  'trade name': 'tradeName',
  tradename: 'tradeName',
})

const COST_CENTER_HEADER_ALIASES = buildAliasMap({
  'business document': 'businessDocument',
  businessdocument: 'businessDocument',
  'cost center id': 'id',
  costcenterid: 'id',
  'custom fields': 'customFields',
  customfields: 'customFields',
  id: 'id',
  name: 'name',
  organization: 'organization',
  'organization id': 'organization',
  organizationid: 'organization',
  'payment terms': 'paymentTerms',
  paymentterms: 'paymentTerms',
  'phone number': 'phoneNumber',
  phonenumber: 'phoneNumber',
  sellers: 'sellers',
  'state registration': 'stateRegistration',
  stateregistration: 'stateRegistration',
})

const MAPPED_EXPORT_TYPES: ExportType[] = ['organizations', 'cost_centers']

export const isMappedExportType = (exportType: ExportType) =>
  MAPPED_EXPORT_TYPES.includes(exportType)

export const getColumnMapping = (
  exportType: ExportType
): { columns: ColumnDef[]; headerAliases: Record<string, string> } | null => {
  if (exportType === 'organizations') {
    return {
      columns: ORGANIZATION_COLUMNS,
      headerAliases: ORGANIZATION_HEADER_ALIASES,
    }
  }

  if (exportType === 'cost_centers') {
    return {
      columns: COST_CENTER_COLUMNS,
      headerAliases: COST_CENTER_HEADER_ALIASES,
    }
  }

  return null
}

export const mapRowToFields = (
  rawRow: Record<string, unknown>,
  headerAliases: Record<string, string>
) => {
  const mappedRow: Record<string, unknown> = {}

  Object.entries(rawRow).forEach(([header, value]) => {
    const field = headerAliases[normalizeHeader(header)]

    if (field) {
      mappedRow[field] = value
    }
  })

  return mappedRow
}
