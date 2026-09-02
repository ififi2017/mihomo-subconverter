import { describe, it, expect, afterEach } from 'vitest'
import { checkAccessToken } from '../lib/auth'

/**
 * Build a minimal mock of Next.js req object with a query parameter.
 */
function reqWithToken(token) {
  return { query: { token: token ?? '' } }
}

describe('checkAccessToken', () => {
  afterEach(() => {
    delete process.env.ACCESS_TOKEN
  })

  it('allows all requests when ACCESS_TOKEN is not set', () => {
    expect(checkAccessToken(reqWithToken(''))).toBe(true)
    expect(checkAccessToken(reqWithToken('anything'))).toBe(true)
    expect(checkAccessToken(reqWithToken(null))).toBe(true)
  })

  it('allows requests with the correct token', () => {
    process.env.ACCESS_TOKEN = 'my-secret-token'
    expect(checkAccessToken(reqWithToken('my-secret-token'))).toBe(true)
  })

  it('rejects requests without a token', () => {
    process.env.ACCESS_TOKEN = 'my-secret-token'
    expect(checkAccessToken(reqWithToken(''))).toBe(false)
  })

  it('rejects requests with the wrong token', () => {
    process.env.ACCESS_TOKEN = 'my-secret-token'
    expect(checkAccessToken(reqWithToken('wrong'))).toBe(false)
  })

  it('rejects requests with a token of different length', () => {
    process.env.ACCESS_TOKEN = 'my-secret-token'
    expect(checkAccessToken(reqWithToken('short'))).toBe(false)
    expect(checkAccessToken(reqWithToken('my-secret-token-with-more-chars'))).toBe(false)
  })

  it('rejects non-string token values', () => {
    process.env.ACCESS_TOKEN = 'secret'
    expect(checkAccessToken({ query: { token: ['array'] } })).toBe(false)
    expect(checkAccessToken({ query: { token: 123 } })).toBe(false)
  })

  it('accepts a matching token from the JSON body', () => {
    process.env.ACCESS_TOKEN = 'my-secret-token'
    expect(checkAccessToken({ query: {}, body: { token: 'my-secret-token' } })).toBe(true)
    expect(checkAccessToken({ query: {}, body: { token: 'wrong' } })).toBe(false)
  })
})