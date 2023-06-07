import {
  randEmail,
  randFirstName,
  randLastName,
  randUuid,
  randWord,
} from '@ngneat/falso'

import { ORGANIZATION_REQUEST_STATUSES } from '../../utils/constants'
import Organizations from './Organizations'

jest.mock('../config')
jest.mock('../Queries/Settings')

const mockedOrganizations = Organizations as jest.Mocked<typeof Organizations>

const mockContext = (stateRegistration?: string) => {
  return {
    clients: {
      masterdata: {
        createDocument: jest.fn().mockResolvedValue({
          DocumentId: randUuid(),
        }),
        getDocument: jest.fn().mockResolvedValueOnce({
          b2bCustomerAdmin: {
            email: randEmail(),
            firstName: randFirstName(),
            lastName: randLastName(),
          },
          defaultCostCenter: {
            address: {},
            stateRegistration,
          },
          status: ORGANIZATION_REQUEST_STATUSES.PENDING,
        } as OrganizationRequest),
        searchDocuments: jest.fn().mockResolvedValue({}),
        updatePartialDocument: jest.fn().mockResolvedValueOnce({}),
      },
      storefrontPermissions: {
        listRoles: jest.fn().mockResolvedValueOnce({
          data: { listRoles: [{ id: randUuid(), slug: 'customer-admin' }] },
        }),
        saveUser: jest.fn().mockResolvedValueOnce({ data: {} }),
      },
    },
    vtex: {
      logger: jest.fn(),
    },
  } as unknown as Context
}

afterEach(() => {
  jest.resetAllMocks()
})

describe('given an Organization Mutation', () => {
  const orgId = randUuid()
  const input = {
    id: '1',
    notes: 'OK',
    notifyUsers: true,
    status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
  }

  let result: { id?: string; message: string; status: string }
  let mockedContext: Context

  beforeEach(() => {
    jest
      .spyOn(mockedOrganizations, 'createOrganization')
      .mockResolvedValueOnce({
        costCenterId: randUuid(),
        href: '',
        id: orgId,
        status: '',
      })
  })

  describe('when update an organization with status APPROVED and state registration', () => {
    const stateRegistration = randWord()

    beforeEach(async () => {
      mockedContext = mockContext(stateRegistration)
      result = await Organizations.updateOrganizationRequest(
        jest.fn() as never,
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
    beforeEach(async () => {
      mockedContext = mockContext()
      result = await Organizations.updateOrganizationRequest(
        jest.fn() as never,
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
