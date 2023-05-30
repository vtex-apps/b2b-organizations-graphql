import type { Logger } from '@vtex/api/lib/service/logger'
import * as casual from 'casual'
import { anything, instance, mock, spy, when } from 'ts-mockito'

import type { Clients } from '../../clients'
import { ORGANIZATION_REQUEST_STATUSES } from '../../utils/constants'
import type { Settings } from '../config'
import Config from '../config'
import B2BSettings from '../Queries/Settings'
import Organizations from './Organizations'

beforeEach(() => {
  jest.resetAllMocks()
})
describe('#isNotSuccessCode', () => {
  it('should return false for http success codes', async () => {
    const mockedMasterdata = mock<Clients['masterdata']>()

    when(mockedMasterdata.getDocument(anything())).thenResolve({
      b2bCustomerAdmin: {
        email: casual.email,
        firstName: casual.first_name,
        lastName: casual.last_name,
      },
      status: ORGANIZATION_REQUEST_STATUSES.PENDING,
    } as OrganizationRequest)
    const mockedContext = {
      clients: {
        masterdata: instance(mockedMasterdata),
      },
      vtex: {
        logger: mock<Logger>(),
      },
    } as Context

    const spyB2BSettings = spy(B2BSettings)

    when(
      spyB2BSettings.getB2BSettings(anything(), anything(), anything())
    ).thenResolve({} as B2BSettingsInput)

    const spyConfig = spy(Config)

    when(spyConfig.checkConfig(anything())).thenResolve({} as Settings)

    const input = {
      id: '1',
      notes: 'OK',
      notifyUsers: true,
      status: ORGANIZATION_REQUEST_STATUSES.APPROVED,
    }

    await Organizations.updateOrganizationRequest(
      instance(mock()),
      input,
      mockedContext
    )
  })
})
