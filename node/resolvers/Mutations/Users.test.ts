import { randAlphaNumeric, randEmail, randUser, randUuid } from '@ngneat/falso'
import { GraphQLError } from 'graphql'

import Users from './Users'
import type { UserArgs } from '../../typings'

jest.mock('@vtex/api')
jest.mock('@vtex/diagnostics-nodejs', () => ({}))
jest.mock('../config')
jest.mock('../../utils/metrics/impersonate')

const mockContext = (
  impersonateUser = randUser(),
  permissions: string[] = [],
  costId: string = randUuid(),
  orgId: string = randUuid()
) => {
  return {
    clients: {
      storefrontPermissions: {
        getB2BUser: jest.fn().mockResolvedValue({
          data: {
            getB2BUser: {
              costId,
              orgId,
            },
          },
        }),
        getUser: jest.fn().mockResolvedValue({
          data: {
            getUser: {
              costId,
              orgId,
            },
          },
        }),
        impersonateUser: jest.fn().mockResolvedValue({
          data: {
            impersonateUser,
          },
        }),
      },
    },
    vtex: {
      logger: jest.fn(),
      sessionData: {
        namespaces: {
          'storefront-permissions': {
            costcenter: {
              value: costId,
            },
            organization: {
              value: orgId,
            },
            storeUserEmail: randEmail(),
            userId: randUuid(),
            userTargetId: randUuid(),
          },
        },
      },
      storefrontPermissions: {
        permissions,
      },
    },
  } as unknown as Context
}

describe('given an Users Mutation', () => {
  describe('when impersonate an B2B user', () => {
    describe('with invalid permission', () => {
      const user = randUser()

      const mockedContext = mockContext()

      it('should throws GraphQLError with operation-not-permitted.', async () => {
        await expect(
          Users.impersonateB2BUser(jest.fn() as never, user, mockedContext)
        ).rejects.toThrowError(new GraphQLError('operation-not-permitted'))
      })
    })

    describe('with permission impersonate-users-costcenter and the user with same costcenter', () => {
      const user = randUser()
      const impersonateUser = randUser()

      const mockedContext = mockContext(impersonateUser, [
        'impersonate-users-costcenter',
      ])

      let result: any

      beforeEach(async () => {
        result = await Users.impersonateB2BUser(
          jest.fn() as never,
          user,
          mockedContext
        )
      })
      it('should call impersonate user in storefront permission', () => {
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toHaveBeenCalledTimes(1)
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toBeCalledWith({ userId: user.id })
      })

      it('should return impersonate user data', () => {
        expect(result).toEqual(impersonateUser)
      })
    })

    describe('with permission impersonate-users-organization and the user with same organization', () => {
      const user = randUser()
      const impersonateUser = randUser()

      const mockedContext = mockContext(impersonateUser, [
        'impersonate-users-organization',
      ])

      let result: any

      beforeEach(async () => {
        result = await Users.impersonateB2BUser(
          jest.fn() as never,
          user,
          mockedContext
        )
      })
      it('should call impersonate user in storefront permission', () => {
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toHaveBeenCalledTimes(1)
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toBeCalledWith({ userId: user.id })
      })

      it('should return impersonate user data', () => {
        expect(result).toEqual(impersonateUser)
      })
    })

    describe('with permission impersonate-users-all', () => {
      const user = randUser()
      const impersonateUser = randUser()

      const mockedContext = mockContext(impersonateUser, [
        'impersonate-users-all',
      ])

      let result: any

      beforeEach(async () => {
        result = await Users.impersonateB2BUser(
          jest.fn() as never,
          user,
          mockedContext
        )
      })
      it('should call impersonate user in storefront permission', () => {
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toHaveBeenCalledTimes(1)
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toBeCalledWith({ userId: user.id })
      })

      it('should return impersonate user data', () => {
        expect(result).toEqual(impersonateUser)
      })
    })
  })

  describe('when impersonate an user', () => {
    describe('with invalid permission', () => {
      const clId = randAlphaNumeric({ length: 10 }).toString()
      const userId = randUser().id
      const user: Partial<UserArgs> = { clId, userId }
      const mockedContext = mockContext()

      it('should throws GraphQLError with operation-not-permitted.', async () => {
        await expect(
          Users.impersonateUser(
            jest.fn() as never,
            user as UserArgs,
            mockedContext
          )
        ).rejects.toThrowError(new GraphQLError('operation-not-permitted'))
      })
    })

    describe('with permission impersonate-users-costcenter and the user with same costcenter', () => {
      const clId = randAlphaNumeric({ length: 10 }).toString()
      const userId = randUser().id
      const user: Partial<UserArgs> = { clId, userId }
      const impersonateUser = randUser()

      const mockedContext = mockContext(impersonateUser, [
        'impersonate-users-costcenter',
      ])

      let result: any

      beforeEach(async () => {
        result = await Users.impersonateUser(
          jest.fn() as never,
          user as UserArgs,
          mockedContext
        )
      })
      it('should call impersonate user in storefront permission', () => {
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toHaveBeenCalledTimes(1)
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toBeCalledWith({ userId })
      })

      it('should not return error', () => {
        expect(result?.status).not.toEqual('error')
      })
    })

    describe('with permission impersonate-users-organization and the user with same organization', () => {
      const clId = randAlphaNumeric({ length: 10 }).toString()
      const userId = randUser().id
      const user: Partial<UserArgs> = { clId, userId }
      const impersonateUser = randUser()

      const mockedContext = mockContext(impersonateUser, [
        'impersonate-users-organization',
      ])

      let result: any

      beforeEach(async () => {
        result = await Users.impersonateUser(
          jest.fn() as never,
          user as UserArgs,
          mockedContext
        )
      })
      it('should call impersonate user in storefront permission', () => {
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toHaveBeenCalledTimes(1)
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toBeCalledWith({ userId })
      })

      it('should not return error', () => {
        expect(result?.status).not.toEqual('error')
      })
    })

    describe('with permission impersonate-users-all', () => {
      const clId = randAlphaNumeric({ length: 10 }).toString()
      const userId = randUser().id
      const user: Partial<UserArgs> = { clId, userId }
      const impersonateUser = randUser()

      const mockedContext = mockContext(impersonateUser, [
        'impersonate-users-all',
      ])

      let result: any

      beforeEach(async () => {
        result = await Users.impersonateUser(
          jest.fn() as never,
          user as UserArgs,
          mockedContext
        )
      })
      it('should call impersonate user in storefront permission', () => {
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toHaveBeenCalledTimes(1)
        expect(
          mockedContext.clients.storefrontPermissions.impersonateUser
        ).toBeCalledWith({ userId })
      })

      it('should not return error', () => {
        expect(result?.status).not.toEqual('error')
      })
    })
  })
})
