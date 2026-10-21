import GraphQLError, { withLogLevel } from './GraphQLError'

describe('withLogLevel', () => {
  it('adds an own enumerable level without changing message or extensions', () => {
    const error = withLogLevel(new GraphQLError('organizationNotFound'), 'warn')

    expect(error).toBeInstanceOf(GraphQLError)
    expect(error.message).toBe('organizationNotFound')
    expect(error.extensions).toEqual({ message: 'organizationNotFound' })
    expect(error.level).toBe('warn')
    // @vtex/api builds extensions.exception from the error's own enumerable fields
    expect({ ...error }).toMatchObject({ level: 'warn' })
  })
})
