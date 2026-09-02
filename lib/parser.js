// Protocol parser — references sublink-worker (https://github.com/7Sageer/sublink-worker)
// for edge-case handling patterns. Thanks to 7Sageer for the well-structured implementation.

import { PROXY_PREFIXES } from './constants'

function decodeBase64(s) {
  const normalized = String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '')
  if (!normalized) throw new Error('empty base64')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  const str = normalized + pad
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf-8')
  const binary = atob(str)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function schemeOf(line) {
  const i = line.indexOf('://')
  return i > 0 ? line.slice(0, i) : 'unknown'
}

function looksLikeUriList(text) {
  return text.split(/\r?\n/).some(l => PROXY_PREFIXES.some(p => l.trim().startsWith(p)))
}

function looksLikeClashYaml(text) {
  return /^proxies:\s*$/m.test(text) && /(?:^|\n)\s*-?\s*(?:\{\s*)?name\s*:/.test(text)
}

function tryDecodeSubscription(text) {
  const compact = text.replace(/\s+/g, '')
  if (compact.length < 20) return null
  if (!/^[A-Za-z0-9+/_-]+=*$/.test(compact)) return null
  if (looksLikeUriList(text) || looksLikeClashYaml(text)) return null
  try {
    const decoded = decodeBase64(compact).replace(/^\uFEFF/, '').trim()
    if (looksLikeUriList(decoded) || looksLikeClashYaml(decoded)) return decoded
    return null
  } catch {
    return null
  }
}

function parseYamlScalar(raw) {
  const s = String(raw).trim()
  if (!s) return ''
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'null' || s === '~') return null
  if (/^-?\d+$/.test(s)) return parseInt(s, 10)
  return s
}

function splitFlowFields(inner) {
  const fields = []
  let buf = ''
  let quote = ''
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (quote) {
      buf += c
      if (c === quote && inner[i - 1] !== '\\') quote = ''
      continue
    }
    if (c === '"' || c === "'") { quote = c; buf += c; continue }
    if (c === ',') { fields.push(buf.trim()); buf = ''; continue }
    buf += c
  }
  if (buf.trim()) fields.push(buf.trim())
  return fields
}

function parseFlowMap(raw) {
  const inner = raw.replace(/^\s*\{\s*/, '').replace(/\s*\}\s*$/, '')
  const obj = {}
  for (const field of splitFlowFields(inner)) {
    const colon = field.indexOf(':')
    if (colon < 1) continue
    const k = field.slice(0, colon).trim()
    const v = parseYamlScalar(field.slice(colon + 1))
    if (k) obj[k] = v
  }
  return obj
}

function parseIndentedMap(lines, baseIndent) {
  const obj = {}
  for (let i = 0; i < lines.length; ) {
    const line = lines[i]
    if (!line.trim() || /^\s*#/.test(line)) { i++; continue }
    const indent = line.match(/^ */)[0].length
    if (indent < baseIndent) break
    const trimmed = line.trim()
    const colon = trimmed.indexOf(':')
    if (colon < 1) { i++; continue }
    const key = trimmed.slice(0, colon).trim()
    const rest = trimmed.slice(colon + 1).trim()
    if (rest === '' || rest === '|' || rest === '>') {
      const nested = []
      i++
      while (i < lines.length) {
        const n = lines[i]
        if (!n.trim()) { i++; continue }
        const ni = n.match(/^ */)[0].length
        if (ni <= indent) break
        nested.push(n)
        i++
      }
      const childIndent = nested[0] ? nested[0].match(/^ */)[0].length : indent + 2
      if (nested.some(l => l.trim().startsWith('- '))) {
        obj[key] = nested.map(l => parseYamlScalar(l.replace(/^\s*-\s*/, '')))
      } else {
        obj[key] = parseIndentedMap(nested, childIndent)
      }
      continue
    }
    obj[key] = parseYamlScalar(rest)
    i++
  }
  return obj
}

function parseClashYamlProxies(text) {
  const start = text.search(/^proxies:\s*$/m)
  if (start < 0) return []
  const nl = text.indexOf('\n', start)
  if (nl < 0) return []
  const after = text.slice(nl + 1)
  const lines = after.split(/\r?\n/)
  const body = []
  for (const line of lines) {
    if (line.length && !/^\s/.test(line) && !line.startsWith('-') && /^[A-Za-z0-9_-]+:/.test(line)) break
    body.push(line)
  }

  const items = []
  let current = []
  let itemIndent = null
  const flush = () => {
    if (current.length) items.push(current)
    current = []
    itemIndent = null
  }

  for (const line of body) {
    const m = line.match(/^(\s*)-\s+(.*)$/)
    if (m) {
      const indent = m[1].length
      if (itemIndent === null || indent <= itemIndent) {
        flush()
        itemIndent = indent
        current.push(line)
        continue
      }
    }
    if (current.length) current.push(line)
  }
  flush()

  const proxies = []
  for (const itemLines of items) {
    const first = itemLines[0].replace(/^\s*-\s*/, '').trim()
    let obj
    if (first.startsWith('{')) {
      obj = parseFlowMap(itemLines.join(' ').replace(/^\s*-\s*/, ''))
    } else {
      const indent = itemLines[0].match(/^ */)[0].length
      const rewritten = [itemLines[0].replace(/^(\s*)-\s*/, '$1'), ...itemLines.slice(1)]
      obj = parseIndentedMap(rewritten, indent)
    }
    if (obj && obj.type && obj.server) {
      if (!obj.name) obj.name = `${obj.server}:${obj.port || ''}`
      proxies.push(obj)
    }
  }
  return proxies
}

function parseUriLines(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const proxies = []

  for (const line of lines) {
    if (line.startsWith('#')) continue
    try {
      let proxy = null
      if      (line.startsWith('hysteria2://') || line.startsWith('hy2://')) proxy = parseHysteria2(line)
      else if (line.startsWith('anytls://'))  proxy = parseAnyTLS(line)
      else if (line.startsWith('vless://'))   proxy = parseVless(line)
      else if (line.startsWith('trojan://'))  proxy = parseTrojan(line)
      else if (line.startsWith('vmess://'))   proxy = parseVmess(line)
      else if (line.startsWith('ss://'))      proxy = parseSS(line)
      else if (line.startsWith('tuic://'))    proxy = parseTuic(line)
      if (proxy) proxies.push(proxy)
    } catch (e) {
      console.error('Failed to parse proxy link:', schemeOf(line), e.message)
    }
  }

  return proxies
}

/**
 * Expand a paste (converter URL / base64 subscription) into URI lines for the textarea.
 * Clash YAML is left as-is so the live subscription URL can carry it.
 */
export function expandPastedInput(raw) {
  const original = raw
  const trimmed = String(raw || '').trim()
  if (!trimmed) return { text: raw, kind: '' }

  if (/^https?:\/\//.test(trimmed) && !trimmed.includes('\n')) {
    try {
      const url = new URL(trimmed)
      const config = url.searchParams.get('config')
      if (config) {
        const decoded = (() => {
          try { return decodeURIComponent(config) } catch { return config }
        })()
        const lines = decoded.split(/\n|\|/).map(l => l.trim())
          .filter(l => PROXY_PREFIXES.some(p => l.startsWith(p)))
        if (lines.length > 0) return { text: lines.join('\n'), kind: 'url' }
      }
    } catch { /* not a converter URL */ }
  }

  if (looksLikeClashYaml(trimmed) && parseClashYamlProxies(trimmed).length > 0) {
    return { text: original, kind: 'yaml' }
  }

  const decoded = tryDecodeSubscription(trimmed)
  if (decoded) {
    if (looksLikeClashYaml(decoded) && parseClashYamlProxies(decoded).length > 0) {
      return { text: decoded, kind: 'base64' }
    }
    const lines = decoded.split(/\r?\n|\|/).map(l => l.trim())
      .filter(l => PROXY_PREFIXES.some(p => l.startsWith(p)))
    if (lines.length > 0) return { text: lines.join('\n'), kind: 'base64' }
  }

  return { text: original, kind: '' }
}

export function parseProxyLinks(input) {
  const text = String(input || '').trim()
  if (!text) return []

  if (/^https?:\/\//.test(text) && !text.includes('\n')) {
    try {
      const url = new URL(text)
      const config = url.searchParams.get('config')
      if (config) {
        try { return parseProxyLinks(decodeURIComponent(config)) }
        catch { return parseProxyLinks(config) }
      }
    } catch { /* fall through */ }
  }

  if (looksLikeClashYaml(text)) {
    const fromYaml = parseClashYamlProxies(text)
    if (fromYaml.length > 0) return fromYaml
  }

  const fromUris = parseUriLines(text)
  if (fromUris.length > 0) return fromUris

  const decoded = tryDecodeSubscription(text)
  if (decoded) return parseProxyLinks(decoded)

  return []
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function decodeName(hash) {
  if (!hash) return ''
  try { return decodeURIComponent(hash) } catch { return hash }
}

// Handles plain host:port and IPv6 [::1]:port.
// Throws on malformed input so parseProxyLinks skips the bad line.
function splitHostPort(hostport) {
  if (hostport.startsWith('[')) {
    const close = hostport.indexOf(']')
    if (close === -1) throw new Error(`Invalid IPv6 host: ${hostport}`)
    const server = hostport.slice(1, close)
    const rest   = hostport.slice(close + 1)
    const port   = rest.startsWith(':') ? parseInt(rest.slice(1), 10) : NaN
    if (!server || !Number.isFinite(port)) throw new Error(`Invalid host:port: ${hostport}`)
    return { server, port }
  }
  const last = hostport.lastIndexOf(':')
  if (last === -1) throw new Error(`Missing port: ${hostport}`)
  const server = hostport.slice(0, last)
  const port   = parseInt(hostport.slice(last + 1), 10)
  if (!server || !Number.isFinite(port)) throw new Error(`Invalid host:port: ${hostport}`)
  return { server, port }
}

function parseUrl(url) {
  const u = new URL(url)
  const params = Object.fromEntries(u.searchParams)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`
  return { u, params, name }
}

function parseBool(val, fallback = undefined) {
  if (val === undefined || val === null) return fallback
  if (typeof val === 'boolean') return val
  const s = String(val).toLowerCase()
  if (s === 'true' || s === '1') return true
  if (s === 'false' || s === '0') return false
  return fallback
}

function isInsecure(params) {
  return (
    params.insecure === '1' ||
    params.allowInsecure === '1' ||
    params.allow_insecure === '1' ||
    params['skip-cert-verify'] === '1' ||
    params['skip-cert-verify'] === 'true'
  )
}

// ── Hysteria2 ──────────────────────────────────────────────────────────────
function parseHysteria2(url) {
  const normalized = url.replace(/^hy2:\/\//, 'hysteria2://')
  const { u, params, name } = parseUrl(normalized)

  const password = u.username ? decodeURIComponent(u.username) : params.auth

  const proxy = {
    name,
    type: 'hysteria2',
    server: u.hostname,
    port: parseInt(u.port, 10) || 443,
    password,
    udp: true,
  }

  const sni = params.peer || params.sni
  if (sni) proxy.sni = sni
  if (isInsecure(params)) proxy['skip-cert-verify'] = true

  const up   = params.up   ?? (params.upmbps   ? `${params.upmbps} Mbps`   : undefined)
  const down = params.down ?? (params.downmbps  ? `${params.downmbps} Mbps` : undefined)
  if (up)   proxy.up   = up
  if (down) proxy.down = down

  if (params.obfs && params['obfs-password']) {
    proxy.obfs = params.obfs
    proxy['obfs-password'] = params['obfs-password']
  }

  return proxy
}

// ── AnyTLS ────────────────────────────────────────────────────────────────
function parseAnyTLS(url) {
  const { u, params, name } = parseUrl(url)

  const proxy = {
    name,
    type: 'anytls',
    server: u.hostname,
    port: parseInt(u.port, 10) || 443,
    password: decodeURIComponent(u.username),
    tls: true,
    udp: parseBool(params.udp, false),
  }

  const sni = params.peer || params.sni
  if (sni) proxy.sni = sni
  if (isInsecure(params)) proxy['skip-cert-verify'] = true
  if (params.fastopen === '1') proxy.tfo = true
  if (params.fp) proxy['client-fingerprint'] = params.fp

  return proxy
}

// ── VLESS ─────────────────────────────────────────────────────────────────
function parseVless(url) {
  const { u, params, name } = parseUrl(url)

  const proxy = {
    name,
    type: 'vless',
    server: u.hostname,
    port: parseInt(u.port, 10) || 443,
    uuid: u.username,
    udp: true,
  }

  const security = params.security || 'none'
  if (security === 'tls' || security === 'reality') proxy.tls = true

  let network = params.type || 'tcp'
  if (network === 'splithttp') network = 'xhttp'
  if (network !== 'tcp') proxy.network = network

  if (params.flow) proxy.flow = params.flow

  const sni = params.sni || params.servername || params.host
  if (sni) proxy.servername = sni

  if (params.fp) proxy['client-fingerprint'] = params.fp

  if (security === 'reality') {
    proxy['reality-opts'] = { 'public-key': params.pbk || '', 'short-id': params.sid || '' }
    proxy['packet-encoding'] = 'xudp'
  }

  if (params.flow === 'xtls-rprx-vision' && security !== 'reality') {
    proxy['packet-encoding'] = 'xudp'
  }

  if (security === 'tls' && isInsecure(params)) proxy['skip-cert-verify'] = true

  if (network === 'ws') {
    const wsHost = params.host || params.Host
    proxy['ws-opts'] = { path: params.path || '/', ...(wsHost ? { headers: { Host: wsHost } } : {}) }
  }
  if (network === 'h2') {
    const h2Host = params.host || params.h2host
    proxy['h2-opts'] = { path: params.path || '/', ...(h2Host ? { host: [h2Host] } : {}) }
  }
  if (network === 'grpc') {
    proxy['grpc-opts'] = { 'grpc-service-name': params.serviceName || params.grpcServiceName || '' }
  }
  if (network === 'xhttp') {
    const opts = { path: params.path || '/' }
    const xhost = params.host || params.Host
    if (xhost) opts.host = xhost
    if (params.mode) opts.mode = params.mode
    if (params.extra) {
      try { opts.extra = JSON.parse(params.extra) } catch { opts.extra = params.extra }
    }
    proxy['xhttp-opts'] = opts
  }

  return proxy
}

// ── Trojan ────────────────────────────────────────────────────────────────
function parseTrojan(url) {
  const { u, params, name } = parseUrl(url)

  const proxy = {
    name,
    type: 'trojan',
    server: u.hostname,
    port: parseInt(u.port, 10) || 443,
    password: decodeURIComponent(u.username),
    udp: true,
  }

  const sni = params.sni || params.peer
  if (sni) proxy.sni = sni
  if (isInsecure(params)) proxy['skip-cert-verify'] = true
  if (params.fp) proxy['client-fingerprint'] = params.fp
  if (params.flow) proxy.flow = params.flow

  const network = params.type
  if (network && network !== 'tcp') {
    proxy.network = network
    if (network === 'ws') {
      proxy['ws-opts'] = {
        path: params.path || '/',
        ...(params.host ? { headers: { Host: params.host } } : {}),
      }
    }
    if (network === 'grpc') {
      proxy['grpc-opts'] = { 'grpc-service-name': params.serviceName || params.grpcServiceName || '' }
    }
  }

  return proxy
}

// ── VMess ─────────────────────────────────────────────────────────────────
function parseVmess(url) {
  let b64 = url.slice('vmess://'.length)
  let nameOverride = ''
  const hashPos = b64.indexOf('#')
  if (hashPos >= 0) {
    nameOverride = decodeName(b64.slice(hashPos + 1))
    b64 = b64.slice(0, hashPos)
  }

  const json = JSON.parse(decodeBase64(b64))

  const proxy = {
    name:    nameOverride || json.ps || json.add || 'VMess',
    type:    'vmess',
    server:  json.add,
    port:    parseInt(json.port, 10),
    uuid:    json.id,
    alterId: parseInt(json.aid, 10) || 0,
    cipher:  json.scy || json.security || 'auto',
    udp:     true,
  }

  const network = json.net || 'tcp'
  if (network !== 'tcp') proxy.network = network

  const hasTLS = json.tls && json.tls !== '' && json.tls !== 'none'
  if (hasTLS) {
    proxy.tls = true
    const sni = json.sni || json.host
    if (sni) proxy.servername = sni
    if (json.fp) proxy['client-fingerprint'] = json.fp
    if (json['skip-cert-verify'] || json.allowInsecure || json.insecure) {
      proxy['skip-cert-verify'] = true
    }
  }

  if (network === 'ws') {
    proxy['ws-opts'] = {
      path: json.path || '/',
      ...(json.host ? { headers: { Host: json.host } } : {}),
    }
  }
  if (network === 'h2') {
    proxy['h2-opts'] = {
      path: json.path || '/',
      ...(json.host ? { host: Array.isArray(json.host) ? json.host : [json.host] } : {}),
    }
  }
  if (network === 'grpc') {
    proxy['grpc-opts'] = { 'grpc-service-name': json.path || json.serviceName || '' }
  }
  if (network === 'http' || (network === 'tcp' && json.type === 'http')) {
    proxy.network = 'http'
    proxy['http-opts'] = {
      method: json.method || 'GET',
      path:   [json.path || '/'],
      ...(json.host ? { headers: { Host: [json.host] } } : {}),
    }
  }

  return proxy
}

// ── Shadowsocks ────────────────────────────────────────────────────────────
function parseSS(url) {
  const hashIdx = url.indexOf('#')
  const name    = hashIdx >= 0 ? decodeName(url.slice(hashIdx + 1)) : ''
  const body    = hashIdx >= 0 ? url.slice(0, hashIdx) : url

  const raw = body.slice('ss://'.length)
  const qIdx = raw.indexOf('?')
  const main = qIdx >= 0 ? raw.slice(0, qIdx) : raw
  const qs   = qIdx >= 0 ? raw.slice(qIdx + 1) : ''

  const atIdx = main.lastIndexOf('@')

  let method, password, server, port

  if (atIdx < 0) {
    const decoded = decodeBase64(main)
    const lastAt  = decoded.lastIndexOf('@')
    const userinfo = decoded.slice(0, lastAt)
    const hostport = decoded.slice(lastAt + 1)
    const colonIdx = userinfo.indexOf(':')
    method   = userinfo.slice(0, colonIdx)
    password = userinfo.slice(colonIdx + 1)
    ;({ server, port } = splitHostPort(hostport))
  } else {
    const userinfo = main.slice(0, atIdx)
    const hostport = main.slice(atIdx + 1)
    ;({ server, port } = splitHostPort(hostport))

    if (userinfo.includes(':')) {
      const colonIdx = userinfo.indexOf(':')
      method   = userinfo.slice(0, colonIdx)
      password = userinfo.slice(colonIdx + 1)
    } else {
      const decoded = decodeBase64(userinfo)
      const colonIdx = decoded.indexOf(':')
      method   = decoded.slice(0, colonIdx)
      password = decoded.slice(colonIdx + 1)
    }
  }

  const proxy = {
    name: name || `${server}:${port}`,
    type: 'ss',
    server,
    port,
    cipher: method,
    password,
    udp: true,
  }

  if (qs) {
    const pluginParam = new URLSearchParams(qs).get('plugin')
    if (pluginParam) {
      const pluginInfo = parseSsPlugin(pluginParam)
      if (pluginInfo) {
        proxy.plugin = pluginInfo.name
        if (pluginInfo.opts) proxy['plugin-opts'] = pluginInfo.opts
      }
    }
  }

  return proxy
}

function parseSsPlugin(pluginStr) {
  const parts = pluginStr.split(';')
  const rawName = parts[0]
  if (!rawName) return null

  const name = rawName === 'simple-obfs' ? 'obfs' : rawName

  const opts = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=')
    if (eq === -1) {
      opts[part] = true
      continue
    }
    const k = part.slice(0, eq)
    const v = part.slice(eq + 1)
    if      (k === 'obfs')     opts.mode = v
    else if (k === 'obfs-host') opts.host = v
    else if (k === 'obfs-uri')  opts.path = v
    else opts[k] = v
  }

  return { name, opts: Object.keys(opts).length > 0 ? opts : undefined }
}

// ── TUIC ──────────────────────────────────────────────────────────────────
function parseTuic(url) {
  const { u, params, name } = parseUrl(url)

  const colonIdx = u.username.indexOf(':')
  const uuid     = colonIdx >= 0 ? u.username.slice(0, colonIdx) : u.username
  const password = colonIdx >= 0 ? u.password || u.username.slice(colonIdx + 1) : u.password

  const proxy = {
    name,
    type: 'tuic',
    server: u.hostname,
    port: parseInt(u.port, 10) || 443,
    uuid:     decodeURIComponent(uuid),
    password: decodeURIComponent(password || ''),
    udp: true,
  }

  if (params.sni)  proxy.sni  = params.sni
  if (isInsecure(params)) proxy['skip-cert-verify'] = true

  const alpn = params.alpn
  if (alpn) proxy.alpn = alpn.includes(',') ? alpn.split(',').map(s => s.trim()) : [alpn]

  if (params['congestion-control'] || params.congestion_control) {
    proxy['congestion-controller'] = params['congestion-control'] || params.congestion_control
  }
  if (params['udp-relay-mode'] || params.udp_relay_mode) {
    proxy['udp-relay-mode'] = params['udp-relay-mode'] || params.udp_relay_mode
  }
  if (parseBool(params['reduce-rtt']) === true) proxy['reduce-rtt'] = true

  return proxy
}
