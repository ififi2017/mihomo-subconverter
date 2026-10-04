/**
 * Optional access control for the API endpoints.
 *
 * Set the ACCESS_TOKEN environment variable on your deployment to require a
 * matching `token` query parameter on /api/clash and /api/preview-template.
 * When unset (the default), the API stays open — zero-config deploys keep working.
 *
 * Uses a timing-safe comparison to prevent timing side-channel attacks
 * against the token value.
 */
import crypto from 'crypto'

export function checkAccessToken(req) {
  const required = process.env.ACCESS_TOKEN
  if (!required) return true

  const token =
    (typeof req.query?.token === 'string' && req.query.token) ||
    (typeof req.body?.token === 'string' && req.body.token) ||
    ''
  if (typeof token !== 'string') return false
  // timingSafeEqual requires equal-length buffers, so length-check first
  if (token.length !== required.length) return false
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(required))
}
