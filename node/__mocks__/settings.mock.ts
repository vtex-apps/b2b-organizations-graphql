import type { Settings } from '../resolvers/config'
import Config from '../resolvers/config'
import B2BSettings from '../resolvers/Queries/Settings'

export const mockB2BSettings = () => {
  return jest
    .spyOn(B2BSettings, 'getB2BSettings')
    .mockImplementation(
      async (_: void, __: void, ___: Context) => ({} as B2BSettingsInput)
    )
}

export const mockSettingsConfig = () => {
  jest.mock('../resolvers/config', () => ({}))
  const mockedConfig = Config as jest.Mocked<typeof Config>

  jest
    .spyOn(mockedConfig, 'checkConfig')
    .mockImplementation()
    .mockResolvedValueOnce({} as Settings)

  return mockedConfig
}
