import { describe, it, expect } from 'vitest'
import { generateClashConfigFromIni } from '../lib/generator'

const PROXIES = [
  { name: 'HK-01', type: 'trojan', server: 'a.example.com', port: 443, password: 'pw', udp: true },
  { name: 'US 1',  type: 'anytls', server: 'b.example.com', port: 51128, password: 'pw2', tls: true, udp: true },
]

const INI = {
  proxyGroups: [
    { name: '🚀 节点选择', type: 'select', proxies: ['♻️ 自动选择', 'DIRECT', { filter: '.*' }] },
    { name: '♻️ 自动选择', type: 'url-test', filter: '.*', url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
    { name: 'HK', type: 'url-test', filter: 'HK', url: 'http://www.gstatic.com/generate_204', interval: 300, tolerance: 50 },
  ],
  rulesets: [
    { group: '🚀 节点选择', url: 'https://cdn.example.com/geosite/google.mrs' },
    { group: '🚀 节点选择', url: 'https://cdn.example.com/geoip/google.mrs' },
    { group: '📹 视频服务', url: 'https://cdn.example.com/geosite/youtube.mrs' },
    { group: '🎯 全球直连', inline: 'GEOIP,CN' },
    { group: '🐟 漏网之鱼', inline: 'FINAL' },
  ],
}

describe('generateClashConfigFromIni', () => {
  const yaml = generateClashConfigFromIni(PROXIES, INI, [], 'https://tpl.example.com/x.ini')

  it('includes all proxies and expands regex filters in groups', () => {
    expect(yaml).toContain("- name: HK-01")
    expect(yaml).toContain("- name: US 1")
    // select group expands .* to all proxy names after the []refs
    const selectBlock = yaml.slice(
      yaml.indexOf('- name: 🚀 节点选择'),
      yaml.indexOf('- name: ♻️ 自动选择'),
    )
    expect(selectBlock).toContain('- ♻️ 自动选择')
    expect(selectBlock).toContain('- DIRECT')
    expect(selectBlock).toContain('- HK-01')
    expect(selectBlock).toContain('- US 1')
  })

  it('filters url-test groups by regex', () => {
    const hkBlock = yaml.slice(yaml.indexOf('- name: HK\n'), yaml.indexOf('\nrule-providers:'))
    expect(hkBlock).toContain('- HK-01')
    expect(hkBlock).not.toContain('- US 1')
  })

  it('derives mrs rule-provider names/behaviors and avoids geosite/geoip collisions', () => {
    expect(yaml).toContain('geosite-google:')
    expect(yaml).toContain('geoip-google:')
    expect(yaml).toContain('behavior: ipcidr')
    expect(yaml).toContain('behavior: domain')
    expect(yaml).toContain("- 'RULE-SET,geoip-google,🚀 节点选择,no-resolve'")
  })

  it('maps inline rules: FINAL → MATCH, GEOIP gets no-resolve', () => {
    expect(yaml).toContain("- 'MATCH,🐟 漏网之鱼'")
    expect(yaml).toContain("- 'GEOIP,CN,🎯 全球直连,no-resolve'")
  })

  it('honors selectedGroups: deselected URL groups are dropped, inline rules kept', () => {
    const filtered = generateClashConfigFromIni(PROXIES, INI, [], '', new Set(['🚀 节点选择']))
    expect(filtered).not.toContain('youtube')
    expect(filtered).toContain('geosite-google:')
    expect(filtered).toContain("- 'MATCH,🐟 漏网之鱼'")
  })

  it('puts custom rules first', () => {
    const withCustom = generateClashConfigFromIni(PROXIES, INI, ['DOMAIN-SUFFIX,example.com,DIRECT'], '')
    const rulesIdx  = withCustom.indexOf('\nrules:')
    const customIdx = withCustom.indexOf('DOMAIN-SUFFIX,example.com,DIRECT')
    const matchIdx  = withCustom.indexOf('MATCH,')
    expect(customIdx).toBeGreaterThan(rulesIdx)
    expect(customIdx).toBeLessThan(matchIdx)
  })

  it('escapes YAML-hostile proxy names (quotes, colons, control chars)', () => {
    const nasty = [{ name: "x: 'y'\ninjected: true", type: 'trojan', server: 's.example.com', port: 443, password: 'pw' }]
    const out = generateClashConfigFromIni(nasty, INI, [], '')
    expect(out).not.toContain('\ninjected: true')
    expect(out).toContain("- name: 'x: ''y'' injected: true'")
  })

  it('quotes names that YAML would otherwise coerce (numbers, booleans, ~)', () => {
    for (const name of ['123', '1.5', 'true', 'null', '~weird', 'on']) {
      const out = generateClashConfigFromIni(
        [{ name, type: 'trojan', server: 's.example.com', port: 443, password: 'pw' }], INI, [], '')
      expect(out).toContain(`- name: '${name}'`)
    }
  })

  it('does not emit alterId for VMess proxies', () => {
    const vmessProxy = [{
      name: 'VM-01', type: 'vmess', server: 'v.example.com', port: 443,
      uuid: 'uu-id-here', alterId: 0, cipher: 'auto', udp: true,
    }]
    const yaml = generateClashConfigFromIni(vmessProxy, INI, [], '')
    expect(yaml).not.toContain('alterId')
  })

  it('emits previously dropped protocol fields', () => {
    const proxies = [
      {
        name: 'HY2', type: 'hysteria2', server: 'h.example.com', port: 443,
        password: 'pw', obfs: 'salamander', 'obfs-password': 'ob', udp: true,
      },
      {
        name: 'SS', type: 'ss', server: 's.example.com', port: 8388,
        cipher: 'aes-128-gcm', password: 'pw', plugin: 'obfs',
        'plugin-opts': { mode: 'http', host: 'example.com' }, udp: true,
      },
      {
        name: 'TUIC', type: 'tuic', server: 't.example.com', port: 443,
        uuid: 'u', password: 'p', alpn: ['h3', 'spdy'],
        'congestion-controller': 'bbr', 'udp-relay-mode': 'native',
        'reduce-rtt': true, udp: true,
      },
      {
        name: 'VM-HTTP', type: 'vmess', server: 'v.example.com', port: 80,
        uuid: 'id', cipher: 'auto', network: 'http',
        'http-opts': { method: 'GET', path: ['/'], headers: { Host: ['cdn.example.com'] } },
        udp: true,
      },
      {
        name: 'VLESS-X', type: 'vless', server: 'x.example.com', port: 443,
        uuid: 'id', tls: true, network: 'xhttp',
        'xhttp-opts': { path: '/api', host: 'cdn.example.com', mode: 'auto' },
        udp: true,
      },
    ]
    const out = generateClashConfigFromIni(proxies, INI, [], '')
    expect(out).toContain('obfs: salamander')
    expect(out).toContain('obfs-password: ob')
    expect(out).toContain('plugin: obfs')
    expect(out).toMatch(/plugin-opts:[\s\S]*mode: http/)
    expect(out).toMatch(/alpn:[\s\S]*- h3[\s\S]*- spdy/)
    expect(out).toContain('congestion-controller: bbr')
    expect(out).toContain('udp-relay-mode: native')
    expect(out).toContain('reduce-rtt: true')
    expect(out).toMatch(/http-opts:[\s\S]*method: GET/)
    expect(out).toMatch(/xhttp-opts:[\s\S]*path: \/api/)
    expect(out).toContain('network: xhttp')
  })

  it('suffixes duplicate proxy names', () => {
    const dup = [
      { name: 'HK', type: 'trojan', server: 'a.example.com', port: 443, password: 'a' },
      { name: 'HK', type: 'trojan', server: 'b.example.com', port: 443, password: 'b' },
    ]
    const out = generateClashConfigFromIni(dup, INI, [], '')
    expect(out).toContain('- name: HK\n')
    expect(out).toContain('- name: HK 2\n')
  })

  it('rewrites GitHub raw and gh-proxy ruleset URLs to testingcf.jsdelivr', () => {
    const ini = {
      proxyGroups: INI.proxyGroups,
      rulesets: [
        { group: '🚀 节点选择', url: 'https://raw.githubusercontent.com/ififi2017/clash_rules/master/rules/apple.list' },
        { group: '💬 AI 服务', url: 'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/youtube.mrs' },
        { group: '🎯 全球直连', inline: 'GEOIP,CN' },
        { group: '🐟 漏网之鱼', inline: 'FINAL' },
      ],
    }
    const out = generateClashConfigFromIni(PROXIES, ini, [], '')
    expect(out).toContain('https://testingcf.jsdelivr.net/gh/ififi2017/clash_rules@master/rules/apple.list')
    expect(out).toContain('https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/youtube.mrs')
    expect(out).not.toContain('raw.githubusercontent.com')
    expect(out).not.toContain('gh-proxy.com')
    expect(out).toContain('geosite-youtube:')
  })

  it('uses China-reachable geox-url constants, not GitHub releases', () => {
    expect(yaml).toContain('testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/GeoLite2-ASN.mmdb')
    expect(yaml).not.toContain('github.com/xishang0128')
    expect(yaml).not.toContain('releases/download')
  })
})
