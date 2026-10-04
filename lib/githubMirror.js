/**
 * Rewrite GitHub raw / gh-proxy ruleset URLs to testingcf.jsdelivr.net
 * so Clash clients in mainland China can download .mrs / .list files.
 *
 * Already-jsDelivr URLs, GitHub Releases, and anything we cannot map
 * safely are returned unchanged. No ghproxy is ever written into output.
 */
import { JSDELIVR_GH_PREFIX, DEFAULT_TEMPLATE_URL, DEFAULT_TEMPLATE_MIRRORS } from './constants'

function unwrapDownloadProxy(url) {
  let current = String(url).trim()
  for (let i = 0; i < 3; i++) {
    let u
    try { u = new URL(current) } catch { return current }
    const host = u.hostname.toLowerCase()
    const isProxy =
      host === 'gh-proxy.com' ||
      host.endsWith('.gh-proxy.com') ||
      host.includes('ghproxy')
    if (!isProxy) return current
    const inner = u.pathname.replace(/^\//, '') + u.search
    if (!/^https?:\/\//i.test(inner)) return current
    current = inner
  }
  return current
}

function toJsdelivr(user, repo, ref, filePath) {
  if (!user || !repo || !ref || !filePath) return null
  const path = filePath.replace(/^\/+/, '')
  if (!path) return null
  return `${JSDELIVR_GH_PREFIX}/${user}/${repo}@${ref}/${path}`
}

/**
 * @param {string} raw
 * @returns {string} rewritten or original URL
 */
export function rewriteGithubRawUrl(raw) {
  if (!raw) return raw
  const original = String(raw).trim()
  const url = unwrapDownloadProxy(original)

  let u
  try { u = new URL(url) } catch { return original }

  const host = u.hostname.toLowerCase()

  if (host === 'testingcf.jsdelivr.net') return url

  if (host === 'cdn.jsdelivr.net' || host.endsWith('.jsdelivr.net')) {
    if (u.pathname.startsWith('/gh/')) {
      return `https://testingcf.jsdelivr.net${u.pathname}${u.search}`
    }
    return url
  }

  if (host === 'raw.githubusercontent.com') {
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length >= 4) {
      const [user, repo, branch, ...rest] = parts
      const mapped = toJsdelivr(user, repo, decodeURIComponent(branch), rest.join('/'))
      if (mapped) return mapped
    }
    return original
  }

  if (host === 'github.com') {
    const parts = u.pathname.split('/').filter(Boolean)
    // /user/repo/raw/refs/heads/branch/path
    if (parts.length >= 6 && parts[2] === 'raw' && parts[3] === 'refs' && parts[4] === 'heads') {
      const [user, repo, , , , branch, ...rest] = parts
      const mapped = toJsdelivr(user, repo, decodeURIComponent(branch), rest.join('/'))
      if (mapped) return mapped
    }
    // /user/repo/raw/branch/path
    if (parts.length >= 5 && parts[2] === 'raw') {
      const [user, repo, , branch, ...rest] = parts
      const mapped = toJsdelivr(user, repo, decodeURIComponent(branch), rest.join('/'))
      if (mapped) return mapped
    }
    return original
  }

  return url === original ? original : url
}

export function isDefaultTemplateUrl(url) {
  if (!url) return true
  const norm = String(url).trim().replace(/\/$/, '')
  if (!norm) return true
  return [DEFAULT_TEMPLATE_URL, ...DEFAULT_TEMPLATE_MIRRORS]
    .some(m => String(m).replace(/\/$/, '') === norm)
}
