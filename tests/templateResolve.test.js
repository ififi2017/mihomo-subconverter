import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetchTextCapped = vi.fn()

vi.mock('../lib/safeFetch', () => ({
  fetchTextCapped: (...args) => mockFetchTextCapped(...args),
  validateTemplateUrl: (u) => u,
}))

import { cacheClear } from '../lib/cache'
import { loadTemplateIni, readBundledDefaultIni } from '../lib/templateResolve'

describe('loadTemplateIni', () => {
  beforeEach(() => {
    cacheClear()
    mockFetchTextCapped.mockReset()
  })

  it('falls back to the bundled INI when every mirror fetch fails', async () => {
    mockFetchTextCapped.mockRejectedValue(new Error('network down'))
    const { ini, source } = await loadTemplateIni('', { isDefault: true })
    expect(source).toBe('bundled')
    expect(ini).toContain('custom_proxy_group=')
    expect(ini).toBe(readBundledDefaultIni())
  })

  it('caches a successful mirror fetch', async () => {
    mockFetchTextCapped.mockResolvedValueOnce('[custom]\nruleset=x,[]FINAL\ncustom_proxy_group=g`select`[]DIRECT\n')
    const first = await loadTemplateIni('', { isDefault: true })
    expect(first.source).toMatch(/jsdelivr|githubusercontent/)
    mockFetchTextCapped.mockClear()
    const second = await loadTemplateIni('', { isDefault: true })
    expect(second.ini).toBe(first.ini)
    expect(mockFetchTextCapped).not.toHaveBeenCalled()
  })
})
