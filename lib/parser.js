export function parseProxyLinks(input) {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
  const proxies = []

  for (const line of lines) {
    if (line.startsWith('#')) continue
    try {
      let proxy = null
      if (line.startsWith('hysteria2://') || line.startsWith('hy2://')) {
        proxy = parseHysteria2(line)
      } else if (line.startsWith('anytls://')) {
        proxy = parseAnyTLS(line)
      } else if (line.startsWith('vless://')) {
        proxy = parseVless(line)
      } else if (line.startsWith('trojan://')) {
        proxy = parseTrojan(line)
      } else if (line.startsWith('vmess://')) {
        proxy = parseVmess(line)
      } else if (line.startsWith('ss://')) {
        proxy = parseSS(line)
      }
      if (proxy) proxies.push(proxy)
    } catch (e) {
      console.error('Failed to parse proxy link:', line, e.message)
    }
  }

  return proxies
}

function decodeName(hash) {
  if (!hash) return ''
  try { return decodeURIComponent(hash) } catch { return hash }
}

// ── Hysteria2 ──────────────────────────────────────────────────────────────
function parseHysteria2(url) {
  // hy2:// is an alias for hysteria2://
  const normalized = url.replace(/^hy2:\/\//, 'hysteria2://')
  const u = new URL(normalized)
  const params = Object.fromEntries(u.searchParams)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`

  const proxy = {
    name,
    type: 'hysteria2',
    server: u.hostname,
    port: parseInt(u.port) || 443,
    password: decodeURIComponent(u.username),
    udp: true,
  }

  // peer / sni / obfs all map to sni in Mihomo
  const sni = params.peer || params.sni || params.obfs
  if (sni) proxy.sni = sni

  if (params.insecure === '1' || params['skip-cert-verify'] === 'true' || params.allowInsecure === '1') {
    proxy['skip-cert-verify'] = true
  }

  if (params.up)   proxy.up   = params.up
  if (params.down) proxy.down = params.down

  // pinned SHA-256 cert (Mihomo supports this)
  if (params.pinSHA256) proxy['skip-cert-verify'] = false // explicit cert pin, don't skip

  return proxy
}

// ── AnyTLS ────────────────────────────────────────────────────────────────
function parseAnyTLS(url) {
  const u = new URL(url)
  const params = Object.fromEntries(u.searchParams)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`

  const proxy = {
    name,
    type: 'anytls',
    server: u.hostname,
    port: parseInt(u.port) || 443,
    password: decodeURIComponent(u.username),
    tls: true,
    udp: params.udp === '1' || params.udp === 'true',
  }

  const sni = params.peer || params.sni
  if (sni) proxy.sni = sni

  if (params.insecure === '1' || params.allowInsecure === '1') proxy['skip-cert-verify'] = true
  if (params.fastopen === '1') proxy.tfo = true
  if (params.fp) proxy['client-fingerprint'] = params.fp

  return proxy
}

// ── VLESS ─────────────────────────────────────────────────────────────────
function parseVless(url) {
  const u = new URL(url)
  const params = Object.fromEntries(u.searchParams)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`

  const proxy = {
    name,
    type: 'vless',
    server: u.hostname,
    port: parseInt(u.port) || 443,
    uuid: u.username,
    udp: true,
  }

  // security: tls / reality / none — do NOT fall back to params.type (that's network)
  const security = params.security || 'none'
  if (security === 'tls' || security === 'reality') proxy.tls = true

  // network / transport
  const network = params.type || 'tcp'
  if (network !== 'tcp') proxy.network = network

  // flow (xtls-rprx-vision etc.)
  if (params.flow) proxy.flow = params.flow

  // SNI / servername
  const sni = params.sni || params.servername
  if (sni) proxy.servername = sni

  // client fingerprint
  if (params.fp) proxy['client-fingerprint'] = params.fp

  // Reality options
  if (security === 'reality') {
    proxy['reality-opts'] = {
      'public-key': params.pbk || '',
      'short-id':   params.sid || '',
    }
    proxy['packet-encoding'] = 'xudp'
  }

  // xudp for vision flow even without reality
  if (params.flow === 'xtls-rprx-vision' && security !== 'reality') {
    proxy['packet-encoding'] = 'xudp'
  }

  // skip-cert-verify (only for tls, not reality)
  if (security === 'tls' && (params.insecure === '1' || params.allowInsecure === '1')) {
    proxy['skip-cert-verify'] = true
  }

  // Transport-specific options
  if (network === 'ws') {
    const wsHost = params.host || params.Host
    proxy['ws-opts'] = {
      path: params.path || '/',
      ...(wsHost ? { headers: { Host: wsHost } } : {}),
    }
  }

  if (network === 'h2') {
    // host param holds the h2 host (same param name as ws, context differs)
    const h2Host = params.host || params.h2host
    proxy['h2-opts'] = {
      ...(h2Host ? { host: [h2Host] } : {}),
      path: params.path || '/',
    }
  }

  if (network === 'grpc') {
    // Different clients use serviceName or grpcServiceName
    const svcName = params.serviceName || params.grpcServiceName || ''
    proxy['grpc-opts'] = { 'grpc-service-name': svcName }
  }

  return proxy
}

// ── Trojan ────────────────────────────────────────────────────────────────
function parseTrojan(url) {
  const u = new URL(url)
  const params = Object.fromEntries(u.searchParams)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`

  const proxy = {
    name,
    type: 'trojan',
    server: u.hostname,
    port: parseInt(u.port) || 443,
    password: decodeURIComponent(u.username),
    udp: true,
  }

  if (params.sni) proxy.sni = params.sni

  // Various ways clients express "skip cert verify"
  if (
    params.insecure === '1' ||
    params.allowInsecure === '1' ||
    params['skip-cert-verify'] === '1' ||
    params['skip-cert-verify'] === 'true'
  ) {
    proxy['skip-cert-verify'] = true
  }

  if (params.fp) proxy['client-fingerprint'] = params.fp

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
      const svcName = params.serviceName || params.grpcServiceName || ''
      proxy['grpc-opts'] = { 'grpc-service-name': svcName }
    }
  }

  return proxy
}

// ── VMess ─────────────────────────────────────────────────────────────────
function parseVmess(url) {
  const base64 = url.slice('vmess://'.length)
  const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))

  const proxy = {
    name:    json.ps || json.add || 'VMess',
    type:    'vmess',
    server:  json.add,
    port:    parseInt(json.port),
    uuid:    json.id,
    alterId: parseInt(json.aid) || 0,
    // scy takes priority; some clients write security instead
    cipher:  json.scy || json.security || 'auto',
    udp:     true,
  }

  const network = json.net || json.type || 'tcp'
  if (network !== 'tcp') proxy.network = network

  // tls: 'tls' means TLS on; '' / 'none' / absent means off
  const hasTLS = json.tls === 'tls'
  if (hasTLS) {
    proxy.tls = true
    const sni = json.sni || json.host
    if (sni) proxy.servername = sni
    if (json.fp) proxy['client-fingerprint'] = json.fp
    // Various ways skip-cert-verify is expressed
    if (json.allowInsecure || json.insecure || json.verify_cert === false) {
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
      ...(json.host ? { host: [json.host] } : {}),
      path: json.path || '/',
    }
  }

  if (network === 'grpc') {
    proxy['grpc-opts'] = { 'grpc-service-name': json.path || '' }
  }

  return proxy
}

// ── Shadowsocks ────────────────────────────────────────────────────────────
function parseSS(url) {
  // Strip fragment (node name)
  const hashIdx = url.indexOf('#')
  const name = hashIdx >= 0 ? decodeName(url.slice(hashIdx + 1)) : ''
  const body  = hashIdx >= 0 ? url.slice(0, hashIdx) : url

  const raw = body.slice('ss://'.length)
  const atIdx = raw.lastIndexOf('@')

  if (atIdx < 0) {
    // Legacy all-base64 format: ss://BASE64(method:password@host:port)
    const decoded = Buffer.from(raw, 'base64').toString('utf-8')
    const lastAt  = decoded.lastIndexOf('@')
    const userinfo = decoded.slice(0, lastAt)
    const hostport = decoded.slice(lastAt + 1)
    const [method, ...pwParts] = userinfo.split(':')
    const password = pwParts.join(':')
    const { server, port } = splitHostPort(hostport)
    return { name: name || `${server}:${port}`, type: 'ss', server, port, cipher: method, password, udp: true }
  }

  // SIP002 format: ss://BASE64(method:password)@host:port[?plugin=...]
  const userinfo = raw.slice(0, atIdx)
  // hostport may include query string — strip it
  const afterAt  = raw.slice(atIdx + 1)
  const qIdx     = afterAt.indexOf('?')
  const hostport  = qIdx >= 0 ? afterAt.slice(0, qIdx) : afterAt

  const { server, port } = splitHostPort(hostport)

  let method, password
  if (userinfo.includes(':')) {
    // Plain method:password (some clients skip base64 for SIP002)
    const colonIdx = userinfo.indexOf(':')
    method   = userinfo.slice(0, colonIdx)
    password = userinfo.slice(colonIdx + 1)
  } else {
    // Base64(method:password)
    const decoded = Buffer.from(userinfo, 'base64').toString('utf-8')
    const colonIdx = decoded.indexOf(':')
    method   = decoded.slice(0, colonIdx)
    password = decoded.slice(colonIdx + 1)
  }

  return { name: name || `${server}:${port}`, type: 'ss', server, port, cipher: method, password, udp: true }
}

function splitHostPort(hostport) {
  const lastColon = hostport.lastIndexOf(':')
  return {
    server: hostport.slice(0, lastColon),
    port:   parseInt(hostport.slice(lastColon + 1)),
  }
}
