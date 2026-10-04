import { describe, it, expect } from 'vitest'
import { rewriteGithubRawUrl, isDefaultTemplateUrl } from '../lib/githubMirror'
import { DEFAULT_TEMPLATE_URL } from '../lib/constants'

describe('rewriteGithubRawUrl', () => {
  it('maps raw.githubusercontent.com to testingcf.jsdelivr', () => {
    expect(rewriteGithubRawUrl(
      'https://raw.githubusercontent.com/ififi2017/clash_rules/master/rules/apple.list',
    )).toBe('https://testingcf.jsdelivr.net/gh/ififi2017/clash_rules@master/rules/apple.list')
  })

  it('unwraps gh-proxy and maps github.com/raw/refs/heads URLs', () => {
    expect(rewriteGithubRawUrl(
      'https://gh-proxy.com/https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/youtube.mrs',
    )).toBe('https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/youtube.mrs')
  })

  it('normalizes cdn.jsdelivr.net/gh to testingcf', () => {
    expect(rewriteGithubRawUrl(
      'https://cdn.jsdelivr.net/gh/foo/bar@main/a.list',
    )).toBe('https://testingcf.jsdelivr.net/gh/foo/bar@main/a.list')
  })

  it('leaves GitHub release URLs unchanged', () => {
    const rel = 'https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb'
    expect(rewriteGithubRawUrl(rel)).toBe(rel)
  })

  it('leaves already-testingcf URLs unchanged', () => {
    const u = 'https://testingcf.jsdelivr.net/gh/foo/bar@main/a.mrs'
    expect(rewriteGithubRawUrl(u)).toBe(u)
  })
})

describe('isDefaultTemplateUrl', () => {
  it('treats empty and the default jsDelivr URL as default', () => {
    expect(isDefaultTemplateUrl('')).toBe(true)
    expect(isDefaultTemplateUrl(DEFAULT_TEMPLATE_URL)).toBe(true)
  })

  it('does not treat an unrelated host as default', () => {
    expect(isDefaultTemplateUrl('https://example.com/x.ini')).toBe(false)
  })
})
