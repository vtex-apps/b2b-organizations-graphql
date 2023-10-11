import {
  randAirportName,
  randCompanyName,
  randEmail,
  randFirstName,
  randLastName,
  randSuperheroName,
  randUser,
  randUuid,
  randWord,
} from '@ngneat/falso'

import {
  COST_CENTER_DATA_ENTITY,
  COST_CENTER_SCHEMA_VERSION,
  ORGANIZATION_DATA_ENTITY,
  ORGANIZATION_SCHEMA_VERSION,
} from '../../mdSchema'
import type { OrganizationInput, OrganizationRequest } from '../../typings'
import { ORGANIZATION_REQUEST_STATUSES } from '../../utils/constants'
import Organizations from './Organizations'

jest.mock('../config')
jest.mock('../Queries/Settings')

const mockedOrganizations = Organizations as jest.Mocked<typeof Organizations>

const mockContext = (
  createdId: string = randUuid(),
  roleId: string = randUuid(),
  stateRegistration?: string
) => {
  return {
    clients: {
      masterdata: {
        createDocument: jest.fn().mockResolvedValue({
          DocumentId: createdId,
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
        listRoles: jest.fn().mockResolvedValue({
          data: { listRoles: [{ id: roleId, slug: 'customer-admin' }] },
        }),
        saveUser: jest
          .fn()
          .mockResolvedValue({ data: { saveUser: randUser() } }),
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
  describe('when update an organization', () => {
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

    describe('with status APPROVED and state registration', () => {
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

    describe('with status APPROVED and without state registration', () => {
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
  describe('when create an organization', () => {
    const orgId = randUuid()

    describe('with organization id and without cost center id', () => {
      const costCenter = {
        name: randLastName(),
      }

      const defaultCostCenter = {
        name: randSuperheroName(),
      }

      const input = {
        b2bCustomerAdmin: {
          email: randEmail(),
          firstName: randFirstName(),
        },
        costCenters: [costCenter],
        defaultCostCenter,
        id: orgId,
        name: randCompanyName(),
        tradeName: randAirportName(),
      } as OrganizationInput

      let result: { href: any; organizationId: any }
      let mockedContext: Context

      const createDate = new Date('2020-01-01')

      const roleId = randUuid()

      jest.useFakeTimers().setSystemTime(createDate)

      beforeEach(async () => {
        mockedContext = mockContext(orgId, roleId)
        result = await Organizations.createOrganizationAndCostCentersWithId(
          jest.fn() as never,
          { input },
          mockedContext
        )
      })

      it('should create the organization with the data expected', () => {
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(1, {
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: {
            collections: [],
            created: createDate,
            customFields: [],
            id: orgId,
            name: input.name,
            status: 'active',
            tradeName: input.tradeName,
          },
          schema: ORGANIZATION_SCHEMA_VERSION,
        })
      })
      it('should create the cost center specified without set id', () => {
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(2, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: undefined,
            organization: orgId,
            ...costCenter,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      })
      it('should create the default cost center', () => {
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(3, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: undefined,
            organization: orgId,
            ...defaultCostCenter,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      })
      it('should set admin user for each cost center', () => {
        expect(
          mockedContext.clients.storefrontPermissions.saveUser
        ).toBeCalledWith({
          clId: null,
          costId: undefined,
          email: input.b2bCustomerAdmin.email,
          name: `${input.b2bCustomerAdmin.firstName} ${input.b2bCustomerAdmin.lastName}`,
          orgId,
          roleId,
        })
      })
      it('should create the organization with the id specified', () => {
        expect(result.organizationId).toEqual(orgId)
      })
    })
    describe('with organization id and cost center id', () => {
      const costCenter = {
        id: randUuid(),
        name: randLastName(),
      }

      const defaultCostCenter = {
        id: randUuid(),
        name: randSuperheroName(),
      }

      const input = {
        b2bCustomerAdmin: {
          email: randEmail(),
          firstName: randFirstName(),
        },
        costCenters: [costCenter],
        defaultCostCenter,
        id: orgId,
        name: randCompanyName(),
        tradeName: randAirportName(),
      } as OrganizationInput

      let result: { href: any; organizationId: any }
      let mockedContext: Context

      const createDate = new Date('2020-01-01')

      const roleId = randUuid()

      jest.useFakeTimers().setSystemTime(createDate)

      beforeEach(async () => {
        mockedContext = mockContext(orgId, roleId)
        result = await Organizations.createOrganizationAndCostCentersWithId(
          jest.fn() as never,
          { input },
          mockedContext
        )
      })

      it('should create the organization with the data expected', () => {
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(1, {
          dataEntity: ORGANIZATION_DATA_ENTITY,
          fields: {
            collections: [],
            created: createDate,
            customFields: [],
            id: orgId,
            name: input.name,
            status: 'active',
            tradeName: input.tradeName,
          },
          schema: ORGANIZATION_SCHEMA_VERSION,
        })
      })
      it('should create the cost center specified without set id', () => {
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(2, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: undefined,
            organization: orgId,
            ...costCenter,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      })
      it('should create the default cost center', () => {
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(3, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: undefined,
            organization: orgId,
            ...defaultCostCenter,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      })
      it('should set admin user for each cost center', () => {
        expect(
          mockedContext.clients.storefrontPermissions.saveUser
        ).toHaveBeenNthCalledWith(1, {
          clId: null,
          costId: costCenter.id,
          email: input.b2bCustomerAdmin.email,
          name: `${input.b2bCustomerAdmin.firstName} ${input.b2bCustomerAdmin.lastName}`,
          orgId,
          roleId,
        })
        expect(
          mockedContext.clients.storefrontPermissions.saveUser
        ).toHaveBeenNthCalledWith(2, {
          clId: null,
          costId: defaultCostCenter.id,
          email: input.b2bCustomerAdmin.email,
          name: `${input.b2bCustomerAdmin.firstName} ${input.b2bCustomerAdmin.lastName}`,
          orgId,
          roleId,
        })
      })
      it('should create the organization with the id specified', () => {
        expect(result.organizationId).toEqual(orgId)
      })
    })
  })
})
