export const PROMISSORY_CONNECTOR = {
  PROMISSORY: 'Vtex.PaymentGateway.Connectors.PromissoryConnector',
} as const

export const CREDIT_CARDS = [
  'Visa',
  'Mastercard',
  'Diners',
  'American Express',
  'Hipercard',
  'Discover',
  'Aura',
  'Elo',
  'Banricompras',
  'JCB',
  'Cabal',
  'Nativa',
  'Naranja',
  'Nevada',
  'Shopping',
  'Credz',
]

export const enum StatusAddUserError {
  DUPLICATED = 'duplicated',
  DUPLICATED_ORGANIZATION = 'duplicated-organization',
  ERROR = 'error',
}

export const enum MessageSFPUserAddError {
  DUPLICATED = 'already exists in another organization',
  DUPLICATED_ORGANIZATION = 'already exists in the organization',
}

export const LICENSE_MANAGER_ROLES = {
  B2B_ORGANIZATIONS_VIEW: 'buyer_organization_view',
} as const
