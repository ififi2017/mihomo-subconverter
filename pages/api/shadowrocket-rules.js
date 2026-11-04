import { checkAccessToken } from '../../lib/auth'
import { cacheGet, cacheKey, cacheSet } from '../../lib/cache'
import { fetchTextCapped } from '../../lib/safeFetch'
import { convertMetaRules, metaRulesSourceUrl } from '../../lib/shadowrocket'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).send('Method Not Allowed')
  }
  if (!checkAccessToken(req)) return res.status(401).send('Unauthorized: missing or invalid token')
  const source = req.query.source
  const url = metaRulesSourceUrl(source)
  if (!url) return res.status(400).send('Invalid MetaCubeX rule source')
  const key = cacheKey('shadowrocket-rules', source)
  try {
    let rules = cacheGet(key)?.rules
    if (!rules) {
      const text = await fetchTextCapped(url, { maxBytes: 3 * 1024 * 1024 })
      rules = convertMetaRules(text, source)
      cacheSet(key, { rules }, 60 * 60 * 1000)
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.status(200).send(rules)
  } catch (e) {
    return res.status(502).send('Failed to convert rule source: ' + e.message)
  }
}
