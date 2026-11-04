import { rewriteGithubRawUrl } from './githubMirror'

const META_PREFIX = 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/'
const LOCAL_PREFIX = 'https://testingcf.jsdelivr.net/gh/ififi2017/clash_rules@master/rules/'
const SOURCE_PATTERN = /^(geo|geo-lite)\/(geosite|geoip)\/[a-zA-Z0-9_!@.+-]+$/
const RULE_TYPES = new Set([
  'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN-WILDCARD',
  'IP-CIDR', 'IP-ASN', 'GEOIP', 'RULE-SET', 'DOMAIN-SET',
  'USER-AGENT', 'URL-REGEX', 'DST-PORT', 'SRC-IP', 'AND', 'OR', 'NOT', 'FINAL',
])

function field(value) {
  const text = String(value).trim()
  if (!text || /[\u0000-\u001f\u007f,=\[\]#;]/.test(text)) {
    throw new Error('Unsupported Shadowrocket group name or filter: ' + text)
  }
  return text
}

export function metaRulesSourceUrl(source) {
  if (typeof source !== 'string' || !SOURCE_PATTERN.test(source) || source.includes('..')) {
    return null
  }
  return `${META_PREFIX}${source}.list`
}

// MetaCubeX domain lists use +. for suffix matching and bare names for exact
// matching. They cannot be used verbatim as classical Shadowrocket RULE-SETs.
export function convertMetaRules(text, source) {
  if (!metaRulesSourceUrl(source)) throw new Error('Invalid MetaCubeX rule source')
  const isIp = source.includes('/geoip/')
  const rules = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    if (isIp) {
      if (!/^[\da-fA-F:.]+\/\d{1,3}$/.test(line)) throw new Error('Invalid IP rule source')
      rules.push(`IP-CIDR,${line}`)
    } else if (line.startsWith('+.')) {
      rules.push(`DOMAIN-SUFFIX,${domain(line.slice(2))}`)
    } else if (line.includes('*') || line.includes('?')) {
      rules.push(`DOMAIN-WILDCARD,${domain(line)}`)
    } else {
      rules.push(`DOMAIN,${domain(line)}`)
    }
  }
  if (!rules.length) throw new Error('Empty MetaCubeX rule source')
  return rules.join('\n') + '\n'
}

function domain(value) {
  if (!/^[\p{L}\p{N}_.*?-]+$/u.test(value)) throw new Error('Invalid domain rule source')
  return value
}

function rulesetUrl(raw, baseUrl, token) {
  const url = new URL(rewriteGithubRawUrl(raw))
  const canonical = url.origin + url.pathname
  if (canonical.startsWith(META_PREFIX)) {
    const source = canonical.slice(META_PREFIX.length).replace(/\.(mrs|list)$/, '')
    if (!metaRulesSourceUrl(source)) throw new Error('Unsupported MetaCubeX rule source: ' + raw)
    const params = new URLSearchParams({ source })
    if (token) params.set('token', token)
    return {
      url: `${baseUrl}/api/shadowrocket-rules?${params}`,
      noResolve: source.includes('/geoip/'),
    }
  }
  if (/\.mrs$/i.test(url.pathname)) {
    // This repository publishes equivalent classical .list files alongside MRS.
    if (!canonical.startsWith(LOCAL_PREFIX)) {
      throw new Error('Shadowrocket needs a text ruleset; unsupported MRS source: ' + raw)
    }
    url.pathname = url.pathname.replace(/\.mrs$/i, '.list')
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid rule URL')
  // Commas delimit configuration fields; encode any literal URL commas.
  return { url: url.toString().replace(/,/g, '%2C'), noResolve: false }
}

function normalizeRule(raw) {
  const rule = String(raw).trim()
  if (/[\u0000-\u001f\u007f]/.test(rule)) throw new Error('Invalid custom rule')
  const normalized = rule.replace(/^MATCH,/i, 'FINAL,').replace(/^IP-CIDR6,/i, 'IP-CIDR,')
  const type = normalized.split(',')[0]
  if (!RULE_TYPES.has(type) || !normalized.includes(',')) {
    throw new Error('Unsupported Shadowrocket rule: ' + rule)
  }
  return normalized
}

function groupLine(group) {
  const parts = [group.type]
  if (group.type === 'select') {
    const refs = (group.proxies || []).filter(p => typeof p === 'string').map(field)
    parts.push(...refs)
    const filters = (group.proxies || []).filter(p => typeof p !== 'string').map(p => p.filter)
    if (filters.length) parts.push(`policy-regex-filter=${field(filters.join('|') || '.*')}`)
    if (!refs.length && !filters.length) parts.push('PROXY')
  } else {
    parts.push(`policy-regex-filter=${field(group.filter || '.*')}`)
    if (group.url) parts.push(`url=${field(group.url)}`)
    if (group.interval) parts.push(`interval=${group.interval}`)
    if (group.tolerance !== undefined) parts.push(`tolerance=${group.tolerance}`)
  }
  return `${field(group.name)} = ${parts.join(',')}`
}

export function generateShadowrocketConfig(parsedIni, {
  customRules = [], selectedGroups = null, baseUrl, token = '',
} = {}) {
  const rules = customRules.filter(r => r.trim() && !r.trim().startsWith('#')).map(normalizeRule)
  const groups = [...parsedIni.proxyGroups]
  const groupNames = new Set(groups.map(g => g.name))
  for (const rs of parsedIni.rulesets) {
    if (rs.url && selectedGroups !== null && !selectedGroups.has(rs.group)) continue
    const policy = field(rs.group)
    if (!groupNames.has(policy) && !['DIRECT', 'PROXY', 'REJECT'].includes(policy)) {
      groups.push({ name: policy, type: 'select', proxies: ['PROXY', 'DIRECT'] })
      groupNames.add(policy)
    }
    if (rs.inline) {
      const inline = rs.inline.replace(/,no-resolve$/i, '')
      rules.push(normalizeRule(`${inline},${policy}${/^GEOIP,/i.test(inline) || /,no-resolve$/i.test(rs.inline) ? ',no-resolve' : ''}`))
    } else if (rs.url) {
      const remote = rulesetUrl(rs.url, baseUrl, token)
      rules.push(`RULE-SET,${remote.url},${policy}${remote.noResolve ? ',no-resolve' : ''}`)
    }
  }
  if (!rules.some(r => r.startsWith('FINAL,'))) rules.push('FINAL,PROXY')
  return [
    '# Shadowrocket rules configuration',
    '# Generated by mihomo-subconverter; uses nodes already in Shadowrocket.',
    '', '[General]', 'dns-server = system', 'ipv6 = true',
    '', '[Proxy Group]', ...groups.map(groupLine),
    '', '[Rule]', ...rules, '',
  ].join('\n')
}
