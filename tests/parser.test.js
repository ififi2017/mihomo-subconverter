import { describe, it, expect, vi } from 'vitest'
import { parseProxyLinks, expandPastedInput } from '../lib/parser'

function one(link) {
  const proxies = parseProxyLinks(link)
  expect(proxies).toHaveLength(1)
  return proxies[0]
}

describe('parseProxyLinks — general behavior', () => {
  it('returns empty array for empty input', () => {
    expect(parseProxyLinks('')).toHaveLength(0)
    expect(parseProxyLinks('\n\n')).toHaveLength(0)
  })

  it('returns empty array when all lines are invalid', () => {
    const input = [
      '# a comment',
      'http://not-a-proxy.example.com',
      'ftp://bad-protocol.com',
      '',
    ].join('\n')
    expect(parseProxyLinks(input)).toHaveLength(0)
  })

  it('skips comments, blank lines and unknown schemes', () => {
    const input = [
      '# a comment',
      '',
      'http://not-a-proxy.example.com',
      'ss://YWVzLTEyOC1nY206cGFzcw==@1.2.3.4:8388#ok',
    ].join('\n')
    const proxies = parseProxyLinks(input)
    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('ok')
  })

  it('skips malformed lines instead of throwing', () => {
    const input = [
      'vmess://!!!not-base64-json!!!',
      'ss://missing-everything',
      'trojan://pw@host.example.com:443#good',
    ].join('\n')
    const proxies = parseProxyLinks(input)
    expect(proxies).toHaveLength(1)
    expect(proxies[0].type).toBe('trojan')
  })
})

describe('Hysteria2', () => {
  it('parses full link with obfs and bandwidth', () => {
    const p = one('hysteria2://pass123@srv.example.com:8443?sni=sni.example.com&insecure=1&obfs=salamander&obfs-password=ob&up=100%20Mbps&down=500%20Mbps#HK-01')
    expect(p).toMatchObject({
      name: 'HK-01', type: 'hysteria2', server: 'srv.example.com', port: 8443,
      password: 'pass123', sni: 'sni.example.com',
      'skip-cert-verify': true, obfs: 'salamander', 'obfs-password': 'ob',
      up: '100 Mbps', down: '500 Mbps', udp: true,
    })
  })

  it('supports the hy2:// alias and ?auth= password', () => {
    const p = one('hy2://srv.example.com:443?auth=secret&upmbps=50&downmbps=200')
    expect(p.type).toBe('hysteria2')
    expect(p.password).toBe('secret')
    expect(p.up).toBe('50 Mbps')
    expect(p.down).toBe('200 Mbps')
  })
})

describe('AnyTLS', () => {
  it('parses a real-world style link', () => {
    const p = one('anytls://84ae84a0-ba47-4f74-9359-cfec32422d08@sky.515614.xyz:51128?peer=www.usavps.com&insecure=1&fastopen=1&udp=1#US 1')
    expect(p).toMatchObject({
      name: 'US 1', type: 'anytls', server: 'sky.515614.xyz', port: 51128,
      password: '84ae84a0-ba47-4f74-9359-cfec32422d08',
      tls: true, sni: 'www.usavps.com', 'skip-cert-verify': true,
      tfo: true, udp: true,
    })
  })

  it('parses links with a trailing slash before the query', () => {
    const p = one('anytls://pw@birds.515614.xyz:48600/?peer=www.usavps.com&udp=1#HK')
    expect(p.server).toBe('birds.515614.xyz')
    expect(p.port).toBe(48600)
    expect(p.name).toBe('HK')
  })
})

describe('VLESS', () => {
  it('parses reality + vision flow', () => {
    const p = one('vless://11111111-2222-3333-4444-555555555555@1.2.3.4:443?security=reality&pbk=PUBKEY&sid=abcd&sni=apple.com&fp=chrome&flow=xtls-rprx-vision#RE')
    expect(p).toMatchObject({
      type: 'vless', uuid: '11111111-2222-3333-4444-555555555555',
      tls: true, servername: 'apple.com', flow: 'xtls-rprx-vision',
      'client-fingerprint': 'chrome', 'packet-encoding': 'xudp',
    })
    expect(p['reality-opts']).toEqual({ 'public-key': 'PUBKEY', 'short-id': 'abcd' })
  })

  it('parses ws transport with host header', () => {
    const p = one('vless://uuid@h.example.com:80?type=ws&path=%2Fws&host=cdn.example.com#WS')
    expect(p.network).toBe('ws')
    expect(p['ws-opts']).toEqual({ path: '/ws', headers: { Host: 'cdn.example.com' } })
  })
})

describe('Trojan', () => {
  it('parses basic link with sni', () => {
    const p = one('trojan://p%40ss@t.example.com:443?sni=sni.example.com&allowInsecure=1#TJ')
    expect(p).toMatchObject({
      type: 'trojan', password: 'p@ss', server: 't.example.com', port: 443,
      sni: 'sni.example.com', 'skip-cert-verify': true,
    })
  })

  it('parses grpc transport', () => {
    const p = one('trojan://pw@t.example.com:443?type=grpc&serviceName=svc#G')
    expect(p.network).toBe('grpc')
    expect(p['grpc-opts']).toEqual({ 'grpc-service-name': 'svc' })
  })
})

describe('VMess', () => {
  const vmessLink = (obj) => 'vmess://' + Buffer.from(JSON.stringify(obj)).toString('base64')

  it('parses base64 JSON body', () => {
    const p = one(vmessLink({
      ps: 'VM-01', add: 'v.example.com', port: '443', id: 'uuid-here',
      aid: '0', scy: 'auto', net: 'ws', tls: 'tls', sni: 'v.example.com', path: '/ws', host: 'cdn.example.com',
    }))
    expect(p).toMatchObject({
      name: 'VM-01', type: 'vmess', server: 'v.example.com', port: 443,
      uuid: 'uuid-here', alterId: 0, cipher: 'auto',
      network: 'ws', tls: true, servername: 'v.example.com',
    })
    expect(p['ws-opts']).toEqual({ path: '/ws', headers: { Host: 'cdn.example.com' } })
  })

  it('honors a #name fragment appended after the base64', () => {
    const p = one(vmessLink({ add: 'v.example.com', port: 80, id: 'u' }) + '#Renamed')
    expect(p.name).toBe('Renamed')
  })
})

describe('Shadowsocks', () => {
  it('parses SIP002 (base64 userinfo)', () => {
    const userinfo = Buffer.from('aes-128-gcm:pass:word').toString('base64')
    const p = one(`ss://${userinfo}@s.example.com:8388#SS-1`)
    expect(p).toMatchObject({
      type: 'ss', cipher: 'aes-128-gcm', password: 'pass:word',
      server: 's.example.com', port: 8388, name: 'SS-1',
    })
  })

  it('parses legacy all-in-one base64', () => {
    const b64 = Buffer.from('chacha20-ietf-poly1305:pw@1.2.3.4:8388').toString('base64')
    const p = one(`ss://${b64}#L`)
    expect(p).toMatchObject({ cipher: 'chacha20-ietf-poly1305', password: 'pw', server: '1.2.3.4', port: 8388 })
  })

  it('parses SIP003 simple-obfs plugin', () => {
    const p = one('ss://YWVzLTEyOC1nY206cHc=@1.2.3.4:8388?plugin=simple-obfs%3Bobfs%3Dhttp%3Bobfs-host%3Dexample.com#P')
    expect(p.plugin).toBe('obfs')
    expect(p['plugin-opts']).toEqual({ mode: 'http', host: 'example.com' })
  })

  it('parses IPv6 hosts via splitHostPort bracket notation', () => {
    const p = one('ss://YWVzLTEyOC1nY206cHc=@[2001:db8::1]:8388#v6')
    expect(p.server).toBe('2001:db8::1')
    expect(p.port).toBe(8388)
  })

  it('handles IPv6 percent-encoded scope IDs', () => {
    const p = one('ss://YWVzLTEyOC1nY206cHc=@[fe80::1%25eth0]:8388#v6-scope')
    // The URL parser keeps the percent-encoding, which Clash/Mihomo understands
    expect(p.server).toBe('fe80::1%25eth0')
    expect(p.port).toBe(8388)
  })

  it('rejects links with a missing port', () => {
    expect(parseProxyLinks('ss://YWVzLTEyOC1nY206cHc=@no-port-here')).toHaveLength(0)
  })

  it('rejects links with malformed IPv6 (missing closing bracket)', () => {
    expect(parseProxyLinks('ss://YWVzLTEyOC1nY206cHc=@[::1:8388')).toHaveLength(0)
  })

  it('rejects links with empty host in host:port', () => {
    expect(parseProxyLinks('ss://YWVzLTEyOC1nY206cHc=@:8388')).toHaveLength(0)
  })

  it('rejects links with port that is not a finite number', () => {
    expect(parseProxyLinks('ss://YWVzLTEyOC1nY206cHc=@host.example.com:notaport')).toHaveLength(0)
  })
})

describe('TUIC', () => {
  it('parses uuid:password userinfo, alpn and congestion control', () => {
    const p = one('tuic://uuid-1:pw%2F1@t.example.com:443?sni=t.example.com&alpn=h3,spdy&congestion-control=bbr&udp-relay-mode=native&reduce-rtt=1#T')
    expect(p).toMatchObject({
      type: 'tuic', uuid: 'uuid-1', password: 'pw/1',
      sni: 't.example.com', 'congestion-controller': 'bbr',
      'udp-relay-mode': 'native', 'reduce-rtt': true,
    })
    expect(p.alpn).toEqual(['h3', 'spdy'])
  })
})

describe('name decoding', () => {
  it('decodes percent-encoded names', () => {
    const p = one('trojan://pw@t.example.com:443#%E9%A6%99%E6%B8%AF-01')
    expect(p.name).toBe('香港-01')
  })

  it('falls back to host:port when no name is given', () => {
    const p = one('trojan://pw@t.example.com:443')
    expect(p.name).toBe('t.example.com:443')
  })
})

describe('VLESS xhttp', () => {
  it('parses type=xhttp into network + xhttp-opts', () => {
    const p = one('vless://uuid@x.example.com:443?type=xhttp&path=%2Fapi&host=cdn.example.com&mode=auto&security=tls&sni=cdn.example.com#X')
    expect(p.network).toBe('xhttp')
    expect(p.tls).toBe(true)
    expect(p['xhttp-opts']).toEqual({
      path: '/api', host: 'cdn.example.com', mode: 'auto',
    })
  })

  it('treats splithttp as xhttp', () => {
    const p = one('vless://uuid@x.example.com:443?type=splithttp&path=/&security=tls#S')
    expect(p.network).toBe('xhttp')
    expect(p['xhttp-opts'].path).toBe('/')
  })
})

describe('paste import', () => {
  it('decodes a base64 subscription of URI lines', () => {
    const b64 = Buffer.from('trojan://pw@t.example.com:443#B64\n').toString('base64')
    const proxies = parseProxyLinks(b64)
    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('B64')
    expect(expandPastedInput(b64).kind).toBe('base64')
  })

  it('parses Clash YAML block proxies', () => {
    const yaml = `
proxies:
  - name: YAML-SS
    type: ss
    server: 1.2.3.4
    port: 8388
    cipher: aes-128-gcm
    password: secret
proxy-groups:
  - name: select
    type: select
`
    const proxies = parseProxyLinks(yaml)
    expect(proxies).toHaveLength(1)
    expect(proxies[0]).toMatchObject({
      name: 'YAML-SS', type: 'ss', server: '1.2.3.4', port: 8388,
      cipher: 'aes-128-gcm', password: 'secret',
    })
    expect(expandPastedInput(yaml).kind).toBe('yaml')
  })

  it('parses Clash YAML flow-style proxies', () => {
    const yaml = `proxies:\n  - { name: Flow, type: trojan, server: t.example.com, port: 443, password: pw }\n`
    const proxies = parseProxyLinks(yaml)
    expect(proxies).toHaveLength(1)
    expect(proxies[0].name).toBe('Flow')
    expect(proxies[0].type).toBe('trojan')
  })

  it('does not log the raw proxy URI on parse failure', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    parseProxyLinks('vmess://!!!not-base64-json!!!')
    const logged = spy.mock.calls.map(c => c.join(' ')).join(' ')
    expect(logged).not.toContain('!!!not-base64')
    expect(logged).toContain('vmess')
    spy.mockRestore()
  })
})
