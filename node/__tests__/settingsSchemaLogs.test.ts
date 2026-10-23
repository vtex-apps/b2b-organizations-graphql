/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * B2BTEAM-3987 (US-4, SDD §4.4): logger spies for the settings / schema /
 * template keys.
 *
 * - `checkConfig.readSettingsError` / `checkConfig.schemaUpdateError` /
 *   `checkConfig.templateError` (warn, never fails the caller, hash not saved)
 *   / `checkConfig.saveSettingsError`; 304 and a first-run 404 stay silent.
 * - `ensureConfigForQuery` does not cache an incomplete sync.
 * - `saveB2BSettings.readSettingsError` / `saveB2BSettings.error` /
 *   `saveSalesChannels.error`.
 * - `getAppSettings.readSettingsError` / `getAppSettings.schemaUpdateError`
 *   (no TypeError when the error has no response).
 * - `getB2BSettings.error` / `getOrganizationCustomFields.error` /
 *   `getSellers.error` / `getSellersPaginated.error` / `getAccount.error`.
 */
import checkConfig, { CheckConfigIncompleteError } from '../resolvers/config'
import SettingsMutations from '../resolvers/Mutations/Settings'
import SettingsQueries from '../resolvers/Queries/Settings'
import UsersQueries from '../resolvers/Queries/Users'
import { ensureConfigForQuery } from '../utils/queryObservability'
import { schemas } from '../mdSchema'
import templates from '../templates'
import { toHash } from '../utils'

jest.mock('@vtex/diagnostics-nodejs', () => ({}))
jest.mock('@vtex/api', () => ({
  // Minimal LRU: stores only what the factory resolved, like the real one.
  LRUCache: class {
    private store = new Map<string, any>()

    public async getOrSet(key: string, factory: () => Promise<any>) {
      if (this.store.has(key)) {
        return this.store.get(key)
      }

      const { value } = await factory()

      this.store.set(key, value)

      return value
    }

    public getStats(name: string) {
      return { hits: 0, itemCount: this.store.size, misses: 0, name }
    }
  },
}))

const httpError = (status?: number, message = `status ${status}`) =>
  Object.assign(new Error(message), {
    config: { method: 'get', url: '/secret?_where=email=a@b.com' },
    ...(status ? { response: { status, headers: {}, data: {} } } : {}),
  })

const SETTINGS_KEY = 'settings-v2'

const makeLogger = () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
})

let workspaceSeq = 0

const makeCtx = (overrides: Record<string, any> = {}) => {
  const logger = makeLogger()
  const clients = {
    audit: {
      sendEvent: jest.fn().mockResolvedValue(undefined),
      sendEventStrict: jest.fn().mockResolvedValue(undefined),
    },
    lm: { getAccount: jest.fn() },
    mail: {
      getTemplate: jest.fn().mockResolvedValue({ Name: 'exists' }),
      publishTemplate: jest.fn().mockResolvedValue(undefined),
    },
    masterdata: {
      createOrUpdateSchema: jest.fn().mockResolvedValue(undefined),
    },
    sellers: {
      getSellers: jest.fn(),
      getSellersPaginated: jest.fn(),
    },
    vbase: {
      getJSON: jest.fn().mockResolvedValue(null),
      saveJSON: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  }

  workspaceSeq += 1

  return {
    clients,
    ip: '127.0.0.1',
    logger,
    // Unique workspace per ctx: the check-config cache is module-level.
    vtex: { account: 'acc', logger, workspace: `ws${workspaceSeq}` },
  } as any
}

const messages = (spy: jest.Mock) =>
  spy.mock.calls.map(([payload]) => payload?.message)

const findLog = (spy: jest.Mock, message: string) =>
  spy.mock.calls.find(([payload]) => payload?.message === message)?.[0]

const flush = () =>
  new Promise<void>((resolve) => {
    setImmediate(() => resolve())
  })

beforeAll(() => {
  process.env.VTEX_APP_ID = 'vtex.b2b-organizations-graphql@2.8.5'
})

describe('checkConfig (B2BTEAM-3987)', () => {
  it('first run (404) is silent and saves both hashes', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.getJSON.mockRejectedValueOnce(httpError(404))
    ctx.clients.mail.getTemplate.mockResolvedValue(null)

    const result = await checkConfig(ctx)

    expect(ctx.logger.error).not.toHaveBeenCalled()
    expect(ctx.logger.warn).not.toHaveBeenCalled()
    expect(ctx.clients.mail.publishTemplate).toHaveBeenCalledTimes(
      templates.length
    )
    expect(ctx.clients.vbase.saveJSON).toHaveBeenCalledWith(
      'mdSchema',
      SETTINGS_KEY,
      { schemaHash: toHash(schemas), templateHash: toHash(templates) }
    )
    expect(result).toEqual({
      schemaHash: toHash(schemas),
      templateHash: toHash(templates),
    })
  })

  it('does not leak hashes into the shared default settings', async () => {
    const first = makeCtx()

    await checkConfig(first)

    const second = makeCtx()

    second.clients.masterdata.createOrUpdateSchema.mockRejectedValue(
      httpError(500)
    )
    second.clients.mail.getTemplate.mockRejectedValue(httpError(500))

    const result = await checkConfig(second)

    expect(result).toEqual({ schemaHash: null, templateHash: null })
  })

  it('non-404 read error logs checkConfig.readSettingsError and skips the sync', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.getJSON.mockRejectedValueOnce(httpError(503))

    expect(await checkConfig(ctx)).toBeDefined()

    const log = findLog(ctx.logger.error, 'checkConfig.readSettingsError')

    expect(log).toMatchObject({
      entity: 'Settings',
      operation: 'checkConfig',
      settingsKey: SETTINGS_KEY,
    })
    expect(log.error.status).toBe(503)
    expect(log.error.path).toBe('/secret')
    expect(ctx.clients.masterdata.createOrUpdateSchema).not.toHaveBeenCalled()
    expect(ctx.clients.mail.getTemplate).not.toHaveBeenCalled()
    expect(ctx.clients.vbase.saveJSON).not.toHaveBeenCalled()
  })

  it('304 on schema update is silent and counts as success', async () => {
    const ctx = makeCtx()

    ctx.clients.masterdata.createOrUpdateSchema.mockRejectedValue(
      httpError(304)
    )

    await checkConfig(ctx)

    expect(ctx.logger.error).not.toHaveBeenCalled()
    expect(ctx.clients.vbase.saveJSON.mock.calls[0][2].schemaHash).toBe(
      toHash(schemas)
    )
  })

  it('non-304 schema failure logs checkConfig.schemaUpdateError per data entity and keeps the schema hash unset', async () => {
    const ctx = makeCtx()

    ctx.clients.masterdata.createOrUpdateSchema.mockImplementation(
      ({ dataEntity }: { dataEntity: string }) =>
        dataEntity === schemas[0].name
          ? Promise.reject(httpError(500))
          : Promise.resolve()
    )

    await checkConfig(ctx)

    const logs = ctx.logger.error.mock.calls
      .map(([payload]: any[]) => payload)
      .filter((p: any) => p.message === 'checkConfig.schemaUpdateError')

    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      dataEntity: schemas[0].name,
      entity: 'Settings',
      operation: 'checkConfig',
    })
    expect(logs[0].error.status).toBe(500)

    // Templates still synced and saved; schema hash stays null for a retry.
    expect(ctx.clients.vbase.saveJSON.mock.calls[0][2]).toEqual({
      schemaHash: null,
      templateHash: toHash(templates),
    })
  })

  it('template failure warns checkConfig.templateError, does not throw and does not save the template hash', async () => {
    const ctx = makeCtx()

    ctx.clients.mail.getTemplate.mockResolvedValue(null)
    ctx.clients.mail.publishTemplate.mockImplementation((template: any) =>
      template.Name === templates[1].Name
        ? Promise.reject(httpError(500))
        : Promise.resolve()
    )

    expect(await checkConfig(ctx)).toBeDefined()

    const log = findLog(ctx.logger.warn, 'checkConfig.templateError')

    expect(log).toMatchObject({
      entity: 'Settings',
      operation: 'checkConfig',
      template: templates[1].Name,
    })
    expect(ctx.logger.error).not.toHaveBeenCalled()
    expect(ctx.clients.vbase.saveJSON.mock.calls[0][2]).toEqual({
      schemaHash: toHash(schemas),
      templateHash: null,
    })
  })

  it('getTemplate failure warns and is retried on the next call', async () => {
    const ctx = makeCtx()
    const stored = { schemaHash: toHash(schemas), templateHash: 'old' }

    ctx.clients.vbase.getJSON.mockResolvedValue(stored)
    ctx.clients.mail.getTemplate.mockRejectedValueOnce(httpError(500))

    await checkConfig(ctx)

    expect(messages(ctx.logger.warn)).toContain('checkConfig.templateError')
    expect(ctx.clients.vbase.saveJSON).not.toHaveBeenCalled()

    await checkConfig(ctx)

    expect(ctx.clients.vbase.saveJSON).toHaveBeenCalledWith(
      'mdSchema',
      SETTINGS_KEY,
      { schemaHash: toHash(schemas), templateHash: toHash(templates) }
    )
  })

  it('getTemplate 404 publishes the template', async () => {
    const ctx = makeCtx()

    ctx.clients.mail.getTemplate.mockRejectedValue(httpError(404))

    await checkConfig(ctx)

    expect(ctx.logger.warn).not.toHaveBeenCalled()
    expect(ctx.clients.mail.publishTemplate).toHaveBeenCalledTimes(
      templates.length
    )
  })

  it('save failure logs checkConfig.saveSettingsError and does not throw', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.saveJSON.mockRejectedValueOnce(httpError(500))

    expect(await checkConfig(ctx)).toBeDefined()

    expect(
      findLog(ctx.logger.error, 'checkConfig.saveSettingsError')
    ).toMatchObject({ settingsKey: SETTINGS_KEY, operation: 'checkConfig' })
  })

  it('nothing to do when the stored hashes are current', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.getJSON.mockResolvedValue({
      schemaHash: toHash(schemas),
      templateHash: toHash(templates),
    })

    await checkConfig(ctx)

    expect(ctx.clients.masterdata.createOrUpdateSchema).not.toHaveBeenCalled()
    expect(ctx.clients.mail.getTemplate).not.toHaveBeenCalled()
    expect(ctx.clients.vbase.saveJSON).not.toHaveBeenCalled()
  })

  it('throwOnIncomplete rejects with CheckConfigIncompleteError', async () => {
    const ctx = makeCtx()

    ctx.clients.mail.getTemplate.mockRejectedValue(httpError(500))

    await expect(
      checkConfig(ctx, { throwOnIncomplete: true })
    ).rejects.toBeInstanceOf(CheckConfigIncompleteError)
  })
})

describe('ensureConfigForQuery (B2BTEAM-3987)', () => {
  it('does not cache a failed sync and does not double-log it', async () => {
    const ctx = makeCtx()

    ctx.clients.mail.getTemplate.mockRejectedValueOnce(httpError(500))

    ensureConfigForQuery(ctx)
    await flush()
    await flush()

    expect(messages(ctx.logger.warn)).toContain('checkConfig.templateError')
    expect(messages(ctx.logger.error)).not.toContain(
      'ensureConfigForQuery-error'
    )
    expect(ctx.clients.vbase.getJSON).toHaveBeenCalledTimes(1)

    // Next query retries (not cached) and succeeds.
    ensureConfigForQuery(ctx)
    await flush()
    await flush()

    expect(ctx.clients.vbase.getJSON).toHaveBeenCalledTimes(2)
    expect(ctx.clients.vbase.saveJSON).toHaveBeenCalledTimes(2)

    // Now synced: cached, no more reads.
    ensureConfigForQuery(ctx)
    await flush()

    expect(ctx.clients.vbase.getJSON).toHaveBeenCalledTimes(2)
  })

  it('does not cache when the settings read fails', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.getJSON.mockRejectedValueOnce(httpError(503))

    ensureConfigForQuery(ctx)
    await flush()

    expect(messages(ctx.logger.error)).toEqual([
      'checkConfig.readSettingsError',
    ])

    ensureConfigForQuery(ctx)
    await flush()

    expect(ctx.clients.vbase.getJSON).toHaveBeenCalledTimes(2)
  })
})

describe('saveB2BSettings / saveSalesChannels (B2BTEAM-3987)', () => {
  const input = { input: { autoApprove: true } } as any

  it('first run (404 on read) is silent', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.getJSON.mockImplementation((bucket: string) =>
      bucket === 'b2b_settings'
        ? Promise.reject(httpError(404))
        : Promise.resolve(null)
    )

    expect(
      await SettingsMutations.saveB2BSettings(undefined, input, ctx)
    ).toEqual({ status: 'success' })
    expect(ctx.logger.error).not.toHaveBeenCalled()
  })

  it('a template failure no longer fails the mutation', async () => {
    const ctx = makeCtx()

    ctx.clients.mail.getTemplate.mockRejectedValue(httpError(500))

    expect(
      await SettingsMutations.saveB2BSettings(undefined, input, ctx)
    ).toEqual({ status: 'success' })
    expect(messages(ctx.logger.warn)).toContain('checkConfig.templateError')
  })

  it('non-404 read logs saveB2BSettings.readSettingsError', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.getJSON.mockImplementation((bucket: string) =>
      bucket === 'b2b_settings'
        ? Promise.reject(httpError(500, 'vbase down'))
        : Promise.resolve(null)
    )

    await expect(
      SettingsMutations.saveB2BSettings(undefined, input, ctx)
    ).rejects.toThrow('vbase down')

    const log = findLog(ctx.logger.error, 'saveB2BSettings.readSettingsError')

    expect(log).toMatchObject({
      entity: 'Settings',
      operation: 'saveB2BSettings',
    })
    expect(log.error.status).toBe(500)
    expect(ctx.clients.vbase.saveJSON).not.toHaveBeenCalledWith(
      'b2b_settings',
      'settings',
      expect.anything()
    )
  })

  it('write failure logs saveB2BSettings.error', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.saveJSON.mockImplementation((bucket: string) =>
      bucket === 'b2b_settings'
        ? Promise.reject(httpError(500, 'write failed'))
        : Promise.resolve()
    )

    await expect(
      SettingsMutations.saveB2BSettings(undefined, input, ctx)
    ).rejects.toThrow('write failed')
    expect(
      findLog(ctx.logger.error, 'saveB2BSettings.error').error.status
    ).toBe(500)
  })

  it('saveSalesChannels failure logs saveSalesChannels.error and returns a string message', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.saveJSON.mockRejectedValueOnce(
      httpError(500, 'write failed')
    )

    const result = await SettingsMutations.saveSalesChannels(
      undefined,
      { channels: [{ id: '1' }] },
      ctx
    )

    expect(result).toEqual({ status: 'error', message: 'write failed' })

    const log = findLog(ctx.logger.error, 'saveSalesChannels.error')

    expect(log).toMatchObject({
      entity: 'Settings',
      operation: 'saveSalesChannels',
    })
    // Request data never reaches the log.
    expect(JSON.stringify(log)).not.toContain('a@b.com')
  })
})

describe('getAppSettings (B2BTEAM-3987)', () => {
  it('first run (404) is silent and saves the schema hash', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.getJSON.mockRejectedValueOnce(httpError(404))

    await UsersQueries.getAppSettings(undefined, undefined, ctx)

    expect(ctx.logger.error).not.toHaveBeenCalled()
    expect(ctx.clients.vbase.saveJSON).toHaveBeenCalledTimes(1)
  })

  it('non-404 read logs getAppSettings.readSettingsError and does not update or save', async () => {
    const ctx = makeCtx()

    ctx.clients.vbase.getJSON.mockRejectedValueOnce(httpError(503))

    await expect(
      UsersQueries.getAppSettings(undefined, undefined, ctx)
    ).toBeDefined()

    expect(
      findLog(ctx.logger.error, 'getAppSettings.readSettingsError')
    ).toMatchObject({ entity: 'Settings', operation: 'getAppSettings' })
    expect(ctx.clients.masterdata.createOrUpdateSchema).not.toHaveBeenCalled()
    expect(ctx.clients.vbase.saveJSON).not.toHaveBeenCalled()
  })

  it('304 is silent', async () => {
    const ctx = makeCtx()

    ctx.clients.masterdata.createOrUpdateSchema.mockRejectedValue(
      httpError(304)
    )

    await UsersQueries.getAppSettings(undefined, undefined, ctx)

    expect(ctx.logger.error).not.toHaveBeenCalled()
    expect(ctx.clients.vbase.saveJSON).toHaveBeenCalledTimes(1)
  })

  it('error without a response logs getAppSettings.schemaUpdateError and rethrows it (no TypeError)', async () => {
    const ctx = makeCtx()
    const boom = new Error('socket hang up')

    ctx.clients.masterdata.createOrUpdateSchema.mockRejectedValue(boom)

    await expect(
      UsersQueries.getAppSettings(undefined, undefined, ctx)
    ).rejects.toBe(boom)

    const logs = ctx.logger.error.mock.calls
      .map(([payload]: any[]) => payload)
      .filter((p: any) => p.message === 'getAppSettings.schemaUpdateError')

    expect(logs).toHaveLength(schemas.length)
    expect(logs[0]).toMatchObject({
      dataEntity: schemas[0].name,
      operation: 'getAppSettings',
    })
    expect(ctx.clients.vbase.saveJSON).not.toHaveBeenCalled()
  })
})

describe('settings queries (B2BTEAM-3987)', () => {
  it.each(['getB2BSettings', 'getOrganizationCustomFields'])(
    '%s logs <op>.error',
    async (op) => {
      const ctx = makeCtx()

      ctx.clients.vbase.getJSON.mockImplementation((bucket: string) =>
        bucket === 'b2b_settings'
          ? Promise.reject(httpError(500, 'vbase down'))
          : Promise.resolve(null)
      )

      await expect(
        (SettingsQueries as any)[op](undefined, undefined, ctx)
      ).rejects.toThrow('vbase down')

      expect(findLog(ctx.logger.error, `${op}.error`)).toMatchObject({
        entity: 'Settings',
        operation: op,
      })
    }
  )

  it('getSellersPaginated logs getSellersPaginated.error and keeps the message', async () => {
    const ctx = makeCtx()

    ctx.clients.sellers.getSellersPaginated.mockRejectedValue(
      httpError(502, 'bad gateway')
    )

    await expect(
      SettingsQueries.getSellersPaginated(undefined, {} as any, ctx)
    ).rejects.toThrow('bad gateway')

    const log = findLog(ctx.logger.error, 'getSellersPaginated.error')

    expect(log).toMatchObject({
      entity: 'Seller',
      operation: 'getSellersPaginated',
    })
    expect(log.error.status).toBe(502)
  })

  it('getSellers logs getSellers.error and rethrows the same error', async () => {
    const ctx = makeCtx()
    const boom = httpError(500, 'sellers down')

    ctx.clients.sellers.getSellers.mockRejectedValue(boom)

    await expect(
      SettingsQueries.getSellers(undefined, undefined, ctx)
    ).rejects.toBe(boom)
    expect(findLog(ctx.logger.error, 'getSellers.error')).toMatchObject({
      entity: 'Seller',
      operation: 'getSellers',
    })
  })

  it('getAccount logs getAccount.error and keeps the message', async () => {
    const ctx = makeCtx()

    ctx.clients.lm.getAccount.mockRejectedValue(httpError(403, 'forbidden'))

    await expect(
      SettingsQueries.getAccount(undefined, undefined, ctx)
    ).rejects.toThrow('forbidden')
    expect(findLog(ctx.logger.error, 'getAccount.error')).toMatchObject({
      entity: 'Account',
      operation: 'getAccount',
    })
  })
})
