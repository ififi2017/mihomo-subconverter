/**
 * GET /api/preview-template?url=<optional-encoded-url>
 *
 * Fetches a MetaCubeX-style INI template and returns the list of
 * toggleable rule-group names (groups that have URL-based rulesets).
 *
 * Response: { groups: string[] }
 */
import { parseIni } from '../../lib/iniParser'
import { validateTemplateUrl } from '../../lib/safeFetch'
import { checkAccessToken } from '../../lib/auth'
import { DEFAULT_TEMPLATE_URL } from '../../lib/constants'
import { loadTemplateIni } from '../../lib/templateResolve'
import { isDefaultTemplateUrl } from '../../lib/githubMirror'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed', groups: [] })
  }

  if (!checkAccessToken(req)) {
    return res.status(401).json({ error: 'Unauthorized', authRequired: true, groups: [] })
  }

  const { url } = req.query

  let templateUrl = DEFAULT_TEMPLATE_URL
  let isDefault = true
  if (url) {
    const validated = validateTemplateUrl(url)
    if (!validated) {
      return res.status(400).json({ error: 'Invalid template URL', groups: [] })
    }
    templateUrl = validated
    isDefault = isDefaultTemplateUrl(validated)
  }

  try {
    const { ini } = await loadTemplateIni(templateUrl, { isDefault })
    const { rulesets } = parseIni(ini)

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
