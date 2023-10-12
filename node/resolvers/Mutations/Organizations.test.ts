import {
  randAddress,
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
import type {
  AddressInput,
  OrganizationInput,
  OrganizationRequest,
} from '../../typings'
import { ORGANIZATION_REQUEST_STATUSES } from '../../utils/constants'
import Organizations from './Organizations'

jest.mock('../config')
jest.mock('../Queries/Settings')

const mockGetDocument = jest.fn().mockResolvedValue({
  b2bCustomerAdmin: {
    email: randEmail(),
    firstName: randFirstName(),
    lastName: randLastName(),
  },
  defaultCostCenter: {
    address: {},
  },
  status: ORGANIZATION_REQUEST_STATUSES.PENDING,
} as OrganizationRequest)

const mockContext = (
  createdId: string = randUuid(),
  roleId: string = randUuid()
) => {
  return {
    clients: {
      masterdata: {
        createDocument: jest.fn().mockResolvedValue({
          DocumentId: createdId,
        }),
        getDocument: mockGetDocument,
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

    const createDate = new Date('2023-10-10')

    describe('with status APPROVED and state registration', () => {
      const stateRegistration = randWord()

      const organization = {
        b2bCustomerAdmin: {
          email: randEmail(),
          firstName: randFirstName(),
          lastName: randLastName(),
        },
        defaultCostCenter: {
          address: randAddress(),
          stateRegistration,
        },
        id: orgId,
        name: randCompanyName(),
        stateRegistration,
        status: ORGANIZATION_REQUEST_STATUSES.PENDING,
        tradeName: randAirportName(),
      } as unknown as OrganizationInput

      beforeEach(async () => {
        mockGetDocument.mockResolvedValueOnce(organization)
        jest.useFakeTimers().setSystemTime(createDate)
        mockedContext = mockContext(orgId)
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
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(2, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: [organization.defaultCostCenter?.address],
            organization: orgId,
            stateRegistration,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      })

      it('should save the user in store front permission', () => {
        expect(
          mockedContext.clients.storefrontPermissions.saveUser
        ).toHaveBeenCalledTimes(1)
      })
    })

    describe('with status APPROVED and without state registration', () => {
      const organization = {
        b2bCustomerAdmin: {
          email: randEmail(),
          firstName: randFirstName(),
          lastName: randLastName(),
        },
        defaultCostCenter: {},
        id: orgId,
        name: randCompanyName(),
        status: ORGANIZATION_REQUEST_STATUSES.PENDING,
        tradeName: randAirportName(),
      } as unknown as OrganizationInput

      beforeEach(async () => {
        mockGetDocument.mockResolvedValueOnce(organization)
        mockedContext = mockContext(orgId)

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
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(2, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: [],
            organization: orgId,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
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
        address: randAddress() as unknown as AddressInput,
        name: randLastName(),
      }

      const defaultCostCenter = {
        address: randAddress() as unknown as AddressInput,
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

      const roleId = randUuid()

      const createDate = new Date('2020-01-01')

      beforeEach(async () => {
        jest.useFakeTimers().setSystemTime(createDate)
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
            addresses: [costCenter.address],
            id: undefined,
            name: costCenter.name,
            organization: orgId,
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
            addresses: [defaultCostCenter.address],
            name: defaultCostCenter.name,
            organization: orgId,
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

      beforeEach(async () => {
        jest.useFakeTimers().setSystemTime(createDate)
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
            addresses: [],
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
            addresses: [],
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
