import * as casual from 'casual'

// eslint-disable-next-line jest/no-mocks-import
import { mockContext } from '../../__mocks__/context.mock'
// eslint-disable-next-line jest/no-mocks-import
import { mockOrganizations } from '../../__mocks__/resolvers-mutations-organization.mock'
// eslint-disable-next-line jest/no-mocks-import
import {
  mockB2BSettings,
  mockSettingsConfig,
} from '../../__mocks__/settings.mock'
import { ORGANIZATION_REQUEST_STATUSES } from '../../utils/constants'
import Organizations from './Organizations'

beforeEach(() => {
  mockSettingsConfig()
  mockB2BSettings()
})
afterEach(() => {
  jest.resetAllMocks()
})

describe('given an Organization Mutation', () => {
  let mockedContext: Context
  let mockedOrganizations: jest.Mocked<typeof Organizations>
  const orgId = casual.uuid

  beforeEach(() => {
    mockedContext = mockContext()
    mockedOrganizations = mockOrganizations(orgId)
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
      jest
        .spyOn(mockedContext.clients.masterdata, 'getDocument')
        .mockImplementation()
        .mockResolvedValueOnce({
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
        })

      result = await Organizations.updateOrganizationRequest(
        jest.fn() as any,
        input,
        mockedContext
      )
    })

    it('should return organization id with success', () => {
      expect(result.status).toEqual('success')
      expect(result.id).toEqual(orgId)
    })

    it('should call create organization with data', () => {
      expect(mockedOrganizations.createOrganization).toHaveBeenCalledTimes(1)

      expect(
        mockedOrganizations.createOrganization.mock.calls[0]?.[1]?.input
          ?.defaultCostCenter?.stateRegistration
      ).toEqual(stateRegistration)
    })

    it('should save the user in store front permission', () => {
      expect(
        mockedContext.clients.storefrontPermissions.saveUser
      ).toHaveBeenCalledTimes(1)
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
        jest.fn() as any,
        input,
        mockedContext
      )
    })

    it('should return organization id with success', () => {
      expect(result.status).toEqual('success')
      expect(result.id).toEqual(orgId)
    })

    it('should call create organization without state registration', () => {
      expect(mockedOrganizations.createOrganization).toHaveBeenCalledTimes(1)

      expect(
        mockedOrganizations.createOrganization.mock.calls[0]?.[1]?.input
          ?.defaultCostCenter?.stateRegistration
      ).toBeUndefined()
    })

    it('should save the user in store front permission', () => {
      expect(
        mockedContext.clients.storefrontPermissions.saveUser
      ).toHaveBeenCalledTimes(1)
    })
  })
})
