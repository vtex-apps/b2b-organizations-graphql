import { randEmail, randWord } from '@ngneat/falso'
import type { Logger } from '@vtex/api/lib/service/logger/logger'
import { B2B_METRIC_NAME } from '../../clients/analytics'
import type { UserArgs } from '../../typings'
import {
  sendAddUserMetric,
  sendRemoveUserMetric,
  sendUpdateUserMetric,
} from './user'

jest.mock('@vtex/api')
jest.mock('@vtex/diagnostics-nodejs', () => ({}))

const mockContext = () => {
  return {
    clients: {
      analytics: {
        sendMetric: jest.fn(),
      },
    },
  } as unknown as Context
}

afterEach(() => {
  jest.resetAllMocks()
})

describe('given an action for a user', () => {
  describe('when add user', () => {
    const context = mockContext()

    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const userArgs: Partial<UserArgs> = {
      email: randEmail(),
      id: randWord(),
      userId: randWord(),
    }

    beforeEach(async () => {
      await sendAddUserMetric(context, logger, account, userArgs)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Add User Action - Graphql',
        fields: userArgs,
        kind: 'add-user-graphql-event',
        name: B2B_METRIC_NAME,
      }

      expect(context.clients.analytics.sendMetric).toHaveBeenCalledWith(
        metricParam
      )
    })
  })

  describe('when remove user', () => {
    const context = mockContext()

    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const userArgs: Partial<UserArgs> = {
      email: randEmail(),
      id: randWord(),
      userId: randWord(),
    }

    beforeEach(async () => {
      await sendRemoveUserMetric(context, logger, account, userArgs)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Remove User Action - Graphql',
        fields: userArgs,
        kind: 'remove-user-graphql-event',
        name: B2B_METRIC_NAME,
      }

      expect(context.clients.analytics.sendMetric).toHaveBeenCalledWith(
        metricParam
      )
    })
  })

  describe('when update user', () => {
    const context = mockContext()

    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const userArgs: Partial<UserArgs> = {
      email: randEmail(),
      id: randWord(),
      userId: randWord(),
    }

    beforeEach(async () => {
      await sendUpdateUserMetric(context, logger, account, userArgs)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Update User Action - Graphql',
        fields: userArgs,
        kind: 'update-user-graphql-event',
        name: B2B_METRIC_NAME,
      }

      expect(context.clients.analytics.sendMetric).toHaveBeenCalledWith(
        metricParam
      )
    })
  })
})
