import {
  getOperationName,
  getStorefrontPermissionsLogLevel,
  isAuthDeniedError,
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

  it('logs warn when a required variable is sent as null (e.g. user without roleId)', () => {
    const l = logger()
    const err = gqlError([
      'Variable "$id" of non-null type "ID!" must not be null.',
    ])

    expect(isClientValidationError(err)).toBe(true)
    logStorefrontPermissionsError(l, 'getRole', err)
    expect(l.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'storefrontPermissions.queryError',
        operation: 'getRole',
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

  describe('upstream level and authentication errors', () => {
    const withExtensions = (message: string, extensions: any) =>
      Object.assign(new Error('storefront-permissions'), {
        graphQLErrors: [{ message, extensions }],
      })

    it('logs warn for checkUserPermission "User not authenticated" (upstream warn)', () => {
      const l = logger()
      const err = withExtensions(
        'User not authenticated, make sure the query is private',
        { exception: { level: 'warn' }, logLevel: 'warn' }
      )

      logStorefrontPermissionsError(l, 'checkUserPermission', err)
      expect(l.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'storefrontPermissions.queryError',
          operation: 'checkUserPermission',
        })
      )
      expect(l.error).not.toHaveBeenCalled()
    })

    it('logs warn for authentication messages even without upstream level', () => {
      const l = logger()
      const err = gqlError([
        'User not authenticated, make sure the query is private',
      ])

      expect(isAuthDeniedError(err)).toBe(true)
      logStorefrontPermissionsError(l, 'checkUserPermission', err)
      expect(l.warn).toHaveBeenCalledTimes(1)
      expect(l.error).not.toHaveBeenCalled()
      expect(
        getStorefrontPermissionsLogLevel(gqlError(['Access denied']))
      ).toBe('warn')
      expect(
        getStorefrontPermissionsLogLevel(gqlError(['operation-not-permitted']))
      ).toBe('warn')
    })

    it('honors upstream warn for any message', () => {
      expect(
        getStorefrontPermissionsLogLevel(
          withExtensions('Something expected', { exception: { level: 'warn' } })
        )
      ).toBe('warn')
      expect(
        getStorefrontPermissionsLogLevel(
          withExtensions('Something expected', { logLevel: 'warn' })
        )
      ).toBe('warn')
    })

    it('an explicit upstream error wins over message patterns', () => {
      const l = logger()

      logStorefrontPermissionsError(
        l,
        'checkUserPermission',
        withExtensions(
          'User not authenticated, make sure the query is private',
          {
            exception: { level: 'error' },
          }
        )
      )
      expect(l.error).toHaveBeenCalledTimes(1)
      expect(l.warn).not.toHaveBeenCalled()
    })

    it('logs error when any error is not expected', () => {
      const err = Object.assign(new Error('storefront-permissions'), {
        graphQLErrors: [
          { message: 'User not authenticated, make sure the query is private' },
          { message: 'boom' },
        ],
      })

      expect(getStorefrontPermissionsLogLevel(err)).toBe('error')
      expect(
        getStorefrontPermissionsLogLevel(new Error('socket hang up'))
      ).toBe('error')
    })
  })
})
