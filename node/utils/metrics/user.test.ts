import { randEmail, randWord } from '@ngneat/falso'
import type { Logger } from '@vtex/api/lib/service/logger/logger'

import { sendMetric } from './metrics'
import {
  sendAddUserMetric,
  sendRemoveUserMetric,
  sendUpdateUserMetric,
} from './user'

jest.mock('./metrics')
afterEach(() => {
  jest.resetAllMocks()
})

describe('given an action for a user', () => {
  describe('when add user', () => {
    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const userArgs: Partial<UserArgs> = {
      email: randEmail(),
      id: randWord(),
      userId: randWord(),
    }

    beforeEach(async () => {
      await sendAddUserMetric(logger, account, userArgs)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Add User Action - Graphql',
        fields: userArgs,
        kind: 'add-user-graphql-event',
        name: 'b2b-suite-buyerorg-data',
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })

  describe('when remove user', () => {
    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const userArgs: Partial<UserArgs> = {
      email: randEmail(),
      id: randWord(),
      userId: randWord(),
    }

    beforeEach(async () => {
      await sendRemoveUserMetric(logger, account, userArgs)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Remove User Action - Graphql',
        fields: userArgs,
        kind: 'remove-user-graphql-event',
        name: 'b2b-suite-buyerorg-data',
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })

  describe('when update user', () => {
    const logger = jest.fn() as unknown as Logger

    const account = randWord()

    const userArgs: Partial<UserArgs> = {
      email: randEmail(),
      id: randWord(),
      userId: randWord(),
    }

    beforeEach(async () => {
      await sendUpdateUserMetric(logger, account, userArgs)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Update User Action - Graphql',
        fields: userArgs,
        kind: 'update-user-graphql-event',
        name: 'b2b-suite-buyerorg-data',
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })
})
