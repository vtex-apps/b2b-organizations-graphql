import casual from 'casual'

import { ORGANIZATION_REQUEST_STATUSES } from '../utils/constants'

export const mockContext = () => {
  return ({
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
  } as unknown) as Context
}
