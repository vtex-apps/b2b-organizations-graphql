import { randAlphaNumeric, randEmail, randUser, randUuid } from '@ngneat/falso'
import { GraphQLError } from 'graphql'

import type { UserArgs } from '../../typings'
import Users from './Users'

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
      audit: {
        sendEvent: jest.fn().mockResolvedValue(undefined),
        sendEventStrict: jest.fn().mockResolvedValue(undefined),
      },
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
      logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
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

describe('saveUser logging (B2BTEAM-3982)', () => {
  it('logs saveUser.error with its own operation when storefront-permissions fails', async () => {
    const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
    const ctx = {
      clients: {
        masterdata: {},
        storefrontPermissions: {
          saveUser: jest.fn().mockRejectedValue(new Error('boom')),
        },
      },
      ip: '127.0.0.1',
      vtex: { adminUserAuthToken: 'token', logger },
    } as unknown as Context

    const result = await Users.saveUser(
      undefined as never,
      {
        costId: randUuid(),
        email: randEmail(),
        name: 'QA',
        orgId: randUuid(),
        roleId: randUuid(),
      } as UserArgs,
      ctx
    )

    expect(result).toEqual(expect.objectContaining({ status: 'error' }))
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'User',
        message: 'saveUser.error',
        operation: 'saveUser',
      })
    )
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: 'addUser.error' })
    )
  })
})

describe('addUser (B2BTEAM-3982 review)', () => {
  const buildCtx = (addUser: jest.Mock, sendEventStrict: jest.Mock) =>
    ({
      clients: {
        audit: { sendEvent: jest.fn(), sendEventStrict },
        storefrontPermissions: { addUser },
      },
      ip: '127.0.0.1',
      vtex: {
        account: 'testaccount',
        adminUserAuthToken: 'token',
        logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
      },
    } as unknown as Context)

  const args = {
    costId: 'cost-1',
    email: 'qa@example.com',
    name: 'QA',
    orgId: 'org-1',
    roleId: 'role-1',
  } as UserArgs

  it('returns status error when the failure has no graphQLErrors', async () => {
    const ctx = buildCtx(
      jest.fn().mockRejectedValue(new Error('network down')),
      jest.fn().mockResolvedValue(undefined)
    )

    const result = await Users.addUser(undefined as never, args, ctx)

    expect(result).toEqual({ status: 'error', message: 'network down' })
  })

  it('keeps the created user when the audit call fails (fire-and-forget)', async () => {
    const created = { id: 'user-1', status: 'success', userId: 'uid-1' }
    const sendEventStrict = jest.fn().mockRejectedValue(new Error('audit down'))
    const ctx = buildCtx(
      jest.fn().mockResolvedValue({ data: { addUser: created } }),
      sendEventStrict
    )

    const result = await Users.addUser(undefined as never, args, ctx)

    await new Promise<void>((resolve) => setImmediate(() => resolve()))

    expect(result).toEqual(created)
    expect(sendEventStrict).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'ADD_USER' })
    )
  })
})
