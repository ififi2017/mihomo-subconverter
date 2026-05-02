import { parseProxyLinks } from '../../lib/parser'
import { generateClashConfig } from '../../lib/generator'
import { RULE_GROUPS } from '../../lib/rules'

export default function handler(req, res) {
  const { config, rules, customRules } = req.query

  if (!config) {
    return res.status(400).send('Missing required parameter: config')
  }

  try {
    const decodedConfig = decodeURIComponent(config)
    const proxies = parseProxyLinks(decodedConfig)

    if (proxies.length === 0) {
      return res.status(400).send('No valid proxy links found. Supported: hysteria2://, anytls://, vless://, trojan://, vmess://, ss://')
    }

    const selectedRuleIds = rules
      ? decodeURIComponent(rules).split(',').map(s => s.trim()).filter(Boolean)
      : RULE_GROUPS.filter(g => g.default).map(g => g.id)

    let customRulesList = []
    if (customRules) {
      try {
        customRulesList = JSON.parse(decodeURIComponent(customRules))
      } catch {
        customRulesList = decodeURIComponent(customRules).split('\n').map(s => s.trim()).filter(Boolean)
      }
    }

    const yaml = generateClashConfig(proxies, selectedRuleIds, customRulesList)

    res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="clash.yaml"')
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(yaml)
  } catch (err) {
    console.error('Generation error:', err)
    return res.status(500).send('Error generating config: ' + err.message)
  }
}
