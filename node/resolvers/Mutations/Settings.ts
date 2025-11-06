import GraphQLError from '../../utils/GraphQLError'
import checkConfig, { getAppId } from '../config'
import type { B2BSettingsInput } from '../../typings'

export const B2B_SETTINGS_DOCUMENT_ID = 'b2bSettings'

const Settings = {
  saveAppSettings: async (_: any, __: any, ctx: Context) => {
    const {
      clients: { vbase, audit },
      vtex: { logger },
      ip
    } = ctx

    const app: string = getAppId()

    const newSettings = {}

    try {
      let currentSettings = null
      try {
        currentSettings = await vbase.getJSON('b2borg', app)
      } catch {
        currentSettings = null
      }
      await vbase.saveJSON('b2borg', app, newSettings)

      await audit.sendEvent({
        subjectId: 'save-app-settings-event',
        operation: 'SAVE_APP_SETTINGS',
        meta: {
          entityName: 'AppSettings',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(currentSettings),
          entityAfterAction: JSON.stringify(newSettings),
        },
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        error,
        message: 'saveAppSettings-error',
      })

      return { status: 'error', message: error }
    }
  },
  saveB2BSettings: async (
    _: void,
    {
      input: {
        autoApprove,
        businessReadOnly,
        stateReadOnly,
        defaultPaymentTerms,
        defaultPriceTables,
        uiSettings,
        organizationCustomFields,
        costCenterCustomFields,
        transactionEmailSettings,
      },
    }: {
      input: B2BSettingsInput
      page: number
      pageSize: number
    },
    ctx: Context
  ) => {
    const {
      clients: { vbase, audit },
      vtex: { logger },
      ip
    } = ctx

    // create schema if it doesn't exist
    await checkConfig(ctx)

    const B2B_SETTINGS_DATA_ENTITY = 'b2b_settings'

    // Get current settings to save them depending on where the saveB2BSettings is coming from. Custom fields come without autoApprove settings and vice versa.

    let currentB2BSettings: B2BSettingsInput | undefined

    try {
      const getSettingsObj: B2BSettingsInput = await vbase.getJSON(
        B2B_SETTINGS_DATA_ENTITY,
        'settings'
      )

      currentB2BSettings = getSettingsObj
    } catch (e) {
      if (e.response?.status === 404) {
        // when run for the first time on the project - returns 404. ignore in that case
      } else {
        logger.error({
          message: 'saveB2BSettings-currentB2BSettings-error',
          error: e,
        })
        if (e.message) {
          throw new GraphQLError(e.message)
        } else if (e.response?.data?.message) {
          throw new GraphQLError(e.response.data.message)
        } else {
          throw new GraphQLError(e)
        }
      }
    }

    try {
      const b2bSettings = {
        autoApprove,
        businessReadOnly,
        stateReadOnly,
        costCenterCustomFields:
          costCenterCustomFields ?? currentB2BSettings?.costCenterCustomFields,
        defaultPaymentTerms,
        defaultPriceTables,
        organizationCustomFields:
          organizationCustomFields ??
          currentB2BSettings?.organizationCustomFields,
        transactionEmailSettings:
          transactionEmailSettings ??
          currentB2BSettings?.transactionEmailSettings,
        uiSettings: {
          showModal:
            uiSettings?.showModal ?? currentB2BSettings?.uiSettings?.showModal,
          clearCart:
            uiSettings?.clearCart ?? currentB2BSettings?.uiSettings?.clearCart,
          topBar: uiSettings?.topBar ?? currentB2BSettings?.uiSettings?.topBar,
        },
      }

      await vbase.saveJSON(B2B_SETTINGS_DATA_ENTITY, 'settings', b2bSettings)

      await audit.sendEvent({
        subjectId: 'save-b2b-settings-event',
        operation: 'SAVE_B2B_SETTINGS',
        meta: {
          entityName: 'B2BSettings',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(currentB2BSettings ?? null),
          entityAfterAction: JSON.stringify(b2bSettings),
        },
      })

      return {
        status: 'success',
      }
    } catch (e) {
      logger.error({
        error: e,
        message: 'saveB2BSettings-error',
      })
      if (e.message) {
        throw new GraphQLError(e.message)
      } else if (e.response?.data?.message) {
        throw new GraphQLError(e.response.data.message)
      } else {
        throw new GraphQLError(e)
      }
    }
  },

  saveSalesChannels: async (
    _: void,
    { channels }: { channels: any[] },
    ctx: Context
  ) => {
    const {
      clients: { vbase, audit },
      vtex: { logger },
      ip
    } = ctx

    const currentChannels = await vbase.getJSON('b2borg', 'salesChannels').catch(() => null)

    try {
      await vbase.saveJSON('b2borg', 'salesChannels', channels)

      await audit.sendEvent({
        subjectId: 'save-sales-channels-event',
        operation: 'SAVE_SALES_CHANNELS',
        meta: {
          entityName: 'SalesChannels',
          remoteIpAddress: ip,
          entityBeforeAction: JSON.stringify(currentChannels),
          entityAfterAction: JSON.stringify(channels),
        },
      })

      return { status: 'success', message: '' }
    } catch (error) {
      logger.error({
        error,
        message: 'saveSalesChannels-Error',
      })

      return { status: 'error', message: error }
    }
  },
}

export default Settings
