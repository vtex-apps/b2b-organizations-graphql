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
  Collection,
  NormalizedOrganizationInput,
  OrganizationInput,
  OrganizationRequest,
} from '../../typings'
import { ORGANIZATION_REQUEST_STATUSES, ORGANIZATION_STATUSES } from '../../utils/constants'
import Organizations from './Organizations'

const withNormalizedAddressFields = (address?: AddressInput) => {
  if (!address) return address

  return {
    ...address,
    street: address.street ?? '',
    complement: address.complement ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
  }
}

jest.mock('@vtex/api')
jest.mock('@vtex/diagnostics-nodejs', () => ({}))
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
  orgId: string = randUuid(),
  roleId: string = randUuid(),
  costId: string = randUuid()
) => {
  return {
    ip: '127.0.0.1',
    clients: {
      analytics: {
        sendMetric: jest.fn().mockResolvedValue(undefined),
      },
      audit: {
        sendEvent: jest.fn().mockResolvedValue(undefined),
      },
      catalog: {
        collectionsAvailable: jest.fn().mockResolvedValue({ items: [] }),
      },
      masterdata: {
        createDocument: jest
          .fn()
          .mockResolvedValueOnce({
            DocumentId: orgId,
          })
          .mockResolvedValue({
            DocumentId: costId,
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
      account: 'mock-account',
      logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      },
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
            addresses: [
              withNormalizedAddressFields(
                organization.defaultCostCenter?.address
              ),
            ],
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
      } as NormalizedOrganizationInput

      let result: { href: any; id: any }
      let mockedContext: Context

      const roleId = randUuid()
      const costId = randUuid()

      const createDate = new Date('2020-01-01')

      beforeEach(async () => {
        jest.useFakeTimers().setSystemTime(createDate)
        mockedContext = mockContext(orgId, roleId, costId)
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
            permissions: {
              createQuote: true,
            },
            sellers: [],
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
            addresses: [withNormalizedAddressFields(costCenter.address)],
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
            addresses: [withNormalizedAddressFields(defaultCostCenter.address)],
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
          costId,
          email: input.b2bCustomerAdmin.email,
          name: `${input.b2bCustomerAdmin.firstName} ${input.b2bCustomerAdmin.lastName}`,
          orgId,
          roleId,
        })
      })
      it('should create the organization with the id specified', () => {
        expect(result.id).toEqual(orgId)
      })
    })
    describe('with organization id and cost center id', () => {
      const costId = randUuid()
      const costCenter = {
        id: costId,
        name: randLastName(),
      }

      const defaultCostCenter = {
        id: costId,
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
      } as NormalizedOrganizationInput

      let result: { href: any; id: any }
      let mockedContext: Context

      const createDate = new Date('2020-01-01')

      const roleId = randUuid()

      beforeEach(async () => {
        jest.useFakeTimers().setSystemTime(createDate)
        mockedContext = mockContext(orgId, roleId, costId)
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
            permissions: {
              createQuote: true,
            },
            sellers: [],
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
        expect(result.id).toEqual(orgId)
      })
    })

    describe('with multiple addresses in costCenters', () => {
      const billingAddress = {
        ...(randAddress() as unknown as AddressInput),
        addressType: 'BillingAddress',
      }

      const shippingAddress = {
        ...(randAddress() as unknown as AddressInput),
        addressType: 'ShippingAddress',
      }

      const costCenter = {
        name: randLastName(),
        addresses: [billingAddress, shippingAddress],
      }

      const input = {
        b2bCustomerAdmin: {
          email: randEmail(),
          firstName: randFirstName(),
        },
        costCenters: [costCenter],
        id: orgId,
        name: randCompanyName(),
        tradeName: randAirportName(),
      } as NormalizedOrganizationInput

      let mockedContext: Context

      const roleId = randUuid()
      const costId = randUuid()

      beforeEach(async () => {
        mockedContext = mockContext(orgId, roleId, costId)
        await Organizations.createOrganizationAndCostCentersWithId(
          jest.fn() as never,
          { input },
          mockedContext
        )
      })

      it('should persist all addresses on the cost center', () => {
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(2, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: [
              withNormalizedAddressFields(billingAddress),
              withNormalizedAddressFields(shippingAddress),
            ],
            id: undefined,
            name: costCenter.name,
            organization: orgId,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      })

    describe('with partial address fields', () => {
      const roleId = randUuid()
      const costId = randUuid()

      it('should normalize optional address fields before persisting', async () => {
        const addressWithoutComplement = {
          addressType: 'BillingAddress',
          city: 'Kohler',
          state: 'WI',
          street: '444 Highland Drive',
        } as AddressInput

        const inputWithPartialAddress = {
          b2bCustomerAdmin: {
            email: randEmail(),
            firstName: randFirstName(),
          },
          costCenters: [
            {
              name: randLastName(),
              addresses: [addressWithoutComplement],
            },
          ],
          id: orgId,
          name: randCompanyName(),
        } as NormalizedOrganizationInput

        const mockedContext = mockContext(orgId, roleId, costId)

        await Organizations.createOrganizationAndCostCentersWithId(
          jest.fn() as never,
          { input: inputWithPartialAddress },
          mockedContext
        )

        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(2, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: [withNormalizedAddressFields(addressWithoutComplement)],
            id: undefined,
            name: inputWithPartialAddress.costCenters?.[0].name,
            organization: orgId,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      })
    })
    })

    describe('when both address and addresses are provided', () => {
      const singularAddress = {
        ...(randAddress() as unknown as AddressInput),
        addressType: 'BillingAddress',
      }

      const arrayAddress = {
        ...(randAddress() as unknown as AddressInput),
        addressType: 'ShippingAddress',
      }

      const costCenter = {
        address: singularAddress,
        name: randLastName(),
        addresses: [arrayAddress],
      }

      const input = {
        b2bCustomerAdmin: {
          email: randEmail(),
          firstName: randFirstName(),
        },
        costCenters: [costCenter],
        id: orgId,
        name: randCompanyName(),
        tradeName: randAirportName(),
      } as NormalizedOrganizationInput

      let mockedContext: Context

      const roleId = randUuid()
      const costId = randUuid()

      beforeEach(async () => {
        mockedContext = mockContext(orgId, roleId, costId)
        await Organizations.createOrganizationAndCostCentersWithId(
          jest.fn() as never,
          { input },
          mockedContext
        )
      })

      it('should prefer addresses over the singular address field', () => {
        expect(
          mockedContext.clients.masterdata.createDocument
        ).toHaveBeenNthCalledWith(2, {
          dataEntity: COST_CENTER_DATA_ENTITY,
          fields: {
            addresses: [withNormalizedAddressFields(arrayAddress)],
            id: undefined,
            name: costCenter.name,
            organization: orgId,
          },
          schema: COST_CENTER_SCHEMA_VERSION,
        })
      })
    })
  })

  describe('when updateOrganization is invoked', () => {
    const orgId = randUuid()

    let collectionsAvailableSpy: jest.Mock
    let mockedContext: Context

    const minimalUpdateArgs = {
      customFields: [],
      id: orgId,
      name: 'Updated Org',
      notifyUsers: false,
      paymentTerms: [],
      permissions: {},
      priceTables: [],
      sellers: undefined,
      status: ORGANIZATION_STATUSES.ACTIVE,
      tradeName: undefined as string | undefined,
    }

    beforeEach(() => {
      collectionsAvailableSpy = jest.fn()

      mockedContext = {
        ip: '127.0.0.1',
        clients: {
          analytics: {
            sendMetric: jest.fn().mockResolvedValue(undefined),
          },
          audit: {
            sendEvent: jest.fn().mockResolvedValue(undefined),
          },
          catalog: {
            collectionsAvailable: collectionsAvailableSpy,
          },
          mail: {},
          masterdata: {
            getDocument: jest.fn().mockResolvedValue({
              id: orgId,
              name: 'Existing',
              status: ORGANIZATION_STATUSES.ACTIVE,
            }),
            updatePartialDocument: jest.fn().mockResolvedValue({}),
          },
          storefrontPermissions: {},
        },
        vtex: {
          account: 'testacct',
          logger: {
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      } as unknown as Context
    })

    describe('collections resolution', () => {
      const getPersistedCollections = (): Collection[] =>
        (mockedContext.clients.masterdata.updatePartialDocument as jest.Mock)
          .mock.calls[0]?.[0].fields.collections ?? []

      it('resolves Catalog id from name-only payloads', async () => {
        collectionsAvailableSpy.mockResolvedValue({
          items: [{ id: 42, name: 'VIP Shelf' }],
        })

        await Organizations.updateOrganization(jest.fn() as never, {
          ...minimalUpdateArgs,
          collections: [{ name: 'VIP Shelf' }],
        } as never, mockedContext)

        expect(getPersistedCollections()).toEqual([
          { id: '42', name: 'VIP Shelf' },
        ])
        expect(collectionsAvailableSpy).toHaveBeenCalledWith('VIP Shelf')
      })

      it('does not resolve via Catalog when id is supplied', async () => {
        await Organizations.updateOrganization(jest.fn() as never, {
          ...minimalUpdateArgs,
          collections: [{ id: '77', name: 'Direct Attach' }],
        } as never, mockedContext)

        expect(collectionsAvailableSpy).not.toHaveBeenCalled()

        expect(getPersistedCollections()).toEqual([
          { id: '77', name: 'Direct Attach' },
        ])
      })

      it('preserves order for mixed explicit-id and resolved-by-name inputs', async () => {
        collectionsAvailableSpy.mockResolvedValueOnce({
          items: [{ id: 200, name: 'LateBound' }],
        })

        await Organizations.updateOrganization(jest.fn() as never, {
          ...minimalUpdateArgs,
          collections: [
            { id: '5', name: 'FirstDirect' },
            { name: 'LateBound' },
          ],
        } as never, mockedContext)

        expect(getPersistedCollections()).toEqual([
          { id: '5', name: 'FirstDirect' },
          { id: '200', name: 'LateBound' },
        ])

        expect(collectionsAvailableSpy).toHaveBeenCalledTimes(1)
        expect(collectionsAvailableSpy).toHaveBeenCalledWith('LateBound')
      })

      it('drops unresolved collection names aligned with normalized create semantics', async () => {
        collectionsAvailableSpy.mockResolvedValue({ items: [] })

        await Organizations.updateOrganization(jest.fn() as never, {
          ...minimalUpdateArgs,
          collections: [{ name: 'Unknown Collection' }],
        } as never, mockedContext)

        expect(getPersistedCollections()).toEqual([])
      })

      it('persists explicit empty arrays to clear collections', async () => {
        await Organizations.updateOrganization(jest.fn() as never, {
          ...minimalUpdateArgs,
          collections: [],
        } as never, mockedContext)

        expect(mockedContext.clients.masterdata.updatePartialDocument).toHaveBeenCalled()

        expect(collectionsAvailableSpy).not.toHaveBeenCalled()

        expect(getPersistedCollections()).toEqual([])
      })

      it('omits collections from partial update payloads when collections argument absent', async () => {
        await Organizations.updateOrganization(
          jest.fn() as never,
          minimalUpdateArgs as never,
          mockedContext
        )

        const fields =
          (mockedContext.clients.masterdata.updatePartialDocument as jest.Mock)
            .mock.calls[0]?.[0].fields

        expect(fields).not.toHaveProperty('collections')
      })
    })
  })
})
