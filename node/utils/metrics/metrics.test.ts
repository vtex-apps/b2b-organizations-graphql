import axios from 'axios'

import { sendMetric } from './metrics'

jest.mock('axios')
afterEach(() => {
  jest.resetAllMocks()
})

describe('when calling sendMetrics', () => {
  it('should call axios.post', async () => {
    const metric = {
      account: 'account',
      description: 'description',
      kind: 'kind',
      name: 'b2b-suite-buyerorg-data' as const,
    }

    await sendMetric(metric)

    expect(axios.post).toBeCalledTimes(1)
  })

  it('should retry on failure', async () => {
    const metric = {
      account: 'account',
      description: 'description',
      kind: 'kind',
      name: 'b2b-suite-buyerorg-data' as const,
    }

    jest
      .spyOn(axios, 'post')
      .mockImplementation()
      .mockRejectedValueOnce(new Error('error'))

    await sendMetric(metric)

    expect(axios.post).toBeCalledTimes(2)
  })

  it('should fail after max retries', async () => {
    const metric = {
      account: 'account',
      description: 'description',
      kind: 'kind',
      name: 'b2b-suite-buyerorg-data' as const,
    }

    jest
      .spyOn(axios, 'post')
      .mockImplementation()
      .mockRejectedValue(new Error('Error'))

    await expect(async () => {
      await sendMetric(metric)
    }).rejects.toThrowError('Error - after 2 retries.')

    expect(axios.post).toBeCalledTimes(3)
  })
})
