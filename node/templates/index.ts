import { organizationAcceptedMessage } from './organizationAccepted'
import { organizationCreatedMessage } from './organizationCreated'
import { organizationDeclinedMessage } from './organizationDeclined'
import { organizationStatusChangedMessage } from './organizationStatusChanged'

const templates = [
  organizationCreatedMessage,
  organizationAcceptedMessage,
  organizationDeclinedMessage,
  organizationStatusChangedMessage,
]

export default templates
