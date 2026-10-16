import {
  getOperationName,
  isClientValidationError,
  logStorefrontPermissionsError,
} from './storefrontPermissionsError'

const logger = () => ({ error: jest.fn(), warn: jest.fn() })

const gqlError = (messages: string[]) =>
  Object.assign(new Error('storefront-permissions'), {
    graphQLErrors: messages.map((message) => ({ message })),
  })

describe('storefrontPermissions.queryError (B2BTEAM-3982)', () => {
  it('extracts the operation from the document', () => {
    expect(
      getOperationName(
        'query organizations($email: String!) {\n  getOrganizationsByEmail(email: $email) { id }\n}'
      )
    ).toBe('getOrganizationsByEmail')
    expect(getOperationName('mutation { deleteUser(id: "1") { id } }')).toBe(
      'deleteUser'
    )
  })

  it('logs warn for client-side validation errors', () => {
    const l = logger()
    const err = gqlError([
      'Variable "$email" of required type "String!" was not provided.',
    ])

    expect(isClientValidationError(err)).toBe(true)
    logStorefrontPermissionsError(l, 'getOrganizationsByEmail', err)
    expect(l.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'storefrontPermissions.queryError',
        operation: 'getOrganizationsByEmail',
        graphQLErrors: [
          'Variable "$email" of required type "String!" was not provided.',
        ],
      })
    )
    expect(l.error).not.toHaveBeenCalled()
  })

  it('logs error for real failures (HTTP or resolver errors)', () => {
    const l = logger()
    const httpErr: any = new Error('Request failed with status code 500')

    httpErr.response = { status: 500 }
    logStorefrontPermissionsError(l, 'getUser', httpErr)
    logStorefrontPermissionsError(l, 'getUser', gqlError(['boom']))
    expect(l.error).toHaveBeenCalledTimes(2)
    expect(l.error.mock.calls[0][0].error.status).toBe(500)
    expect(l.warn).not.toHaveBeenCalled()
  })

  it('redacts emails from graphQL error messages', () => {
    const l = logger()

    logStorefrontPermissionsError(
      l,
      'getUsersByEmail',
      gqlError(['user a@b.com not found'])
    )
    expect(JSON.stringify(l.error.mock.calls[0][0])).not.toContain('a@b.com')
  })
})
