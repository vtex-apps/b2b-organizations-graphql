import * as casual from 'casual'
import {
  anything,
  capture,
  instance,
  mock,
  resetCalls,
  spy,
  verify,
  when,
} from 'ts-mockito'

import { ORGANIZATION_REQUEST_STATUSES } from '../../utils/constants'
import type { Settings } from '../config'
import Config from '../config'
import Organizations from './Organizations'
import B2BSettings from '../Queries/Settings'
import type { Clients } from '../../clients'

const orgId = casual.uuid

beforeEach(() => {
  mockConfigsAndSettings()
})
afterEach(() => {
  jest.resetAllMocks()
})

function mockContext(
  mockedMasterdata: Clients['masterdata'],
  mockedStorefrontPermissions: Clients['storefrontPermissions']
) {
  return ({
    clients: {
      masterdata: instance(mockedMasterdata),
      storefrontPermissions: instance(mockedStorefrontPermissions),
    },
    vtex: {
      logger: mock<Logger>(),
    },
  } as unknown) as Context
}

function mockConfigsAndSettings() {
  const spyB2BSettings = spy(B2BSettings)

  when(
    spyB2BSettings.getB2BSettings(anything(), anything(), anything())
  ).thenResolve({} as B2BSettingsInput)

  const spyConfig = spy(Config)

  when(spyConfig.checkConfig(anything())).thenResolve({} as Settings)

  return spyB2BSettings
}

function mockOrganizationsToUpdateOrganization() {
  const spyOrganizations = spy(Organizations)

  when(
    spyOrganizations.createOrganization(anything(), anything(), anything())
  ).thenResolve({
    costCenterId: undefined,
    href: '',
    id: orgId,
    status: '',
  })

  return spyOrganizations
}

function mockMasterdataOperationsToUpdateOrganization() {
  const mockedMasterdata = mock<Clients['masterdata']>()

  when(mockedMasterdata.getDocument(anything())).thenResolve({
    b2bCustomerAdmin: {
      email: casual.email,
      firstName: casual.first_name,
      lastName: casual.last_name,
    },
    defaultCostCenter: {
      address: {},
    },
    status: ORGANIZATION_REQUEST_STATUSES.PENDING,
  } as OrganizationRequest)

  when(mockedMasterdata.searchDocuments(anything())).thenResolve({} as any)
  when(mockedMasterdata.createDocument(anything())).thenResolve({
    DocumentId: casual.uuid,
  } as any)

  when(mockedMasterdata.updatePartialDocument(anything())).thenResolve()

  return mockedMasterdata
}

function mockStorefrontPermissionsOperationsToUpdateOrganization() {
  const mockedStorefrontPermissions = mock<Clients['storefrontPermissions']>()

  when(mockedStorefrontPermissions.listRoles()).thenResolve({
    data: { listRoles: [{ id: casual.uuid, slug: 'customer-admin' }] },
  })

  when(mockedStorefrontPermissions.saveUser(anything())).thenResolve({})

  return mockedStorefrontPermissions
}

describe('given an Organization Mutation', () => {
  const spyOrganizations = mockOrganizationsToUpdateOrganization()
  const mockedMasterdata = mockMasterdataOperationsToUpdateOrganization()
  const mockedStorefrontPermissions = mockStorefrontPermissionsOperationsToUpdateOrganization()
  const mockedContext = mockContext(
    mockedMasterdata,
    mockedStorefrontPermissions
  )

  afterEach(() => {
    resetCalls(spyOrganizations)
    resetCalls(mockedMasterdata)
    resetCalls(mockedStorefrontPermissions)
  })

  describe('when update an organization with status APPROVED and state registration', () => {
    const stateRegistration = casual.word
    const input = {
      id: '1',
      notes: 'OK',
      notifyUsers: true,
      status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
    }

    let result: { id?: string; message: string; status: string }

    beforeEach(async () => {
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

      result = await Organizations.updateOrganizationRequest(
        instance(mock()),
        input,
        mockedContext
      )
    })

    it('should return organization id with success', () => {
      expect(result.status).toEqual('success')
      expect(result.id).toEqual(orgId)
    })

    it('should call create organization with data', () => {
      verify(
        spyOrganizations.createOrganization(anything(), anything(), anything())
      ).once()

      const [, capturedInput] = capture(
        spyOrganizations.createOrganization
      ).last()

      expect(capturedInput.input.defaultCostCenter?.stateRegistration).toEqual(
        stateRegistration
      )
    })

    it('should save the user in store front permission', () => {
      verify(mockedStorefrontPermissions.saveUser(anything())).once()
    })
  })

  describe('when update an organization with status APPROVED and without state registration', () => {
    const input = {
      id: '1',
      notes: 'OK',
      notifyUsers: true,
      status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
    }

    let result: { id?: string; message: string; status: string }

    beforeEach(async () => {
      result = await Organizations.updateOrganizationRequest(
        instance(mock()),
        input,
        mockedContext
      )
    })

    it('should return organization id with success', () => {
      expect(result.status).toEqual('success')
      expect(result.id).toEqual(orgId)
    })

    it('should call create organization with data', () => {
      verify(
        spyOrganizations.createOrganization(anything(), anything(), anything())
      ).once()

      const [, capturedInput] = capture(
        spyOrganizations.createOrganization
      ).last()

      expect(
        capturedInput.input.defaultCostCenter?.stateRegistration
      ).toBeUndefined()
    })

    it('should save the user in store front permission', () => {
      verify(mockedStorefrontPermissions.saveUser(anything())).once()
    })
  })
})
