import * as casual from 'casual'
import {
  anything,
  capture,
  instance,
  mock,
  reset,
  spy,
  verify,
  when,
} from 'ts-mockito'

import type { Clients } from '../../clients'
import { ORGANIZATION_REQUEST_STATUSES } from '../../utils/constants'
import type { Settings } from '../config'
import Config from '../config'
import B2BSettings from '../Queries/Settings'
import Organizations from './Organizations'

const orgId = casual.uuid
const stateRegistration = casual.word
const spyOrganizations = spy(Organizations)
const spyB2BSettings = spy(B2BSettings)
const mockedMasterdata = mock<Clients['masterdata']>()
const mockedStorefrontPermissions = mock<Clients['storefrontPermissions']>()
const mockedContext = ({
  clients: {
    masterdata: instance(mockedMasterdata),
    storefrontPermissions: instance(mockedStorefrontPermissions),
  },
  vtex: {
    logger: mock<Logger>(),
  },
} as unknown) as Context

afterAll(() => {
  jest.resetAllMocks()
  reset(spyB2BSettings)
  reset(spyOrganizations)
  reset(mockedMasterdata)
  reset(mockedStorefrontPermissions)
})

function mockConfigsAndSettings() {
  when(
    spyB2BSettings.getB2BSettings(anything(), anything(), anything())
  ).thenResolve({} as B2BSettingsInput)

  const spyConfig = spy(Config)

  when(spyConfig.checkConfig(anything())).thenResolve({} as Settings)
}

function mockOrganizationsToUpdateOrganization() {
  when(
    spyOrganizations.createOrganization(anything(), anything(), anything())
  ).thenResolve({
    costCenterId: undefined,
    href: '',
    id: orgId,
    status: '',
  })
}

function mockMasterdataOperationsToUpdateOrganization() {
  when(mockedMasterdata.getDocument(anything())).thenResolve({
    b2bCustomerAdmin: {
      email: casual.email,
      firstName: casual.first_name,
      lastName: casual.last_name,
    },
    defaultCostCenter: {
      address: {},
      stateRegistration,
    },
    status: ORGANIZATION_REQUEST_STATUSES.PENDING,
  } as OrganizationRequest)

  when(mockedMasterdata.searchDocuments(anything())).thenResolve({} as any)
  when(mockedMasterdata.createDocument(anything())).thenResolve({
    DocumentId: casual.uuid,
  } as any)

  when(mockedMasterdata.updatePartialDocument(anything())).thenResolve()
}

function mockStorefrontPermissionsOperationsToUpdateOrganization() {
  when(mockedStorefrontPermissions.listRoles()).thenResolve({
    data: { listRoles: [{ id: casual.uuid, slug: 'customer-admin' }] },
  })

  when(mockedStorefrontPermissions.saveUser(anything())).thenResolve({})
}

describe('given an Organization Mutation', () => {
  beforeAll(() => {
    mockConfigsAndSettings()
    mockOrganizationsToUpdateOrganization()
    mockMasterdataOperationsToUpdateOrganization()
    mockStorefrontPermissionsOperationsToUpdateOrganization()
  })

  describe('when update an organization with status APPROVED', () => {
    const input = {
      id: '1',
      notes: 'OK',
      notifyUsers: true,
      status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
    }

    let result: { id?: string; message: string; status: string }

    beforeAll(async () => {
      result = await Organizations.updateOrganizationRequest(
        instance(mock()),
        input,
        mockedContext
      )
    })

    it('should return oranization id with success', () => {
      expect(result.status).toEqual('success')
      expect(result.id).toEqual(orgId)
    })

    it('should call create organization with data', () => {
      verify(
        spyOrganizations.createOrganization(anything(), anything(), anything())
      ).once()

      const inputArg = capture(spyOrganizations.createOrganization).last()[1]

      expect(inputArg.input.defaultCostCenter?.stateRegistration).toEqual(
        stateRegistration
      )
    })

    it('should save the user in store front permission', () => {
      verify(mockedStorefrontPermissions.saveUser(anything())).once()
    })
  })
})
