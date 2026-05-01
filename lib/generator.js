import { RULE_GROUPS, CORE_BEFORE, CORE_MID, CORE_AFTER, CORE_PROXY } from './rules.js'

const HK_RE = /港|HK|Hong Kong/i
const US_RE = /美|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|US|United States/i

// ── YAML helpers ──────────────────────────────────────────────────────────
function q(val) {
  if (val === null || val === undefined) return "''"
  const s = String(val)
  if (s === '') return "''"
  const needsQuote =
    /[:#\[\]{}&*!,|>'"%@`]/.test(s) ||
    s.startsWith(' ') || s.endsWith(' ') ||
    s === 'true' || s === 'false' || s === 'null' ||
    /^\d+$/.test(s)
  return needsQuote ? `'${s.replace(/'/g, "''")}'` : s
}

function fv(val) {
  if (typeof val === 'boolean') return val.toString()
  if (typeof val === 'number') return val.toString()
  return q(String(val))
}

// ── Proxy → YAML ──────────────────────────────────────────────────────────
function proxyToYaml(proxy) {
  const lines = [`  - name: ${q(proxy.name)}`]
  const order = [
    'type', 'server', 'port', 'password', 'uuid',
    'alterId', 'cipher', 'flow', 'tls', 'sni', 'servername',
    'skip-cert-verify', 'udp', 'tfo', 'client-fingerprint',
    'network', 'packet-encoding', 'up', 'down',
  ]
  for (const key of order) {
    if (proxy[key] !== undefined) lines.push(`    ${key}: ${fv(proxy[key])}`)
  }
  if (proxy['reality-opts']) {
    lines.push('    reality-opts:')
    for (const [k, v] of Object.entries(proxy['reality-opts']))
      lines.push(`      ${k}: ${q(String(v))}`)
  }
  if (proxy['ws-opts']) {
    lines.push('    ws-opts:')
    if (proxy['ws-opts'].path) lines.push(`      path: ${q(proxy['ws-opts'].path)}`)
    if (proxy['ws-opts'].headers) {
      lines.push('      headers:')
      for (const [k, v] of Object.entries(proxy['ws-opts'].headers))
        lines.push(`        ${k}: ${q(v)}`)
    }
  }
  if (proxy['h2-opts']) {
    lines.push('    h2-opts:')
    if (proxy['h2-opts'].host) {
      lines.push('      host:')
      for (const h of proxy['h2-opts'].host) lines.push(`        - ${q(h)}`)
    }
    if (proxy['h2-opts'].path) lines.push(`      path: ${q(proxy['h2-opts'].path)}`)
  }
  if (proxy['grpc-opts']) {
    lines.push('    grpc-opts:')
    for (const [k, v] of Object.entries(proxy['grpc-opts']))
      lines.push(`      ${k}: ${q(String(v))}`)
  }
  return lines.join('\n')
}

// ── Proxy group → YAML ────────────────────────────────────────────────────
function groupToYaml(g) {
  const lines = [
    `  - name: ${q(g.name)}`,
    `    type: ${g.type}`,
    '    proxies:',
  ]
  for (const p of g.proxies) lines.push(`      - ${q(p)}`)
  if (g.url)       lines.push(`    url: ${g.url}`)
  if (g.interval)  lines.push(`    interval: ${g.interval}`)
  if (g.tolerance) lines.push(`    tolerance: ${g.tolerance}`)
  return lines.join('\n')
}

// ── 代理策略组 proxies 列表（根据 type + 节点可用性）─────────────────────
function groupProxies(type, hasHK, hasUS) {
  switch (type) {
    case 'proxy-first':
      return [
        '🚀 节点选择', '♻️ 自动选择',
        ...(hasHK ? ['🇭🇰 香港节点'] : []),
        ...(hasUS ? ['🇺🇲 美国节点'] : []),
        '🚀 手动切换', 'DIRECT',
      ]
    case 'direct-first':
      return [
        'DIRECT', '🚀 节点选择',
        ...(hasUS ? ['🇺🇲 美国节点'] : []),
        ...(hasHK ? ['🇭🇰 香港节点'] : []),
        '🚀 手动切换',
      ]
    case 'reject-first':
      return ['REJECT', 'DIRECT']
    case 'bilibili':
      return ['🎯 全球直连', ...(hasHK ? ['🇭🇰 香港节点'] : [])]
    case 'bahamut':
      return ['🚀 节点选择', '🚀 手动切换', 'DIRECT']
    case 'cn-media':
      return ['DIRECT', ...(hasHK ? ['🇭🇰 香港节点'] : []), '🚀 手动切换']
    default:
      return ['🚀 节点选择', 'DIRECT']
  }
}

// ── 主入口 ────────────────────────────────────────────────────────────────
export function generateClashConfig(proxies, selectedRuleIds, customRules = []) {
  const proxyNames = proxies.map(p => p.name)

  const hkNodes = proxyNames.filter(n => HK_RE.test(n))
  const usNodes = proxyNames.filter(n => US_RE.test(n))
  const hasHK   = hkNodes.length > 0
  const hasUS   = usNodes.length > 0

  const selectedGroups = RULE_GROUPS.filter(g => selectedRuleIds.includes(g.id))
  const allEntries = selectedGroups.flatMap(g => g.entries)

  // 收集需要的策略组（去重，保留首次出现的 type）
  const serviceGroupMap = new Map()
  for (const e of allEntries) {
    if (!serviceGroupMap.has(e.target)) serviceGroupMap.set(e.target, e.type)
  }

  // 收集所有 rule-providers
  const ruleProviders = {}
  for (const rp of [...CORE_BEFORE, ...CORE_MID, ...CORE_PROXY, ...CORE_AFTER])
    ruleProviders[rp.name] = rp
  for (const e of allEntries)
    ruleProviders[e.provider.name] = e.provider

  const proxyGroups = buildProxyGroups(proxyNames, serviceGroupMap, hasHK, hasUS, hkNodes, usNodes)
  const rules       = buildRules(allEntries, customRules)

  return buildYaml(proxies, proxyGroups, ruleProviders, rules)
}

function buildProxyGroups(proxyNames, serviceGroupMap, hasHK, hasUS, hkNodes, usNodes) {
  const all = proxyNames.length > 0 ? proxyNames : ['DIRECT']
  const groups = []

  // 主选择组
  groups.push({
    name: '🚀 节点选择',
    type: 'select',
    proxies: [
      '♻️ 自动选择',
      ...(hasHK ? ['🇭🇰 香港节点'] : []),
      ...(hasUS ? ['🇺🇲 美国节点'] : []),
      '🚀 手动切换',
      'DIRECT',
    ],
  })

  // 手动切换
  groups.push({ name: '🚀 手动切换', type: 'select', proxies: all })

  // 自动测速
  groups.push({
    name: '♻️ 自动选择',
    type: 'url-test',
    proxies: all,
    url: 'http://www.gstatic.com/generate_204',
    interval: 300,
    tolerance: 50,
  })

  // 服务专属策略组（按 serviceGroupMap 顺序）
  for (const [name, type] of serviceGroupMap) {
    groups.push({
      name,
      type: 'select',
      proxies: groupProxies(type, hasHK, hasUS),
    })
  }

  // 全球直连
  groups.push({
    name: '🎯 全球直连',
    type: 'select',
    proxies: ['DIRECT', '🚀 节点选择', '♻️ 自动选择'],
  })

  // 漏网之鱼
  groups.push({
    name: '🐟 漏网之鱼',
    type: 'select',
    proxies: [
      '🚀 节点选择', '♻️ 自动选择', 'DIRECT',
      ...(hasHK ? ['🇭🇰 香港节点'] : []),
      ...(hasUS ? ['🇺🇲 美国节点'] : []),
      '🚀 手动切换',
    ],
  })

  // 地区节点（仅在有对应节点时生成）
  if (hasHK) {
    groups.push({
      name: '🇭🇰 香港节点',
      type: 'url-test',
      proxies: hkNodes,
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
    })
  }
  if (hasUS) {
    groups.push({
      name: '🇺🇲 美国节点',
      type: 'url-test',
      proxies: usNodes,
      url: 'http://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 150,
    })
  }

  return groups
}

function buildRules(allEntries, customRules) {
  const rules = []

  // 自定义规则最优先
  for (const r of customRules)
    if (r?.trim()) rules.push(r.trim())

  // 段1: LAN / UnBan / Fix_Steam_CN_CDN
  for (const rp of CORE_BEFORE)
    rules.push(`RULE-SET,${rp.name},🎯 全球直连`)

  // 广告拦截 & 谷歌FCM（在 CORE_MID 之前，与 INI 顺序一致）
  for (const e of allEntries.filter(e => ['🛑 广告拦截','🍃 应用净化','📢 谷歌FCM'].includes(e.target)))
    rules.push(`RULE-SET,${e.provider.name},${e.target}`)

  // 段2: GoogleCN / SteamCN
  for (const rp of CORE_MID)
    rules.push(`RULE-SET,${rp.name},🎯 全球直连`)

  // 其余服务规则（排除已在上面处理的）
  const earlyTargets = new Set(['🛑 广告拦截','🍃 应用净化','📢 谷歌FCM'])
  for (const e of allEntries.filter(e => !earlyTargets.has(e.target)))
    rules.push(`RULE-SET,${e.provider.name},${e.target}`)

  // ProxyGFWlist → 节点选择
  for (const rp of CORE_PROXY)
    rules.push(`RULE-SET,${rp.name},🚀 节点选择`)

  // 段3: 中国域名/IP 规则
  for (const rp of CORE_AFTER)
    rules.push(`RULE-SET,${rp.name},🎯 全球直连`)

  rules.push('GEOIP,CN,🎯 全球直连,no-resolve')
  rules.push('MATCH,🐟 漏网之鱼')

  return rules
}

function buildYaml(proxies, proxyGroups, ruleProviders, rules) {
  const parts = []

  parts.push(`# Mihomo / Clash Meta Configuration
# Generated by mihomo-subconverter
# Rules from: https://raw.githubusercontent.com/ififi2017/clash_rules/master/config/ACL4SSR_Online_Full.ini

mixed-port: 7890
allow-lan: true
bind-address: '*'
mode: rule
log-level: info
ipv6: false
external-controller: 127.0.0.1:9090`)

  parts.push(`
dns:
  enable: true
  ipv6: false
  default-nameserver:
    - 114.114.114.114
    - 8.8.8.8
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - '*.lan'
    - '*.local'
    - localhost.ptlogin2.qq.com
    - +.stun.*.*
    - +.stun.*.*.*
  nameserver:
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - https://1.1.1.1/dns-query
    - https://dns.google/dns-query
  fallback-filter:
    geoip: true
    geoip-code: CN`)

  parts.push('\nproxies:')
  for (const p of proxies) parts.push(proxyToYaml(p))

  parts.push('\nproxy-groups:')
  for (const g of proxyGroups) parts.push(groupToYaml(g))

  parts.push('\nrule-providers:')
  for (const [name, rp] of Object.entries(ruleProviders)) {
    parts.push(`  ${name}:`)
    parts.push(`    type: http`)
    parts.push(`    behavior: ${rp.behavior}`)
    parts.push(`    format: ${rp.format}`)
    parts.push(`    url: ${rp.url}`)
    parts.push(`    path: ./ruleset/${name}.list`)
    parts.push(`    interval: ${rp.interval}`)
  }

  parts.push('\nrules:')
  for (const r of rules) parts.push(`  - ${r}`)

  return parts.join('\n') + '\n'
}
