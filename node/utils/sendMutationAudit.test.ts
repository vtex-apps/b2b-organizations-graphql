import {
  sendMutationAudit,
  sendMutationAuditFireAndForget,
} from './sendMutationAudit'

const entry = {
  subjectId: 'subject',
  operation: 'OP',
  meta: {},
} as unknown as AuditEntry

const ctxWith = (sendEventStrict: jest.Mock) =>
  ({
    clients: { audit: { sendEventStrict } },
  } as unknown as Context)

describe('sendMutationAudit (strict, idempotent writes)', () => {
  it('rejects when the audit call fails', async () => {
    const ctx = ctxWith(jest.fn().mockRejectedValue(new Error('audit down')))

    await expect(sendMutationAudit(ctx, entry)).rejects.toThrow('audit down')
  })
})

describe('sendMutationAuditFireAndForget (non-idempotent writes)', () => {
  it('dispatches the event without waiting for it', () => {
    const sendEventStrict = jest.fn(() => new Promise<void>(() => {}))
    const ctx = ctxWith(sendEventStrict)

    expect(sendMutationAuditFireAndForget(ctx, entry)).toBeUndefined()
  })

  it('swallows audit failures (no unhandled rejection)', async () => {
    const sendEventStrict = jest.fn().mockRejectedValue(new Error('audit down'))

    const ctx = ctxWith(sendEventStrict)

    expect(() => sendMutationAuditFireAndForget(ctx, entry)).not.toThrow()
    await new Promise<void>((resolve) => setImmediate(() => resolve()))

    expect(sendEventStrict).toHaveBeenCalledWith(entry)
  })

  it('swallows synchronous throws from the client', async () => {
    const ctx = ctxWith(
      jest.fn(() => {
        throw new Error('boom')
      })
    )

    expect(() => sendMutationAuditFireAndForget(ctx, entry)).not.toThrow()
    await new Promise<void>((resolve) => setImmediate(() => resolve()))
  })
})
