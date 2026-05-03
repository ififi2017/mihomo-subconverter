/**
 * GET /api/preview-template?url=<optional-encoded-url>
 *
 * Fetches a MetaCubeX-style INI template and returns the list of
 * toggleable rule-group names (groups that have URL-based rulesets).
 *
 * Response: { groups: string[] }
 */
import { parseIni } from '../../lib/iniParser'

const DEFAULT_TEMPLATE_URL =
  'https://raw.githubusercontent.com/ififi2017/clash_rules/master/config/MetaCubeX_Full.ini'

export default async function handler(req, res) {
  const { url } = req.query

  let templateUrl = DEFAULT_TEMPLATE_URL
  if (url) {
    const decoded = decodeURIComponent(url).trim()
    if (/^https?:\/\//i.test(decoded)) templateUrl = decoded
  }

  try {
    const iniRes = await fetch(templateUrl, {
      headers: { 'User-Agent': 'mihomo-subconverter/1.0' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!iniRes.ok) throw new Error(`HTTP ${iniRes.status}`)
    const iniText = await iniRes.text()
    const { rulesets } = parseIni(iniText)

    // Collect unique group names that have URL-based rulesets (toggleable services).
    // Inline rules (GEOIP, FINAL, etc.) are always included and not shown as checkboxes.
    const seen   = new Set()
    const groups = []
    for (const rs of rulesets) {
      if (rs.url && !seen.has(rs.group)) {
        seen.add(rs.group)
        groups.push(rs.group)
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.status(200).json({ groups })
  } catch (e) {
    return res.status(502).json({ error: e.message, groups: [] })
  }
}
