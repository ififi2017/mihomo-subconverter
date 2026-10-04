/**
 * Hardened fetching for user-supplied template URLs.
 *
 * - http / https only
 * - Rejects obvious internal targets (localhost, private / link-local / metadata IPs)
 * - Short-form / hex / decimal IPv4 (127.1, 0x7f000001) are treated as the expanded address
 * - Redirects are not followed blindly: each hop is re-validated
 * - Optional host allowlist via TEMPLATE_ALLOWED_HOSTS
 *   (comma-separated; suffix match, e.g. "githubusercontent.com" also allows
 *   raw.githubusercontent.com)
 * - Caps response size so a huge body cannot exhaust function memory
 */

const MAX_BYTES_DEFAULT = 1024 * 1024 // 1 MB — plenty for any INI template
const MAX_REDIRECTS = 1

function ipv4FromUint32(n) {
  if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) return null
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
}

function parseIpv4Host(host) {
  if (/^0x[0-9a-f]+$/i.test(host)) {
    return ipv4FromUint32(Number.parseInt(host, 16))
  }
  if (/^\d+$/.test(host)) {
    return ipv4FromUint32(Number(host))
  }
  const parts = host.split('.')
  if (!parts.length || parts.length > 4) return null
  if (!parts.every(p => /^\d+$/.test(p))) return null
  const nums = parts.map(p => Number(p))
  if (parts.length === 4) {
    if (nums.some(n => n > 255)) return null
    return nums
  }
  if (parts.length === 2) {
    if (nums[0] > 255 || nums[1] > 255) return null
    return [nums[0], 0, 0, nums[1]]
  }
  if (parts.length === 3) {
    if (nums.some(n => n > 255)) return null
    return [nums[0], nums[1], 0, nums[2]]
  }
  return null
}

function isPrivateIpv4(a, b) {
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  if (a >= 224) return true
  return false
}

function isPrivateIp(host) {
  const octets = parseIpv4Host(host)
  if (octets) return isPrivateIpv4(octets[0], octets[1])

  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (!h.includes(':')) return false
  if (h === '::' || h === '::1') return true
  if (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('::ffff:')) return isPrivateIp(h.slice(7))
  return false
}

function isBlockedHost(rawHost) {
  const host = String(rawHost || '').toLowerCase().replace(/\.+$/, '')
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  return isPrivateIp(host)
}

/**
 * Validate a user-supplied template URL.
 * @returns {string|null} normalized URL, or null if not allowed
 */
export function validateTemplateUrl(raw) {
  if (!raw) return null
  let u
  try { u = new URL(String(raw).trim()) } catch { return null }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null

  if (isBlockedHost(u.hostname)) return null

  const allow = (process.env.TEMPLATE_ALLOWED_HOSTS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
  const host = u.hostname.toLowerCase().replace(/\.+$/, '')
  if (allow.length > 0 && !allow.some(a => host === a || host.endsWith('.' + a))) {
    return null
  }

  return u.toString()
}

async function readCappedBody(res, maxBytes) {
  const declared = parseInt(res.headers.get('content-length'), 10)
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`Response too large (${declared} bytes, limit ${maxBytes})`)
  }

  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text()
    if (text.length > maxBytes) throw new Error(`Response too large (over ${maxBytes} bytes)`)
    return text
  }

  const reader = res.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      reader.cancel().catch(() => {})
      throw new Error(`Response too large (over ${maxBytes} bytes)`)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

/**
 * Fetch a text resource with a timeout and a hard size cap.
 * Content-Length may be absent or lying, so the body is streamed and counted.
 * Redirects are re-validated (at most one hop).
 */
export async function fetchTextCapped(url, { timeoutMs = 10_000, maxBytes = MAX_BYTES_DEFAULT } = {}, _depth = 0) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'mihomo-subconverter/1.3' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'manual',
  })

  const status = Number(res.status) || (res.ok ? 200 : 0)
  if (status >= 300 && status < 400) {
    if (_depth >= MAX_REDIRECTS) throw new Error('Too many redirects')
    const loc = res.headers.get('location')
    if (!loc) throw new Error('Redirect without Location')
    let next
    try { next = new URL(loc, url).toString() } catch { throw new Error('Invalid redirect') }
    const validated = validateTemplateUrl(next)
    if (!validated) throw new Error('Redirect blocked')
    return fetchTextCapped(validated, { timeoutMs, maxBytes }, _depth + 1)
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return readCappedBody(res, maxBytes)
}
