import casual from 'casual'

import Organizations from '../resolvers/Mutations/Organizations'

export const mockOrganizations = (orgId: string) => {
  jest.mock('../resolvers/Mutations/Organizations')
  const mockedOrganizations = Organizations as jest.Mocked<typeof Organizations>

  jest
    .spyOn(mockedOrganizations, 'createOrganization')
    .mockImplementation()
    .mockResolvedValueOnce({
      costCenterId: casual.uuid,
      href: '',
      id: orgId,
      status: '',
    })

  return mockedOrganizations
}
