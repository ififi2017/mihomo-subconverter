import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../pages/api/shadowrocket'
import rulesHandler from '../pages/api/shadowrocket-rules'
import { cacheClear } from '../lib/cache'
import { loadTemplateIni } from '../lib/templateResolve'
import { fetchTextCapped } from '../lib/safeFetch'

vi.mock('../lib/templateResolve', () => ({ loadTemplateIni: vi.fn() }))
vi.mock('../lib/safeFetch', async importOriginal => ({
  ...await importOriginal(), fetchTextCapped: vi.fn(),
}))

const ini = 'ruleset=PROXY,https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/youtube.mrs\nruleset=DIRECT,[]GEOIP,CN\nruleset=PROXY,[]FINAL'
const request = (overrides = {}) => ({ method: 'GET', query: {}, headers: { host: 'localhost:3000' }, ...overrides })
function response() {
  const res = { status: vi.fn(), setHeader: vi.fn(), send: vi.fn() }
  res.status.mockReturnValue(res)
  return res
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ACCESS_TOKEN', '')
  vi.stubEnv('TEMPLATE_ALLOWED_HOSTS', '')
  cacheClear()
  loadTemplateIni.mockResolvedValue({ ini, source: 'bundled' })
})
afterEach(() => vi.unstubAllEnvs())

describe('Shadowrocket configuration API', () => {
  it('returns a rules-only .conf without requiring config or nodes', async () => {
    const res = response()
    await handler(request(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="shadowrocket.conf"')
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('http://localhost:3000/api/shadowrocket-rules?source=geo%2Fgeosite%2Fyoutube'))
  })

  it('uses the forwarded custom domain and carries protected access into nested URLs', async () => {
    vi.stubEnv('ACCESS_TOKEN', 'secret')
    const res = response()
    await handler(request({ method: 'POST', body: { token: 'secret', customRules: ['DOMAIN,example.com,DIRECT'] }, headers: {
      host: 'internal', 'x-forwarded-host': 'rules.example.com', 'x-forwarded-proto': 'https',
    } }), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('https://rules.example.com/api/shadowrocket-rules?source=geo%2Fgeosite%2Fyoutube&token=secret'))
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('[Rule]\nDOMAIN,example.com,DIRECT'))
  })

  it('returns the same config for equivalent GET and POST parameters', async () => {
    const params = { customRules: '["DOMAIN,example.com,DIRECT"]', groups: '[]' }
    const get = response(), post = response()
    await handler(request({ query: params }), get)
    await handler(request({ method: 'POST', body: params }), post)
    expect(get.send.mock.calls[0][0]).toBe(post.send.mock.calls[0][0])
    expect(get.send.mock.calls[0][0]).not.toContain('RULE-SET,')
  })

  it.each([{ groups: 'invalid' }, { customRules: '{}' }, { groups: [1] }, { template: 'http://127.0.0.1/template.ini' }])('rejects invalid parameters before fetching: %s', async query => {
    const res = response()
    await handler(request({ query }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(loadTemplateIni).not.toHaveBeenCalled()
  })

  it('honors template host allowlists', async () => {
    vi.stubEnv('TEMPLATE_ALLOWED_HOSTS', 'example.com')
    const res = response()
    await handler(request({ query: { template: 'https://other.example/template.ini' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('reports template fetch and unsupported format failures', async () => {
    loadTemplateIni.mockRejectedValueOnce(new Error('timeout'))
    const failure = response()
    await handler(request(), failure)
    expect(failure.status).toHaveBeenCalledWith(502)
    loadTemplateIni.mockResolvedValueOnce({ ini: 'ruleset=PROXY,https://example.com/a.mrs' })
    const unsupported = response()
    await handler(request(), unsupported)
    expect(unsupported.status).toHaveBeenCalledWith(422)
  })
})

describe('Shadowrocket nested ruleset API', () => {
  it('fetches only fixed MetaCubeX sources, converts and caches the result', async () => {
    fetchTextCapped.mockResolvedValue('+.youtube.com\nyoutu.be')
    const req = request({ query: { source: 'geo/geosite/youtube' } })
    const first = response(), second = response()
    await rulesHandler(req, first)
    await rulesHandler(req, second)
    expect(first.status).toHaveBeenCalledWith(200)
    expect(first.send).toHaveBeenCalledWith('DOMAIN-SUFFIX,youtube.com\nDOMAIN,youtu.be\n')
    expect(second.send).toHaveBeenCalledWith(first.send.mock.calls[0][0])
    expect(fetchTextCapped).toHaveBeenCalledTimes(1)
    expect(fetchTextCapped).toHaveBeenCalledWith('https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/youtube.list', { maxBytes: 3 * 1024 * 1024 })
  })

  it('rejects arbitrary URLs and path traversal', async () => {
    const res = response()
    await rulesHandler(request({ query: { source: 'https://127.0.0.1/secret' } }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(fetchTextCapped).not.toHaveBeenCalled()
  })

  it('returns an upstream error instead of an empty successful ruleset', async () => {
    fetchTextCapped.mockResolvedValue('<html>error</html>')
    const res = response()
    await rulesHandler(request({ query: { source: 'geo/geosite/cn' } }), res)
    expect(res.status).toHaveBeenCalledWith(502)
  })
})

describe.each([['config', handler], ['ruleset', rulesHandler]])('%s access control', (_, endpoint) => {
  it('rejects an invalid access token before reading cached or remote content', async () => {
    vi.stubEnv('ACCESS_TOKEN', 'secret')
    const res = response()
    await endpoint(request({ query: { token: 'wrong', source: 'geo/geosite/cn' } }), res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(loadTemplateIni).not.toHaveBeenCalled()
    expect(fetchTextCapped).not.toHaveBeenCalled()
  })

  it('rejects unsupported methods', async () => {
    const res = response()
    await endpoint(request({ method: 'DELETE' }), res)
    expect(res.status).toHaveBeenCalledWith(405)
  })
})
