import * as casual from 'casual'

import { ORGANIZATION_REQUEST_STATUSES } from '../../utils/constants'
import B2BSettings from '../Queries/Settings'
import Organizations from './Organizations'

jest.mock('../config')
jest.mock('../Queries/Settings')
const mockedOrganizations = Organizations as jest.Mocked<typeof Organizations>

const mockContext = () => {
  return {
    clients: {
      masterdata: {
        createDocument: jest.fn().mockResolvedValue({
          DocumentId: casual.uuid,
        }),
        getDocument: jest.fn().mockResolvedValueOnce({
          b2bCustomerAdmin: {
            email: casual.email,
            firstName: casual.first_name,
            lastName: casual.last_name,
          },
          defaultCostCenter: {
            address: {},
          },
          status: ORGANIZATION_REQUEST_STATUSES.PENDING,
        } as OrganizationRequest),
        searchDocuments: jest.fn().mockResolvedValue({}),
        updatePartialDocument: jest.fn().mockResolvedValueOnce({}),
      },
      storefrontPermissions: {
        listRoles: jest.fn().mockResolvedValueOnce({
          data: { listRoles: [{ id: casual.uuid, slug: 'customer-admin' }] },
        }),
        saveUser: jest.fn().mockResolvedValueOnce({ data: {} }),
      },
    },
    vtex: {
      logger: jest.fn(),
    },
  } as unknown as Context
}

beforeEach(() => {
  jest
    .spyOn(B2BSettings, 'getB2BSettings')
    .mockImplementation(
      async (_: void, __: void, ___: Context) => ({} as B2BSettingsInput)
    )
})
afterEach(() => {
  jest.resetAllMocks()
})

describe('given an Organization Mutation', () => {
  const orgId = casual.uuid
  let mockedContext: Context

  beforeEach(() => {
    mockedContext = mockContext()
    mockedOrganizations.createOrganization
      .mockResolvedValueOnce({
        costCenterId: casual.uuid,
        href: '',
        id: orgId,
        status: '',
      })
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
