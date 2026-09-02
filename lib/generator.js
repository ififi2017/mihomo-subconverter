import {
  DEFAULT_DNS_NAMESERVER,
  DEFAULT_DNS_PROXY_SERVER_NAMESERVER,
  DEFAULT_DNS_CN_POLICY,
  DEFAULT_DNS_NOT_CN,
  DEFAULT_GEO_URLS,
} from './constants'
import { rewriteGithubRawUrl } from './githubMirror'

// ── YAML helpers ──────────────────────────────────────────────────────────

function q(val) {
  if (val === null || val === undefined) return "''"
  // Control characters (incl. newlines) would break the document structure —
  // replace them so user input can never inject extra YAML lines/keys.
  const s = String(val).replace(/[\u0000-\u001f\u007f]/g, " ")
  if (s === '') return "''"
  const needsQuote =
    /[:#\[\]{}&*!,|>'"%@`]/.test(s) ||
    s.startsWith(' ') || s.endsWith(' ') ||
    /^[?~-]/.test(s) ||
    /^(true|false|null|yes|no|on|off)$/i.test(s) ||
    /^[+-]?[\d._]+$/.test(s)
  return needsQuote ? `'${s.replace(/'/g, "''")}'` : s
}

function fv(val) {
  if (typeof val === 'boolean') return val.toString()
  if (typeof val === 'number')  return val.toString()
  return q(String(val))
}

function emitList(lines, key, arr, indent) {
  const pad = ' '.repeat(indent)
  const padItem = ' '.repeat(indent + 2)
  lines.push(`${pad}${key}:`)
  for (const item of arr) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      lines.push(`${padItem}-`)
      emitMapBody(lines, item, indent + 4)
    } else {
      lines.push(`${padItem}- ${fv(item)}`)
    }
  }
}

function emitMapBody(lines, obj, indent) {
  const pad = ' '.repeat(indent)
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) {
      emitList(lines, k, v, indent)
    } else if (typeof v === 'object') {
      lines.push(`${pad}${k}:`)
      emitMapBody(lines, v, indent + 2)
    } else {
      lines.push(`${pad}${k}: ${fv(v)}`)
    }
  }
}

function emitMap(lines, key, obj, indent = 4) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return
  if (Object.keys(obj).length === 0) return
  const pad = ' '.repeat(indent)
  lines.push(`${pad}${key}:`)
  emitMapBody(lines, obj, indent + 2)
}

// ── Proxy → YAML ──────────────────────────────────────────────────────────

function proxyToYaml(proxy) {
  const lines = [`  - name: ${q(proxy.name)}`]
  const order = [
    'type', 'server', 'port', 'password', 'uuid',
    'cipher', 'flow', 'tls', 'sni', 'servername',
    'skip-cert-verify', 'udp', 'tfo', 'client-fingerprint',
    'network', 'packet-encoding', 'up', 'down',
    'obfs', 'obfs-password', 'plugin',
    'congestion-controller', 'udp-relay-mode', 'reduce-rtt',
  ]
  for (const key of order) {
    if (proxy[key] !== undefined) lines.push(`    ${key}: ${fv(proxy[key])}`)
  }
  if (Array.isArray(proxy.alpn) && proxy.alpn.length > 0) {
    emitList(lines, 'alpn', proxy.alpn, 4)
  } else if (typeof proxy.alpn === 'string' && proxy.alpn) {
    lines.push(`    alpn: ${q(proxy.alpn)}`)
  }
  emitMap(lines, 'plugin-opts', proxy['plugin-opts'])
  emitMap(lines, 'reality-opts', proxy['reality-opts'])
  emitMap(lines, 'ws-opts', proxy['ws-opts'])
  emitMap(lines, 'h2-opts', proxy['h2-opts'])
  emitMap(lines, 'grpc-opts', proxy['grpc-opts'])
  emitMap(lines, 'http-opts', proxy['http-opts'])
  emitMap(lines, 'xhttp-opts', proxy['xhttp-opts'])
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
  if (g.url)       lines.push(`    url: ${q(g.url)}`)
  if (g.interval)  lines.push(`    interval: ${g.interval}`)
  if (g.tolerance) lines.push(`    tolerance: ${g.tolerance}`)
  if (g.strategy)  lines.push(`    strategy: ${q(g.strategy)}`)
  return lines.join('\n')
}

// ── Rule-provider name from URL ───────────────────────────────────────────

function ruleNameFromUrl(url) {
  try {
    const path  = new URL(url).pathname
    const parts = path.split('/').filter(Boolean)
    const file  = parts[parts.length - 1] || 'rule'
    const base  = file.replace(/\.[^.]+$/, '')
    // Include parent dir for meta-rules-dat–style paths so geosite/google.mrs
    // and geoip/google.mrs don't collide on the bare name "google".
    const parent = parts[parts.length - 2] || ''
    const name = (parent === 'geosite' || parent === 'geoip')
      ? `${parent}-${base}`
      : base
    return name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'rule'
  } catch {
    return 'rule'
  }
}

export function uniquifyProxyNames(proxies) {
  const used = new Set()
  return proxies.map(p => {
    const base = p.name || 'proxy'
    if (!used.has(base)) {
      used.add(base)
      return p
    }
    let i = 2
    while (used.has(`${base} ${i}`)) i++
    const next = `${base} ${i}`
    used.add(next)
    return { ...p, name: next }
  })
}

// ── Build proxy groups from parsed INI ────────────────────────────────────

function buildProxyGroupsFromIni(iniGroups, proxyNames) {
  const allProxies = proxyNames.length > 0 ? proxyNames : ['DIRECT']

  return iniGroups.map(g => {
    if (g.type === 'select') {
      // Each item in g.proxies is either:
      //   string           → group/policy reference (was []Name in INI), keep as-is
      //   { filter: regex } → regex pattern to expand against actual proxy node names
      const expanded = []
      for (const item of g.proxies) {
        if (typeof item === 'string') {
          expanded.push(item)
        } else {
          // Regex filter → expand to matching proxy node names
          const pattern = item.filter
          let matched = []
          if (!pattern || pattern === '.*') {
            matched = allProxies
          } else {
            try {
              const re = new RegExp(pattern)
              matched = allProxies.filter(n => re.test(n))
            } catch {
              matched = allProxies
            }
          }
          if (matched.length > 0) expanded.push(...matched)
        }
      }
      // Deduplicate while preserving order
      const seen = new Set()
      const deduped = expanded.filter(p => seen.has(p) ? false : (seen.add(p), true))
      return { name: g.name, type: 'select', proxies: deduped.length > 0 ? deduped : allProxies }
    }

    // url-test / fallback / load-balance: filter proxies by regex
    let filtered = allProxies
    if (g.filter && g.filter !== '.*') {
      try {
        const re = new RegExp(g.filter)
        filtered = proxyNames.filter(n => re.test(n))
      } catch {
        // invalid regex → use all
      }
    }
    if (filtered.length === 0) filtered = allProxies

    return {
      name:      g.name,
      type:      g.type,
      proxies:   filtered,
      url:       g.url,
      interval:  g.interval,
      tolerance: g.tolerance,
    }
  })
}

// ── Build rule-providers + rules from parsed INI rulesets ─────────────────

/**
 * @param {any[]}    rulesets       Parsed rulesets from iniParser
 * @param {string[]} customRules    User-supplied high-priority rules
 * @param {Set<string>|null} selectedGroups  Which URL-ruleset groups to include.
 *   null = include everything. Inline rules (GEOIP, FINAL…) are always included.
 */
function buildRulesFromIni(rulesets, customRules, selectedGroups = null) {
  const ruleProviders = {}
  const rules         = []
  const urlToName     = new Map()  // deduplicate providers by rewritten URL

  // Custom rules have the highest priority
  for (const r of customRules) {
    if (r?.trim()) rules.push(r.trim())
  }

  for (const rs of rulesets) {
    if (rs.inline) {
      // Inline rules (GEOIP, FINAL, etc.) are always included — they are
      // infrastructure rules, not optional service groups.
      const inlineRule = rs.inline

      if (inlineRule === 'FINAL') {
        rules.push(`MATCH,${rs.group}`)
      } else if (/^GEOIP,/i.test(inlineRule)) {
        // Append no-resolve (Clash standard for GEOIP rules)
        const base = inlineRule.replace(/,no-resolve$/i, '')
        rules.push(`${base},${rs.group},no-resolve`)
      } else {
        rules.push(`${inlineRule},${rs.group}`)
      }
    } else if (rs.url) {
      // Skip this ruleset if the user deselected its group
      if (selectedGroups !== null && !selectedGroups.has(rs.group)) continue

      const providerUrl = rewriteGithubRawUrl(rs.url)

      let name = urlToName.get(providerUrl)
      if (!name) {
        // Generate a unique name for this provider
        let base = ruleNameFromUrl(providerUrl)
        name = base
        let i = 2
        while (ruleProviders[name]) name = `${base}_${i++}`

        urlToName.set(providerUrl, name)
        // Detect .mrs format and infer behavior from URL path
        const isMrs    = providerUrl.endsWith('.mrs')
        const behavior = isMrs
          ? (providerUrl.includes('/geoip/') ? 'ipcidr' : 'domain')
          : 'classical'
        const format   = isMrs ? 'mrs' : 'text'
        ruleProviders[name] = {
          behavior,
          format,
          url:      providerUrl,
          interval: 86400,
        }
      }
      const noResolve = ruleProviders[name].behavior === 'ipcidr' ? ',no-resolve' : ''
      rules.push(`RULE-SET,${name},${rs.group}${noResolve}`)
    }
  }

  return { ruleProviders, rules }
}

// ── Top-level YAML assembly ───────────────────────────────────────────────

function yamlList(values) {
  return values.map(v => `    - ${v}`).join('\n')
}

function buildYaml(proxies, proxyGroups, ruleProviders, rules, templateUrl) {
  const parts = []
  const now = new Date().toISOString().replace('T', ' ').replace(/\..+/, '') + ' UTC'

  parts.push(`# Mihomo / Clash Meta Configuration
# Generated by mihomo-subconverter
# Generated at: ${now}
# Template: ${templateUrl || 'built-in'}
# To customize DNS servers, edit the "dns" section below.
# Default resolvers: Alibaba DNS (China) + Cloudflare DNS (global).

port: 7890
socks-port: 7891
allow-lan: false
mode: rule
log-level: info
geodata-mode: true
geo-auto-update: true
geodata-loader: standard
geo-update-interval: 24
geox-url:
  geoip: ${DEFAULT_GEO_URLS.geoip}
  geosite: ${DEFAULT_GEO_URLS.geosite}
  mmdb: ${DEFAULT_GEO_URLS.mmdb}
  asn: ${DEFAULT_GEO_URLS.asn}`)

  parts.push(`
dns:
  enable: true
  ipv6: true
  respect-rules: true
  enhanced-mode: redir-host
  nameserver:
${yamlList(DEFAULT_DNS_NAMESERVER)}
  proxy-server-nameserver:
${yamlList(DEFAULT_DNS_PROXY_SERVER_NAMESERVER)}
  nameserver-policy:
    "geosite:cn,private": ${DEFAULT_DNS_CN_POLICY}
    "geosite:geolocation-!cn": ${DEFAULT_DNS_NOT_CN}`)

  parts.push(`
sniffer:
  enable: true
  force-dns-mapping: true
  parse-pure-ip: true
  override-destination: true
  sniff:
    HTTP:
      ports: [80, 8080-8880]
      override-destination: true
    TLS:
      ports: [443, 8443]
    QUIC:
      ports: [443, 8443]`)

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
    parts.push(`    url: ${q(rp.url)}`)
    parts.push(`    path: ./ruleset/${name}.list`)
    parts.push(`    interval: ${rp.interval}`)
  }

  parts.push('\nrules:')
  for (const r of rules) parts.push(`  - ${q(r)}`)

  return parts.join('\n') + '\n'
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * @param {object[]}         proxies        Parsed proxy objects
 * @param {object}           parsedIni      Output of lib/iniParser.js
 * @param {string[]}         customRules    Extra high-priority rules
 * @param {string}           templateUrl    Used in the YAML comment header
 * @param {Set<string>|null} selectedGroups URL-ruleset groups to include (null = all)
 */
export function generateClashConfigFromIni(
  proxies,
  parsedIni,
  customRules    = [],
  templateUrl    = '',
  selectedGroups = null,
) {
  const unique     = uniquifyProxyNames(proxies)
  const proxyNames = unique.map(p => p.name)
  const builtGroups = buildProxyGroupsFromIni(parsedIni.proxyGroups, proxyNames)
  const { ruleProviders, rules } = buildRulesFromIni(parsedIni.rulesets, customRules, selectedGroups)
  return buildYaml(unique, builtGroups, ruleProviders, rules, templateUrl)
}
