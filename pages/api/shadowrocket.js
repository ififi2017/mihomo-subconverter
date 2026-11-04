import { checkAccessToken } from '../../lib/auth'
import { DEFAULT_TEMPLATE_URL } from '../../lib/constants'
import { isDefaultTemplateUrl } from '../../lib/githubMirror'
import { parseIni } from '../../lib/iniParser'
import { validateTemplateUrl } from '../../lib/safeFetch'
import { generateShadowrocketConfig } from '../../lib/shadowrocket'
import { loadTemplateIni } from '../../lib/templateResolve'

function arrayParam(value, name) {
  if (value === undefined) return null
  let parsed = value
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value) } catch { throw new Error(`Invalid ${name}: expected a JSON array`) }
  }
  if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
    throw new Error(`Invalid ${name}: expected an array of strings`)
  }
  return parsed
}

function requestOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const protocol = req.headers['x-forwarded-proto'] || 'http'
  const origin = new URL(`${String(protocol).split(',')[0]}://${String(host).split(',')[0]}`)
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) {
    throw new Error('Invalid request origin')
  }
  return origin.origin
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).send('Method Not Allowed')
  }
  if (!checkAccessToken(req)) return res.status(401).send('Unauthorized: missing or invalid token')
  const input = req.method === 'POST' ? (req.body || {}) : req.query
  let customRules, selectedGroups, templateUrl
  try {
    customRules = arrayParam(input.customRules, 'customRules') || []
    const groups = arrayParam(input.groups, 'groups')
    selectedGroups = groups === null ? null : new Set(groups)
    templateUrl = input.template ? validateTemplateUrl(input.template) : DEFAULT_TEMPLATE_URL
    if (!templateUrl) throw new Error('Invalid template URL: only allowed public http(s) URLs are supported')
  } catch (e) {
    return res.status(400).send(e.message)
  }
  let loaded
  try {
    loaded = await loadTemplateIni(templateUrl, { isDefault: isDefaultTemplateUrl(templateUrl) })
  } catch (e) {
    return res.status(502).send('Failed to fetch rule template: ' + e.message)
  }
  try {
    const parsedIni = parseIni(loaded.ini)
    if (!parsedIni.rulesets.length) throw new Error('Rule template contains no rules')
    const conf = generateShadowrocketConfig(parsedIni, {
      customRules, selectedGroups, baseUrl: requestOrigin(req),
      token: process.env.ACCESS_TOKEN ? (req.query.token || input.token) : '',
    })
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="shadowrocket.conf"')
    return res.status(200).send(conf)
  } catch (e) {
    return res.status(422).send(e.message)
  }
}
