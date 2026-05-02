import { parseProxyLinks } from '../../lib/parser'
import { generateClashConfigFromIni } from '../../lib/generator'
import { parseIni } from '../../lib/iniParser'

// Default template — ACL4SSR Full (hosted in the project's own rules repo).
// Users can override this via the `template` query parameter.
const DEFAULT_TEMPLATE_URL =
  'https://raw.githubusercontent.com/ififi2017/clash_rules/master/config/ACL4SSR_Online_Full.ini'

export default async function handler(req, res) {
  const { config, template, customRules } = req.query

  if (!config) {
    return res.status(400).send('Missing required parameter: config')
  }

  try {
    // ── Parse proxy links ────────────────────────────────────────────────
    const decodedConfig = decodeURIComponent(config)
    const proxies = parseProxyLinks(decodedConfig)

    if (proxies.length === 0) {
      return res
        .status(400)
        .send('No valid proxy links found. Supported: hysteria2://, anytls://, vless://, trojan://, vmess://, ss://, tuic://')
    }

    // ── Fetch INI template ───────────────────────────────────────────────
    let templateUrl = DEFAULT_TEMPLATE_URL
    if (template) {
      const decoded = decodeURIComponent(template).trim()
      // Only allow http / https URLs
      if (/^https?:\/\//i.test(decoded)) {
        templateUrl = decoded
      }
    }

    let iniText
    try {
      const iniRes = await fetch(templateUrl, {
        headers: { 'User-Agent': 'mihomo-subconverter/1.0' },
        // 10-second timeout (Node 18+ fetch supports signal)
        signal: AbortSignal.timeout(10_000),
      })
      if (!iniRes.ok) throw new Error(`HTTP ${iniRes.status}`)
      iniText = await iniRes.text()
    } catch (e) {
      return res
        .status(502)
        .send(
          `Failed to fetch rule template from ${templateUrl}: ${e.message}\n` +
          `Please check the URL or try again later.`
        )
    }

    // ── Parse INI ────────────────────────────────────────────────────────
    const parsedIni = parseIni(iniText)

    if (parsedIni.proxyGroups.length === 0 && parsedIni.rulesets.length === 0) {
      return res
        .status(422)
        .send('Rule template appears to be empty or in an unsupported format.')
    }

    // ── Parse custom rules ────────────────────────────────────────────────
    let customRulesList = []
    if (customRules) {
      try {
        customRulesList = JSON.parse(decodeURIComponent(customRules))
      } catch {
        customRulesList = decodeURIComponent(customRules)
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
      }
    }

    // ── Generate YAML ─────────────────────────────────────────────────────
    const yaml = generateClashConfigFromIni(proxies, parsedIni, customRulesList, templateUrl)

    res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=clash.yaml')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(yaml)
  } catch (err) {
    console.error('Generation error:', err)
    return res.status(500).send('Error generating config: ' + err.message)
  }
}
