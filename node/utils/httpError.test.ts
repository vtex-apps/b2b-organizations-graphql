import { getHttpStatus, isNotFoundError } from './httpError'

describe('httpError helpers', () => {
  it('reads status from axios-style errors', () => {
    expect(getHttpStatus({ response: { status: 500 } })).toBe(500)
  })

  it('reads status from GraphQL extensions', () => {
    expect(getHttpStatus({ extensions: { status: 404 } })).toBe(404)
  })

  it('treats costCenterNotFound / organizationNotFound as not-found', () => {
    expect(isNotFoundError({ costCenterNotFound: true })).toBe(true)
    expect(isNotFoundError({ organizationNotFound: true })).toBe(true)
  })

  it('treats HTTP 404 as not-found and 500 as not', () => {
    expect(isNotFoundError({ response: { status: 404 } })).toBe(true)
    expect(isNotFoundError({ response: { status: 500 } })).toBe(false)
  })
})
