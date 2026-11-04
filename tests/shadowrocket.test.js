import fs from 'fs'
import { describe, expect, it } from 'vitest'
import { parseIni } from '../lib/iniParser'
import { convertMetaRules, generateShadowrocketConfig, metaRulesSourceUrl } from '../lib/shadowrocket'
import { shadowrocketParams } from '../lib/shadowrocketUrl'

const baseUrl = 'https://rules.example.com'
const template = parseIni(fs.readFileSync(new URL('../templates/MetaCubeX_Full.ini', import.meta.url), 'utf8'))

describe('Shadowrocket rules configuration', () => {
  it('exports the full bundled template without any node input or MRS links', () => {
    const conf = generateShadowrocketConfig(template, { baseUrl })
    expect(conf).toContain('[General]\ndns-server = system')
    expect(conf).toContain('[Proxy Group]')
    expect(conf).toContain('[Rule]')
    expect(conf).not.toContain('[Proxy]')
    expect(conf).not.toContain('.mrs')
    expect(conf).toContain('clash_rules@master/rules/Japan.list,🇯🇵 日本服务')
    expect(conf).toContain('♻️ 自动选择 = url-test,policy-regex-filter=.*,url=http://www.gstatic.com/generate_204,interval=300,tolerance=50')
    expect(conf).toContain('🚀 手动切换 = select,policy-regex-filter=.*')
    expect(conf).toContain('🍎 苹果服务 = select,DIRECT,🚀 节点选择')
    expect(conf).toMatch(/FINAL,🐟 漏网之鱼\n$/)
    expect(conf.match(/^RULE-SET,/gm)).toHaveLength(template.rulesets.filter(r => r.url).length)
  })

  it('keeps custom rules first and selected remote groups in template order', () => {
    const conf = generateShadowrocketConfig(template, {
      baseUrl, selectedGroups: new Set(['🇯🇵 日本服务', '💬 AI 服务']),
      customRules: ['DOMAIN-SUFFIX,example.com,DIRECT', 'IP-CIDR6,2001:db8::/32,DIRECT'],
    })
    expect(conf).toContain('[Rule]\nDOMAIN-SUFFIX,example.com,DIRECT\nIP-CIDR,2001:db8::/32,DIRECT\nRULE-SET,')
    const rules = conf.split('[Rule]\n')[1]
    expect(rules.indexOf('OpenAI.list')).toBeLessThan(rules.indexOf('Japan.list'))
    expect(rules).not.toContain('youtube')
    expect(rules).not.toContain('apple.list')
    expect(rules).toContain('FINAL,🐟 漏网之鱼')
  })

  it('keeps inline rules when every optional remote group is deselected', () => {
    const ini = parseIni('ruleset=Direct,[]GEOIP,CN\nruleset=Rest,[]FINAL\nruleset=Other,https://example.com/test.list')
    const conf = generateShadowrocketConfig(ini, { baseUrl, selectedGroups: new Set() })
    expect(conf).toContain('GEOIP,CN,Direct,no-resolve\nFINAL,Rest')
    expect(conf).toContain('Rest = select,PROXY,DIRECT')
    expect(conf).not.toContain('RULE-SET,')
    expect(conf).not.toContain('Other =')
  })

  it('carries the access token to nested converted rulesets and keeps IP no-resolve', () => {
    const conf = generateShadowrocketConfig(template, { baseUrl, token: 'a+b%&令牌' })
    const ipRule = conf.split('\n').find(line => line.startsWith('RULE-SET,') && line.includes('geoip%2Ftelegram'))
    const nestedUrl = new URL(ipRule.split(',')[1])
    expect(nestedUrl.origin).toBe(baseUrl)
    expect(nestedUrl.searchParams.get('token')).toBe('a+b%&令牌')
    expect(nestedUrl.searchParams.get('source')).toBe('geo/geoip/telegram')
    expect(ipRule).toMatch(/,📲 电报消息,no-resolve$/)
  })

  it('rejects unknown MRS sources and unsupported rules instead of omitting them', () => {
    const ini = parseIni('ruleset=PROXY,https://example.com/unknown.mrs')
    expect(() => generateShadowrocketConfig(ini, { baseUrl })).toThrow('unsupported MRS source')
    expect(() => generateShadowrocketConfig(template, { baseUrl, customRules: ['GEOSITE,cn,DIRECT'] })).toThrow('Unsupported Shadowrocket rule')
  })

  it('prevents multiline injection and ambiguous group delimiters', () => {
    expect(() => generateShadowrocketConfig(template, { baseUrl, customRules: ['DOMAIN,example.com,DIRECT\n[MITM]'] })).toThrow('Invalid custom rule')
    const ini = parseIni('ruleset=Bad=Group,[]FINAL')
    expect(() => generateShadowrocketConfig(ini, { baseUrl })).toThrow('Unsupported Shadowrocket group name')
  })

  it('translates custom MATCH fallback and adds a default fallback when absent', () => {
    const ini = parseIni('ruleset=DIRECT,[]DOMAIN,example.com')
    expect(generateShadowrocketConfig(ini, { baseUrl })).toContain('FINAL,PROXY')
    const conf = generateShadowrocketConfig(ini, { baseUrl, customRules: ['MATCH,REJECT'] })
    expect(conf).toContain('FINAL,REJECT')
    expect(conf).not.toContain('MATCH,')
    expect(conf).not.toContain('FINAL,PROXY')
  })
})

describe('MetaCubeX classical rules conversion', () => {
  it('preserves exact domains, suffixes, and wildcard semantics', () => {
    expect(convertMetaRules('# header\nexact.example\n+.suffix.example\n*.wild.example\n', 'geo/geosite/youtube'))
      .toBe('DOMAIN,exact.example\nDOMAIN-SUFFIX,suffix.example\nDOMAIN-WILDCARD,*.wild.example\n')
  })

  it('converts IPv4 and IPv6 CIDRs to Shadowrocket rules', () => {
    expect(convertMetaRules('1.2.3.0/24\n2001:db8::/32\n', 'geo/geoip/telegram'))
      .toBe('IP-CIDR,1.2.3.0/24\nIP-CIDR,2001:db8::/32\n')
  })

  it.each(['../secret', 'geo/geosite/../../secret', 'geo/geosite/%2e%2e', 'https://localhost/a', ['geo/geosite/cn']])('rejects unsafe sources: %s', source => {
    expect(metaRulesSourceUrl(source)).toBeNull()
  })

  it('rejects unexpected upstream content', () => {
    expect(() => convertMetaRules('<html>error</html>', 'geo/geosite/cn')).toThrow('Invalid domain')
    expect(() => convertMetaRules('# no data', 'geo/geoip/cn')).toThrow('Empty')
  })
})

describe('Shadowrocket export URL', () => {
  it('encodes selected groups, rules, and access token exactly once, without proxy credentials', () => {
    const params = shadowrocketParams({
      templateUrl: ' https://example.com/template.ini?q=1%25 ',
      customRules: '# comment\nDOMAIN,example.com,DIRECT\n',
      selectedGroups: new Set(['💬 AI 服务']), accessToken: 'a+b%&',
      proxyLinks: 'trojan://secret@node.example:443',
    })
    const parsed = new URLSearchParams(params.toString())
    expect(parsed.get('template')).toBe('https://example.com/template.ini?q=1%25')
    expect(parsed.get('token')).toBe('a+b%&')
    expect(JSON.parse(parsed.get('groups'))).toEqual(['💬 AI 服务'])
    expect(JSON.parse(parsed.get('customRules'))).toEqual(['DOMAIN,example.com,DIRECT'])
    expect(parsed.has('config')).toBe(false)
    expect(params.toString()).not.toContain('secret')
  })

  it('distinguishes all groups from no groups', () => {
    const input = { templateUrl: '', customRules: '', accessToken: '' }
    expect(shadowrocketParams({ ...input, selectedGroups: null }).toString()).toBe('')
    expect(shadowrocketParams({ ...input, selectedGroups: new Set() }).get('groups')).toBe('[]')
  })
})
