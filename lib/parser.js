// Protocol parser — references sublink-worker (https://github.com/7Sageer/sublink-worker)
// for edge-case handling patterns. Thanks to 7Sageer for the well-structured implementation.

export function parseProxyLinks(input) {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
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
      console.error('Failed to parse proxy link:', line, e.message)
    }
  }

  return proxies
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function decodeName(hash) {
  if (!hash) return ''
  try { return decodeURIComponent(hash) } catch { return hash }
}

// Handles plain host:port and IPv6 [::1]:port
function splitHostPort(hostport) {
  if (hostport.startsWith('[')) {
    const close = hostport.indexOf(']')
    return { server: hostport.slice(1, close), port: parseInt(hostport.slice(close + 2)) }
  }
  const last = hostport.lastIndexOf(':')
  return { server: hostport.slice(0, last), port: parseInt(hostport.slice(last + 1)) }
}

// Works for custom schemes that new URL() handles fine, but gives a clean params map
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

  // password can be in userinfo OR in ?auth= (when no @ in URL)
  const password = u.username ? decodeURIComponent(u.username) : params.auth

  const proxy = {
    name,
    type: 'hysteria2',
    server: u.hostname,
    port: parseInt(u.port) || 443,
    password,
    udp: true,
  }

  const sni = params.peer || params.sni
  if (sni) proxy.sni = sni
  if (isInsecure(params)) proxy['skip-cert-verify'] = true

  // bandwidth: support both up/down and legacy upmbps/downmbps
  const up   = params.up   ?? (params.upmbps   ? `${params.upmbps} Mbps`   : undefined)
  const down = params.down ?? (params.downmbps  ? `${params.downmbps} Mbps` : undefined)
  if (up)   proxy.up   = up
  if (down) proxy.down = down

  // obfs (salamander)
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
    port: parseInt(u.port) || 443,
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
    port: parseInt(u.port) || 443,
    uuid: u.username,
    udp: true,
  }

  // security: always from params.security — do NOT fall back to params.type (that is network)
  const security = params.security || 'none'
  if (security === 'tls' || security === 'reality') proxy.tls = true

  // network / transport
  const network = params.type || 'tcp'
  if (network !== 'tcp') proxy.network = network

  if (params.flow) proxy.flow = params.flow

  // SNI / servername
  const sni = params.sni || params.servername || params.host
  if (sni) proxy.servername = sni

  if (params.fp) proxy['client-fingerprint'] = params.fp

  // Reality
  if (security === 'reality') {
    proxy['reality-opts'] = { 'public-key': params.pbk || '', 'short-id': params.sid || '' }
    proxy['packet-encoding'] = 'xudp'
  }

  if (params.flow === 'xtls-rprx-vision' && security !== 'reality') {
    proxy['packet-encoding'] = 'xudp'
  }

  if (security === 'tls' && isInsecure(params)) proxy['skip-cert-verify'] = true

  // Transport-specific
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

  return proxy
}

// ── Trojan ────────────────────────────────────────────────────────────────
function parseTrojan(url) {
  const { u, params, name } = parseUrl(url)

  const proxy = {
    name,
    type: 'trojan',
    server: u.hostname,
    port: parseInt(u.port) || 443,
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
  // Name may appear after '#' appended to the base64 (non-standard but seen in the wild)
  let b64 = url.slice('vmess://'.length)
  let nameOverride = ''
  const hashPos = b64.indexOf('#')
  if (hashPos >= 0) {
    nameOverride = decodeName(b64.slice(hashPos + 1))
    b64 = b64.slice(0, hashPos)
  }

  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))

  const proxy = {
    name:    nameOverride || json.ps || json.add || 'VMess',
    type:    'vmess',
    server:  json.add,
    port:    parseInt(json.port),
    uuid:    json.id,
    alterId: parseInt(json.aid) || 0,
    cipher:  json.scy || json.security || 'auto',
    udp:     true,
  }

  const network = json.net || 'tcp'
  if (network !== 'tcp') proxy.network = network

  // TLS: non-empty, non-"none" value means TLS is on
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
  // Strip fragment
  const hashIdx = url.indexOf('#')
  const name    = hashIdx >= 0 ? decodeName(url.slice(hashIdx + 1)) : ''
  const body    = hashIdx >= 0 ? url.slice(0, hashIdx) : url

  // Extract query string (plugin etc.)
  const raw = body.slice('ss://'.length)
  const qIdx = raw.indexOf('?')
  const main = qIdx >= 0 ? raw.slice(0, qIdx) : raw
  const qs   = qIdx >= 0 ? raw.slice(qIdx + 1) : ''

  const atIdx = main.lastIndexOf('@')

  let method, password, server, port

  if (atIdx < 0) {
    // Legacy all-in-one base64: BASE64(method:password@host:port)
    const decoded = Buffer.from(main, 'base64').toString('utf-8')
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
      // Plain method:password
      const colonIdx = userinfo.indexOf(':')
      method   = userinfo.slice(0, colonIdx)
      password = userinfo.slice(colonIdx + 1)
    } else {
      // SIP002: BASE64(method:password)
      const decoded = Buffer.from(userinfo, 'base64').toString('utf-8')
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

  // Plugin support (SIP003)
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

// Parse SIP003 plugin string: "simple-obfs;obfs=http;obfs-host=example.com"
function parseSsPlugin(pluginStr) {
  const parts = pluginStr.split(';')
  const rawName = parts[0]
  if (!rawName) return null

  // Clash uses 'obfs' for simple-obfs
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
    // Map SIP003 param names to Clash plugin-opts names
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

  // userinfo is uuid:password
  const colonIdx = u.username.indexOf(':')
  const uuid     = colonIdx >= 0 ? u.username.slice(0, colonIdx) : u.username
  const password = colonIdx >= 0 ? u.password || u.username.slice(colonIdx + 1) : u.password

  const proxy = {
    name,
    type: 'tuic',
    server: u.hostname,
    port: parseInt(u.port) || 443,
    uuid:     decodeURIComponent(uuid),
    password: decodeURIComponent(password || ''),
    udp: true,
  }

  if (params.sni)  proxy.sni  = params.sni
  if (isInsecure(params)) proxy['skip-cert-verify'] = true

  // ALPN (comma-separated or single value)
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
