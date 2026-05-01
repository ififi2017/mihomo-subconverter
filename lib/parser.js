export function parseProxyLinks(input) {
  const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
  const proxies = []

  for (const line of lines) {
    try {
      let proxy = null
      if (line.startsWith('hysteria2://')) {
        proxy = parseHysteria2(line)
      } else if (line.startsWith('hy2://')) {
        proxy = parseHysteria2(line.replace('hy2://', 'hysteria2://'))
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
  try {
    return decodeURIComponent(hash)
  } catch {
    return hash
  }
}

function parseHysteria2(url) {
  const u = new URL(url)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`
  const params = Object.fromEntries(u.searchParams)

  const proxy = {
    name,
    type: 'hysteria2',
    server: u.hostname,
    port: parseInt(u.port),
    password: decodeURIComponent(u.username),
    udp: true,
  }

  const sni = params.peer || params.sni || params.obfs
  if (sni) proxy.sni = sni

  if (params.insecure === '1' || params['skip-cert-verify'] === 'true') {
    proxy['skip-cert-verify'] = true
  }

  if (params.up) proxy.up = params.up
  if (params.down) proxy.down = params.down

  return proxy
}

function parseAnyTLS(url) {
  const u = new URL(url)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`
  const params = Object.fromEntries(u.searchParams)

  const proxy = {
    name,
    type: 'anytls',
    server: u.hostname,
    port: parseInt(u.port),
    password: decodeURIComponent(u.username),
    tls: true,
    udp: params.udp === '1' || params.udp === 'true',
  }

  const sni = params.peer || params.sni
  if (sni) proxy.sni = sni

  if (params.insecure === '1') proxy['skip-cert-verify'] = true
  if (params.fastopen === '1') proxy.tfo = true
  if (params.fp) proxy['client-fingerprint'] = params.fp

  return proxy
}

function parseVless(url) {
  const u = new URL(url)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`
  const params = Object.fromEntries(u.searchParams)

  const proxy = {
    name,
    type: 'vless',
    server: u.hostname,
    port: parseInt(u.port),
    uuid: u.username,
    udp: true,
  }

  const security = params.security || params.type
  if (security === 'tls' || security === 'reality') proxy.tls = true

  const flow = params.flow
  if (flow) proxy.flow = flow

  const sni = params.sni || params.servername
  if (sni) proxy.servername = sni

  const fp = params.fp
  if (fp) proxy['client-fingerprint'] = fp

  const network = params.type
  if (network && network !== 'tcp') proxy.network = network
  else proxy.network = 'tcp'

  if (security === 'reality') {
    proxy['reality-opts'] = {
      'public-key': params.pbk || '',
      'short-id': params.sid || '',
    }
  }

  if (params.host && proxy.network === 'ws') {
    proxy['ws-opts'] = {
      path: params.path || '/',
      headers: { Host: params.host },
    }
  }

  if (params.h2host && proxy.network === 'h2') {
    proxy['h2-opts'] = {
      host: [params.h2host],
      path: params.path || '/',
    }
  }

  if (params.grpcServiceName && proxy.network === 'grpc') {
    proxy['grpc-opts'] = { 'grpc-service-name': params.grpcServiceName }
  }

  if (security === 'reality' || flow === 'xtls-rprx-vision') {
    proxy['packet-encoding'] = 'xudp'
  }

  if (security === 'tls' && (params.insecure === '1' || params.allowInsecure === '1')) {
    proxy['skip-cert-verify'] = true
  }

  return proxy
}

function parseTrojan(url) {
  const u = new URL(url)
  const name = decodeName(u.hash.slice(1)) || `${u.hostname}:${u.port}`
  const params = Object.fromEntries(u.searchParams)

  const proxy = {
    name,
    type: 'trojan',
    server: u.hostname,
    port: parseInt(u.port),
    password: decodeURIComponent(u.username),
    udp: true,
  }

  if (params.sni) proxy.sni = params.sni
  if (params.insecure === '1' || params['skip-cert-verify'] === '1') {
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
  }

  return proxy
}

function parseVmess(url) {
  const base64 = url.slice('vmess://'.length)
  const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'))

  const proxy = {
    name: json.ps || json.add,
    type: 'vmess',
    server: json.add,
    port: parseInt(json.port),
    uuid: json.id,
    alterId: parseInt(json.aid) || 0,
    cipher: json.scy || 'auto',
    udp: true,
  }

  if (json.net && json.net !== 'tcp') proxy.network = json.net
  if (json.tls === 'tls') {
    proxy.tls = true
    if (json.sni) proxy.servername = json.sni
    if (json.fp) proxy['client-fingerprint'] = json.fp
  }

  if (json.net === 'ws') {
    proxy['ws-opts'] = {
      path: json.path || '/',
      ...(json.host ? { headers: { Host: json.host } } : {}),
    }
  }

  return proxy
}

function parseSS(url) {
  // ss://BASE64(method:password)@host:port#name
  // or ss://BASE64@host:port#name (SIP002)
  let raw = url
  const hashIdx = raw.indexOf('#')
  const name = hashIdx >= 0 ? decodeName(raw.slice(hashIdx + 1)) : ''
  if (hashIdx >= 0) raw = raw.slice(0, hashIdx)

  raw = raw.slice('ss://'.length)

  const atIdx = raw.lastIndexOf('@')
  if (atIdx < 0) {
    // Legacy format: entire userinfo@host:port is base64
    const decoded = Buffer.from(raw, 'base64').toString('utf-8')
    const [userinfo, hostport] = decoded.split('@')
    const [method, ...pwParts] = userinfo.split(':')
    const password = pwParts.join(':')
    const lastColon = hostport.lastIndexOf(':')
    const server = hostport.slice(0, lastColon)
    const port = parseInt(hostport.slice(lastColon + 1))
    return { name: name || `${server}:${port}`, type: 'ss', server, port, cipher: method, password, udp: true }
  }

  const userinfo = raw.slice(0, atIdx)
  const hostport = raw.slice(atIdx + 1)
  const lastColon = hostport.lastIndexOf(':')
  const server = hostport.slice(0, lastColon)
  const port = parseInt(hostport.slice(lastColon + 1))

  let method, password
  if (userinfo.includes(':')) {
    ;[method, ...rest] = userinfo.split(':')
    password = rest.join(':')
  } else {
    // SIP002: base64(method:password)
    const decoded = Buffer.from(userinfo, 'base64').toString('utf-8')
    ;[method, ...rest] = decoded.split(':')
    password = rest.join(':')
  }

  return {
    name: name || `${server}:${port}`,
    type: 'ss',
    server,
    port,
    cipher: method,
    password,
    udp: true,
  }
}
