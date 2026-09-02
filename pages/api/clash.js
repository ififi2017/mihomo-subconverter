import { parseProxyLinks } from '../../lib/parser'
import { generateClashConfigFromIni } from '../../lib/generator'
import { parseIni } from '../../lib/iniParser'
import { validateTemplateUrl } from '../../lib/safeFetch'
import { checkAccessToken } from '../../lib/auth'
import { cacheKey, cacheGet, cacheSet } from '../../lib/cache'
import { DEFAULT_TEMPLATE_URL } from '../../lib/constants'
import { loadTemplateIni } from '../../lib/templateResolve'
import { isDefaultTemplateUrl } from '../../lib/githubMirror'

function parseJsonArray(value) {
  if (!value) return null
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).send('Method Not Allowed')
  }

  if (!checkAccessToken(req)) {
    return res.status(401).send('Unauthorized: missing or invalid `token` parameter')
  }

  // Note: req.query values are already URL-decoded by Next.js.
  // Decoding again would corrupt values containing literal '%' characters.
  // POST accepts a JSON body with the same field names.
  const { config, template, customRules, groups } = req.method === 'POST'
    ? (typeof req.body === 'object' && req.body ? req.body : {})
    : req.query

  if (!config) {
    return res.status(400).send('Missing required parameter: config')
  }

  try {
    const proxies = parseProxyLinks(typeof config === 'string' ? config : String(config))

    if (proxies.length === 0) {
      return res
        .status(400)
        .send('No valid proxy links found. Supported: hysteria2://, anytls://, vless://, trojan://, vmess://, ss://, tuic://, Clash YAML proxies, or a base64 subscription')
    }

    let templateUrl = DEFAULT_TEMPLATE_URL
    let isDefault = true
    if (template) {
      const validated = validateTemplateUrl(template)
      if (!validated) {
        return res
          .status(400)
          .send('Invalid template URL: only public http(s) URLs are allowed' +
                (process.env.TEMPLATE_ALLOWED_HOSTS ? ' (host not in allowlist)' : ''))
      }
      templateUrl = validated
      isDefault = isDefaultTemplateUrl(validated)
    }

    let selectedGroups = null
    const parsedGroups = parseJsonArray(groups)
    if (parsedGroups) selectedGroups = new Set(parsedGroups.map(String))

    const ckey = cacheKey(config, template, customRules, groups)
    const cached = cacheGet(ckey)
    if (cached?.yaml) {
      res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename=clash.yaml')
      res.setHeader('X-Cache', 'HIT')
      return res.status(200).send(cached.yaml)
    }

    let loaded
    try {
      loaded = await loadTemplateIni(templateUrl, { isDefault })
    } catch (e) {
      return res
        .status(502)
        .send(
          `Failed to fetch rule template: ${e.message}\n` +
          `Please check the URL or try again later.`,
        )
    }

    const parsedIni = parseIni(loaded.ini)

    if (parsedIni.proxyGroups.length === 0 && parsedIni.rulesets.length === 0) {
      return res
        .status(422)
        .send('Rule template appears to be empty or in an unsupported format.')
    }

    let customRulesList = []
    if (customRules) {
      const parsed = parseJsonArray(customRules)
      const arr = parsed || String(customRules).split('\n')
      customRulesList = arr
        .map(r => String(r).replace(/[\r\n]+/g, ' ').trim())
        .filter(Boolean)
    }

    const yaml = generateClashConfigFromIni(
      proxies, parsedIni, customRulesList, loaded.source, selectedGroups,
    )

    cacheSet(ckey, { yaml })

    res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=clash.yaml')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(yaml)
  } catch (err) {
    console.error('Generation error:', err)
    return res.status(500).send('Error generating config: ' + err.message)
  }
}
