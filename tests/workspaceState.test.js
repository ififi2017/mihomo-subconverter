import { describe, expect, it, vi } from 'vitest'
import { analyzeInput, configRevision } from '../lib/workspaceState'

const proxy = 'trojan://demo@node.example.com:443#Example'
const base = {
  config: proxy,
  template: '',
  customRules: '',
  groups: null,
  token: '',
}

describe('workspace input analysis', () => {
  it('reports actual failed parse locations, excluding comments and blank lines', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const result = analyzeInput(
        `# comment\n${proxy}\n\nvmess://invalid\nnot-a-node`,
      )
      expect(result.proxies).toHaveLength(1)
      expect(result.breakdown).toEqual([['trojan', 1]])
      expect(result.invalidLines).toEqual([4, 5])
    } finally {
      log.mockRestore()
    }
  })

  it('recognizes YAML as a document rather than treating each property as an error', () => {
    const result = analyzeInput(
      'proxies:\n  - name: Example\n    type: trojan\n    server: node.example.com\n    port: 443\n    password: demo',
    )
    expect(result.proxies).toHaveLength(1)
    expect(result.invalidLines).toEqual([])
  })
})

describe('generated configuration freshness', () => {
  it.each([
    ['config', `${proxy}\ntrojan://demo@other.example.com:443`],
    ['template', 'https://example.com/template.ini'],
    ['customRules', 'DOMAIN-SUFFIX,example.com,DIRECT'],
    ['groups', new Set(['AI'])],
    ['token', 'new-token'],
  ])('invalidates the result when %s changes', (field, value) => {
    expect(configRevision({ ...base, [field]: value })).not.toBe(
      configRevision(base),
    )
  })

  it('does not mark a reordered selection or comments in custom rules as changes', () => {
    expect(
      configRevision({
        ...base,
        groups: new Set(['AI', 'Direct']),
        customRules: '# comment\n',
      }),
    ).toBe(configRevision({ ...base, groups: new Set(['Direct', 'AI']) }))
  })

  it('distinguishes no selected groups from all default groups', () => {
    expect(configRevision({ ...base, groups: new Set() })).not.toBe(
      configRevision(base),
    )
  })

  it('keeps the request revision independent from edits during generation', () => {
    const groups = new Set(['AI'])
    const submitted = configRevision({ ...base, groups })
    groups.add('Direct')
    expect(configRevision({ ...base, groups })).not.toBe(submitted)
    groups.delete('Direct')
    expect(configRevision({ ...base, groups })).toBe(submitted)
  })
})
