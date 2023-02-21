import { organizationAcceptedMessage } from './organizationAccepted'
import { organizationCreatedMessage } from './organizationCreated'
import { organizationDeclinedMessage } from './organizationDeclined'
import { organizationStatusChangedMessage } from './organizationStatusChanged'
import { organizationRequestCreatedMessage } from './organizationRequestCreated'

const templates = [
  organizationCreatedMessage,
  organizationAcceptedMessage,
  organizationDeclinedMessage,
  organizationStatusChangedMessage,
  organizationRequestCreatedMessage,
]

export default templates
