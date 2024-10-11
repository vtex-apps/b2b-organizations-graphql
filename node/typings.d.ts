import type { Logger } from '@vtex/api/lib/service/logger/logger'

interface ReqContext {
  account: string
  workspace: string
  authToken: string
  region: string
  production: boolean
  userAgent: string
}

interface OperationState {
  orderFormId: string
  ctx: ReqContext
  data?: OperationData
  logger: Logger
}

interface OperationData {
  orderForm?: any
  userProfileId: string
  cookie: string
}

type ProcessPaymentStep = (
  state: OperationState,
  next: () => Promise<void>
) => Promise<void>

type LogLevel = 'info' | 'error' | 'warning'

type Timings = { [middleware: string]: [number, number] }

declare module '*.json' {
  const value: any
  export default value
}
interface Seller {
  id: string
  name: string
}

interface OrganizationInput {
  id?: string
  name: string
  tradeName?: string
  b2bCustomerAdmin: B2BCustomerInput
  defaultCostCenter?: DefaultCostCenterInput
  costCenters?: DefaultCostCenterInput[]
  customFields?: CustomField[]
  paymentTerms?: PaymentTerm[]
  priceTables?: Price[]
  salesChannel?: string
  sellers?: Seller[]
  collections?: Collection[]
}

interface NormalizedOrganizationInput {
  id?: string
  name: string
  tradeName?: string
  b2bCustomerAdmin: B2BCustomerInput
  defaultCostCenter?: DefaultCostCenterInput
  costCenters?: DefaultCostCenterInput[]
  customFields?: CustomField[]
  paymentTerms?: string[]
  priceTables?: Price[]
  salesChannel?: string
  sellers?: string[]
  collections?: string[]
}

interface B2BCustomerInput {
  firstName: string
  lastName: string
  email: string
}

interface DefaultCostCenterInput {
  id?: string
  name: string
  address: AddressInput
  phoneNumber?: string
  businessDocument?: string
  customFields?: CustomField[]
  stateRegistration?: string
  sellers?: Seller[]
  marketingTags?: string[]
  user?: B2BUserInput
}

interface CostCenterInput {
  id?: string
  name: string
  addresses?: AddressInput[]
  paymentTerms?: PaymentTerm[]
  phoneNumber?: string
  businessDocument?: string
  customFields?: CustomField[]
  stateRegistration?: string
  marketingTags?: string[]
  user?: B2BCustomerInput
  sellers?: Seller[]
}

interface CostCenterInputWithId {
  id: string
  name: string
  addresses?: AddressInput[]
  paymentTerms?: PaymentTerm[]
  phoneNumber?: string
  businessDocument?: string
  customFields?: CustomField[]
  stateRegistration?: string
  marketingTags?: string[]
  user?: B2BCustomerInput
  sellers?: Seller[]
}

interface AddressInput {
  addressId: string
  addressType: string
  postalCode: string
  country: string
  receiverName: string
  city: string
  state: string
  street: string
  number: string
  complement: string
  neighborhood: string
  geoCoordinates: [number]
}

interface OrganizationRequest {
  costCenters: DefaultCostCenterInput[]
  name: string
  tradeName?: string
  defaultCostCenter: DefaultCostCenterInput
  b2bCustomerAdmin: B2BCustomerInput
  status: string
  created: string
  paymentTerms?: PaymentTerm[]
  priceTables?: Price[]
  salesChannel?: string
  sellers?: Seller[]
  customFields?: CustomField[]
}

interface Organization {
  id: string
  name: string
  tradeName?: string
  collections: Collection[]
  costCenters: string[]
  paymentTerms: PaymentTerm[]
  priceTables?: string[]
  permissions?: Permissions
  status: string
  created: string
  customFields?: CustomField[]
  salesChannel?: string
  sellers?: Seller[]
}

interface Collection {
  id: string
  name: string
}

interface CostCenter {
  id: string
  name: string
  organization: string
  addresses: Address[]
  paymentTerms: PaymentTerm[]
  salesChannel: string
  priceTables: Price[]
  phoneNumber?: string
  businessDocument?: string
  customFields: CustomField[]
}

interface Address {
  addressId: string
  addressType: string
  addressQuery: string
  postalCode: string
  country: string
  receiverName: string
  city: string
  state: string
  street: string
  number: string
  complement: string
  neighborhood: string
  geoCoordinates: number[]
  reference: string
  checked?: boolean
}

interface B2BSettings {
  autoApprove: boolean
  businessReadOnly: boolean
  stateReadOnly: boolean
  defaultPaymentTerms: PaymentTerm[]
  defaultPriceTables: [string]
  organizationCustomFields: SettingsCustomField[]
  costCenterCustomFields: SettingsCustomField[]
}

interface UserArgs {
  id?: string
  roleId: string
  userId?: string
  orgId?: string
  costId?: string
  clId?: string
  canImpersonate?: boolean
  name: string
  email: string
}

interface PaymentTerm {
  name: string
  id: string
}

interface Price {
  name: string
  id: string
}

interface TopBarSetting {
  name: string
  hexColor: string
}

interface UISettings {
  showModal: boolean
  clearCart: boolean
  topBar?: TopBarSetting | null
}

interface CustomField {
  name: string
  type: 'text' | 'dropdown'
  value: string
  dropdownValues?: Array<{ label: string; value: string }> | null
  useOnRegistration?: boolean
}

interface SettingsCustomField {
  name: string
  type: 'text' | 'dropdown'
  dropdownValues?: Array<{ label: string; value: string }> | null
  useOnRegistration?: boolean
}

interface CustomFieldSetting {
  name: string
  type: 'text' | 'dropdown'
}

interface TransactionEmailSetting {
  organizationCreated: boolean
  organizationApproved: boolean
  organizationDeclined: boolean
  organizationStatusChanged: boolean
  organizationRequestCreated: boolean
}

interface B2BSettingsInput {
  autoApprove: boolean
  businessReadOnly: boolean
  stateReadOnly: boolean
  defaultPaymentTerms: PaymentTerm[]
  defaultPriceTables: Price[]
  uiSettings: UISettings
  organizationCustomFields: CustomFieldSetting[]
  costCenterCustomFields: CustomFieldSetting[]
  transactionEmailSettings: TransactionEmailSetting
}

interface Result {
  href: string
  id: string
  status: string
}
