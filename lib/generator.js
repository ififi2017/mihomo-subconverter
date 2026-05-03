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
  if (typeof val === 'number')  return val.toString()
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
  if (g.strategy)  lines.push(`    strategy: ${g.strategy}`)
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
  const urlToName     = new Map()  // deduplicate providers by URL

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

      let name = urlToName.get(rs.url)
      if (!name) {
        // Generate a unique name for this provider
        let base = ruleNameFromUrl(rs.url)
        name = base
        let i = 2
        while (ruleProviders[name]) name = `${base}_${i++}`

        urlToName.set(rs.url, name)
        // Detect .mrs format and infer behavior from URL path
        const isMrs    = rs.url.endsWith('.mrs')
        const behavior = isMrs
          ? (rs.url.includes('/geoip/') ? 'ipcidr' : 'domain')
          : 'classical'
        const format   = isMrs ? 'mrs' : 'text'
        ruleProviders[name] = {
          behavior,
          format,
          url:      rs.url,
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

function buildYaml(proxies, proxyGroups, ruleProviders, rules, templateUrl) {
  const parts = []

  parts.push(`# Mihomo / Clash Meta Configuration
# Generated by mihomo-subconverter
# Template: ${templateUrl || 'built-in'}

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
  geoip: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat
  geosite: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat
  mmdb: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb
  asn: https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb`)

  parts.push(`
dns:
  enable: true
  ipv6: true
  respect-rules: true
  enhanced-mode: redir-host
  nameserver:
    - https://120.53.53.53/dns-query
    - https://223.5.5.5/dns-query
  proxy-server-nameserver:
    - https://120.53.53.53/dns-query
    - https://223.5.5.5/dns-query
  nameserver-policy:
    geosite:cn,private:
      - https://120.53.53.53/dns-query
      - https://223.5.5.5/dns-query
    geosite:geolocation-!cn:
      - https://dns.cloudflare.com/dns-query
      - https://dns.google/dns-query`)

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

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Generate a Mihomo / Clash YAML config from parsed INI data.
 *
 * @param {object[]} proxies         Parsed proxy objects from lib/parser.js
 * @param {{ rulesets: any[], proxyGroups: any[] }} parsedIni  Output of lib/iniParser.js
 * @param {string[]} customRules     Extra rules with highest priority
 * @param {string}   templateUrl     URL of the INI template (for the comment header)
 */
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
  const proxyNames  = proxies.map(p => p.name)
  const builtGroups = buildProxyGroupsFromIni(parsedIni.proxyGroups, proxyNames)
  const { ruleProviders, rules } = buildRulesFromIni(parsedIni.rulesets, customRules, selectedGroups)
  return buildYaml(proxies, builtGroups, ruleProviders, rules, templateUrl)
}
