/**
 * GET /api/check-update
 *
 * Compares the locally deployed version (from package.json) against the
 * latest version on the GitHub main branch. Results are cached in memory
 * for 1 hour to avoid hammering the GitHub CDN.
 *
 * Response:
 *   { current: string, latest: string, hasUpdate: boolean, url: string }
 */

import pkg from '../../package.json'

const REPO_URL     = 'https://github.com/ififi2017/mihomo-subconverter'
const RAW_PKG_URL  = 'https://raw.githubusercontent.com/ififi2017/mihomo-subconverter/main/package.json'
const CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

let _cache = null  // { data, expiresAt }

/** Simple semver compare: returns true if b > a */
function isNewer(a, b) {
  const parse = v => String(v).replace(/^v/, '').split('.').map(n => parseInt(n) || 0)
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (bMaj !== aMaj) return bMaj > aMaj
  if (bMin !== aMin) return bMin > aMin
  return bPat > aPat
}

export default async function handler(req, res) {
  // Serve from cache if still fresh
  if (_cache && Date.now() < _cache.expiresAt) {
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).json(_cache.data)
  }

  const current = pkg.version

  let latest = current
  try {
    const ghRes = await fetch(RAW_PKG_URL, {
      headers: { 'User-Agent': 'mihomo-subconverter-update-check' },
      signal: AbortSignal.timeout(5_000),
    })
    if (ghRes.ok) {
      const ghPkg = await ghRes.json()
      if (ghPkg?.version) latest = ghPkg.version
    }
  } catch {
    // Network failure — report no update rather than throwing
  }

  const data = { current, latest, hasUpdate: isNewer(current, latest), url: REPO_URL }
  _cache = { data, expiresAt: Date.now() + CACHE_TTL_MS }

  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.status(200).json(data)
}
