/**
 * ACL4SSR / sub-web compatible INI config parser.
 *
 * Recognised directives (all under a [custom] section):
 *   ruleset=GROUP,URL
 *   ruleset=GROUP,[]INLINE_RULE   (e.g. []GEOIP,CN  or  []FINAL)
 *   custom_proxy_group=NAME`type`...
 *
 * Lines starting with `;` or `#` are treated as comments.
 */

/**
 * @typedef {{ group: string, url?: string, inline?: string }} Ruleset
 * @typedef {{
 *   name: string,
 *   type: 'select'|'url-test'|'fallback'|'load-balance',
 *   proxies?: string[],
 *   filter?: string,
 *   url?: string,
 *   interval?: number,
 *   tolerance?: number,
 * }} ProxyGroupDef
 */

/**
 * Parse an ACL4SSR-style INI file.
 * @param {string} text  Raw INI content
 * @returns {{ rulesets: Ruleset[], proxyGroups: ProxyGroupDef[] }}
 */
export function parseIni(text) {
  const rulesets    = []
  const proxyGroups = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) continue

    if (line.startsWith('ruleset=')) {
      _parseRuleset(line.slice(8), rulesets)
    } else if (line.startsWith('custom_proxy_group=')) {
      _parseProxyGroup(line.slice(19), proxyGroups)
    }
  }

  return { rulesets, proxyGroups }
}

// ── internals ─────────────────────────────────────────────────────────────

function _parseRuleset(val, out) {
  const commaIdx = val.indexOf(',')
  if (commaIdx === -1) return
  const group  = val.slice(0, commaIdx).trim()
  const source = val.slice(commaIdx + 1).trim()
  if (!group || !source) return

  if (source.startsWith('[]')) {
    out.push({ group, inline: source.slice(2) })
  } else {
    // Accept http:// and https:// URLs only
    if (/^https?:\/\//i.test(source)) {
      out.push({ group, url: source })
    }
  }
}

function _parseProxyGroup(val, out) {
  // Fields are backtick-separated
  const parts = val.split('`')
  if (parts.length < 2) return
  const name = parts[0]
  const type = parts[1]
  if (!name || !type) return

  if (type === 'select') {
    // parts[2..] = proxy/group references; strip [] prefix → group name
    const proxies = parts
      .slice(2)
      .filter(Boolean)
      .map(p => (p.startsWith('[]') ? p.slice(2) : p))
    out.push({ name, type: 'select', proxies })

  } else if (type === 'url-test' || type === 'fallback' || type === 'load-balance') {
    // parts[2]: filter regex ('' or '.*' means all)
    // parts[3]: health-check URL
    // parts[4]: "interval,,tolerance"
    const filter   = parts[2] ?? '.*'
    const url      = parts[3] || 'http://www.gstatic.com/generate_204'
    const timing   = parts[4] || '300,,50'
    const [ivStr, , tolStr] = timing.split(',')
    out.push({
      name,
      type,
      filter:    filter || '.*',
      url,
      interval:  parseInt(ivStr)  || 300,
      tolerance: parseInt(tolStr) || 50,
    })
  }
  // relay and other exotic types are intentionally ignored
}
