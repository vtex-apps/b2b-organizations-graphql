import type { Logger } from '@vtex/api/lib/service/logger/logger'

import { sendMetric } from './metrics'

jest.mock('./metrics')
afterEach(() => {
  jest.resetAllMocks()
})

describe('given an action for an user', () => {
  describe('when add user', () => {
    const logger = jest.fn() as unknown as Logger

    beforeEach(async () => {
      await sendUserMetric(logger)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Add User Action - Graphql',
        fields: {},
        kind: 'add-user-graphql-event',
        name: 'b2b-suite-buyerorg-data',
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })

  describe('when remove user', () => {
    const logger = jest.fn() as unknown as Logger

    beforeEach(async () => {
      await sendUserMetric(logger)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Remove User Action - Graphql',
        fields: {},
        kind: 'remove-user-graphql-event',
        name: 'b2b-suite-buyerorg-data',
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })

  describe('when update user', () => {
    const logger = jest.fn() as unknown as Logger

    beforeEach(async () => {
      await sendUserMetric(logger)
    })

    it('should metrify the action', () => {
      const metricParam = {
        account,
        description: 'Update User Action - Graphql',
        fields: {},
        kind: 'update-user-graphql-event',
        name: 'b2b-suite-buyerorg-data',
      }

      expect(sendMetric).toHaveBeenCalledWith(metricParam)
    })
  })
})
