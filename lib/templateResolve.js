/**
 * Load an ACL4SSR INI template with a China-friendly fetch chain and URL cache.
 *
 * Default template: testingcf.jsdelivr → cdn.jsdelivr → GitHub raw → bundled snapshot.
 * Custom URLs: fetch as given; if that fails and the URL is GitHub raw, retry the jsDelivr rewrite.
 */
import fs from 'fs'
import path from 'path'
import { DEFAULT_TEMPLATE_MIRRORS, TEMPLATE_CACHE_TTL_MS } from './constants'
import { cacheGet, cacheSet, cacheKey } from './cache'
import { fetchTextCapped } from './safeFetch'
import { isDefaultTemplateUrl, rewriteGithubRawUrl } from './githubMirror'

export function readBundledDefaultIni() {
  const filePath = path.join(process.cwd(), 'templates', 'MetaCubeX_Full.ini')
  return fs.readFileSync(filePath, 'utf8')
}

function looksLikeIni(text) {
  return typeof text === 'string' && /(?:^|\n)(?:custom_proxy_group=|ruleset=)/.test(text)
}

async function tryFetchIni(url) {
  const text = await fetchTextCapped(url)
  if (!looksLikeIni(text)) throw new Error('Not an INI template')
  return text
}

/**
 * @param {string} templateUrl  Validated URL, or DEFAULT_TEMPLATE_URL
 * @param {{ isDefault?: boolean }} [opts]
 * @returns {Promise<{ ini: string, source: string }>}
 */
export async function loadTemplateIni(templateUrl, { isDefault = false } = {}) {
  const cacheId = isDefault || isDefaultTemplateUrl(templateUrl) ? 'default' : templateUrl
  const key = cacheKey('ini', cacheId)
  const hit = cacheGet(key)
  if (hit?.ini) return hit

  if (isDefault || isDefaultTemplateUrl(templateUrl)) {
    const errors = []
    for (const url of DEFAULT_TEMPLATE_MIRRORS) {
      try {
        const ini = await tryFetchIni(url)
        const payload = { ini, source: url }
        cacheSet(key, payload, TEMPLATE_CACHE_TTL_MS)
        return payload
      } catch (e) {
        errors.push(`${url}: ${e.message}`)
      }
    }
    const ini = readBundledDefaultIni()
    if (!looksLikeIni(ini)) {
      throw new Error(`Failed to load default template (${errors.join('; ')})`)
    }
    const payload = { ini, source: 'bundled' }
    cacheSet(key, payload, TEMPLATE_CACHE_TTL_MS)
    return payload
  }

  try {
    const ini = await tryFetchIni(templateUrl)
    const payload = { ini, source: templateUrl }
    cacheSet(key, payload, TEMPLATE_CACHE_TTL_MS)
    return payload
  } catch (e) {
    const mirrored = rewriteGithubRawUrl(templateUrl)
    if (mirrored && mirrored !== templateUrl) {
      try {
        const ini = await tryFetchIni(mirrored)
        const payload = { ini, source: mirrored }
        cacheSet(key, payload, TEMPLATE_CACHE_TTL_MS)
        return payload
      } catch { /* fall through to original error */ }
    }
    throw e
  }
}
