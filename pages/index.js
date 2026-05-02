import { useState, useCallback, useEffect } from 'react'
import Head from 'next/head'
import { RULE_GROUPS } from '../lib/rules'
import { useI18n, LOCALES } from '../lib/i18n'

const DEFAULT_RULES = RULE_GROUPS.filter(g => g.default).map(g => g.id)
const LS_KEY = 'mihomo_proxy_links'

const PROTO_COLORS = {
  hy2:    'bg-violet-500/15 text-violet-400 ring-violet-500/20',
  anytls: 'bg-cyan-500/15 text-cyan-400 ring-cyan-500/20',
  vless:  'bg-blue-500/15 text-blue-400 ring-blue-500/20',
  trojan: 'bg-rose-500/15 text-rose-400 ring-rose-500/20',
  vmess:  'bg-amber-500/15 text-amber-400 ring-amber-500/20',
  ss:     'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20',
}

export default function Home() {
  const { t, locale, setLocale } = useI18n()

  const [proxyLinks, setProxyLinks] = useState('')
  const [selectedRules, setSelectedRules] = useState(new Set(DEFAULT_RULES))
  const [customRules, setCustomRules] = useState('')
  const [subUrl, setSubUrl] = useState('')
  const [yamlPreview, setYamlPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [activeTab, setActiveTab] = useState('url')
  const [extractedFrom, setExtractedFrom] = useState('')

  // 从 localStorage 恢复上次输入
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) setProxyLinks(saved)
    } catch { /* 隐私模式下 localStorage 可能不可用 */ }
  }, [])

  const PROXY_PREFIXES = ['hysteria2://', 'hy2://', 'anytls://', 'vless://', 'trojan://', 'vmess://', 'ss://']

  const handleProxyInput = useCallback((raw) => {
    const trimmed = raw.trim()
    if (/^https?:\/\//.test(trimmed) && !trimmed.includes('\n')) {
      try {
        const url = new URL(trimmed)
        const config = url.searchParams.get('config')
        if (config) {
          const decoded = decodeURIComponent(config)
          const lines = decoded.split(/\n|\|/).map(l => l.trim()).filter(l =>
            PROXY_PREFIXES.some(p => l.startsWith(p))
          )
          if (lines.length > 0) {
            const joined = lines.join('\n')
            setProxyLinks(joined)
            try { localStorage.setItem(LS_KEY, joined) } catch { }
            setExtractedFrom(trimmed)
            setError('')
            return
          }
        }
      } catch { /* 不是合法 URL，当普通文本处理 */ }
    }
    setProxyLinks(raw)
    try { localStorage.setItem(LS_KEY, raw) } catch { }
    setExtractedFrom('')
  }, [])

  const toggleRule = useCallback((id) => {
    setSelectedRules(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const buildApiUrl = useCallback((base) => {
    const links = proxyLinks.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'))
      .join('\n')
    if (!links) return null
    const params = new URLSearchParams()
    params.set('config', links)
    if (selectedRules.size > 0) params.set('rules', Array.from(selectedRules).join(','))
    const customList = customRules.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
    if (customList.length > 0) params.set('customRules', JSON.stringify(customList))
    return `${base}/api/clash?${params.toString()}`
  }, [proxyLinks, selectedRules, customRules])

  const handleGenerate = useCallback(async () => {
    const links = proxyLinks.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'))
      .join('\n')
    if (!links) { setError(t('generate.errorEmpty')); return }

    setError('')
    setLoading(true)
    try {
      const url = buildApiUrl(window.location.origin)
      if (!url) { setError(t('generate.errorEmpty')); setLoading(false); return }
      setSubUrl(url)
      const res = await fetch(url)
      if (!res.ok) throw new Error(await res.text())
      setYamlPreview(await res.text())
      setActiveTab('url')
    } catch (e) {
      setError(e.message || t('generate.errorFailed'))
    } finally {
      setLoading(false)
    }
  }, [proxyLinks, buildApiUrl, t])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleGenerate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleGenerate])

  const copyToClipboard = useCallback(async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }, [])

  const downloadYaml = useCallback(() => {
    if (!yamlPreview) return
    const blob = new Blob([yamlPreview], { type: 'application/x-yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'clash.yaml'; a.click()
    URL.revokeObjectURL(url)
  }, [yamlPreview])

  const analyzeProxies = () => {
    const PROTO_MAP = {
      'hysteria2://': 'hy2', 'hy2://': 'hy2',
      'anytls://': 'anytls', 'vless://': 'vless',
      'trojan://': 'trojan', 'vmess://': 'vmess', 'ss://': 'ss',
    }
    const counts = {}
    for (const line of proxyLinks.split('\n')) {
      const l = line.trim()
      if (!l || l.startsWith('#')) continue
      for (const [prefix, proto] of Object.entries(PROTO_MAP)) {
        if (l.startsWith(prefix)) { counts[proto] = (counts[proto] || 0) + 1; break }
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return { total, breakdown: Object.entries(counts) }
  }

  const { total, breakdown } = analyzeProxies()

  return (
    <>
      <Head>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">M</div>
              <div>
                <h1 className="text-lg font-semibold text-white">{t('header.title')}</h1>
                <p className="text-xs text-gray-400">{t('header.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Language switcher */}
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                {Object.entries(LOCALES).map(([key, { name }]) => (
                  <button
                    key={key}
                    onClick={() => setLocale(key)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                      locale === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <a
                href="https://github.com/ACL4SSR/ACL4SSR"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors hidden sm:block"
              >
                {t('header.credit')}
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

          {/* Step 1: Proxy Links */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-xs flex items-center justify-center font-bold">1</span>
                <h2 className="font-medium text-white">{t('step1.title')}</h2>
              </div>
              <div className="flex items-center gap-2">
                {extractedFrom && (
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('step1.extractedBadge')}
                  </span>
                )}
                {total > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-400">
                      {t('step1.nodeCount', { count: total })}
                    </span>
                    <span className="text-gray-700">·</span>
                    {breakdown.map(([proto, count]) => (
                      <span
                        key={proto}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${PROTO_COLORS[proto] ?? 'bg-gray-500/15 text-gray-400 ring-gray-500/20'}`}
                      >
                        {proto} <span className="opacity-70">×{count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={proxyLinks}
                onChange={e => handleProxyInput(e.target.value)}
                placeholder={t('step1.placeholder')}
                rows={8}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y"
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-gray-500">
                {t('step1.supported')}{' '}
                {['hysteria2', 'anytls', 'vless', 'trojan', 'vmess', 'ss'].map((p, i, arr) => (
                  <span key={p}>
                    <code className="text-blue-400">{p}</code>
                    {i < arr.length - 1 && <span className="text-gray-600">、</span>}
                  </span>
                ))}
              </p>
            </div>
          </section>

          {/* Step 2: Rule Groups */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-xs flex items-center justify-center font-bold">2</span>
                <h2 className="font-medium text-white">{t('step2.title')}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRules(new Set(RULE_GROUPS.map(g => g.id)))}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {t('step2.selectAll')}
                </button>
                <span className="text-gray-700">·</span>
                <button
                  onClick={() => setSelectedRules(new Set())}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {t('step2.clear')}
                </button>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {RULE_GROUPS.map(group => (
                <label
                  key={group.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedRules.has(group.id)
                      ? 'bg-blue-600/10 border-blue-500/50 text-white'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRules.has(group.id)}
                    onChange={() => toggleRule(group.id)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t(`rules.${group.id}.label`)}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{t(`rules.${group.id}.description`)}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Step 3: Custom Rules */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-xs flex items-center justify-center font-bold">3</span>
                <h2 className="font-medium text-white">
                  {t('step3.title')}
                  <span className="text-xs text-gray-500 font-normal ml-2">{t('step3.optional')}</span>
                </h2>
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={customRules}
                onChange={e => setCustomRules(e.target.value)}
                placeholder={t('step3.placeholder')}
                rows={4}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y"
                spellCheck={false}
              />
            </div>
          </section>

          {/* Generate Button */}
          <div className="flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('generate.loading')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                  </svg>
                  {t('generate.button')}
                  <kbd className="ml-1 text-[10px] opacity-50 font-mono border border-current rounded px-1">⌘↵</kbd>
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-5 py-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Result */}
          {(subUrl || yamlPreview) && (
            <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="font-medium text-white">{t('result.title')}</h2>
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab('url')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      activeTab === 'url' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('result.tabUrl')}
                  </button>
                  <button
                    onClick={() => setActiveTab('yaml')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      activeTab === 'yaml' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t('result.tabYaml')}
                  </button>
                </div>
              </div>

              {activeTab === 'url' && subUrl && (
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-2">{t('result.urlDescription')}</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={subUrl}
                        className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm font-mono text-gray-300 focus:outline-none min-w-0"
                      />
                      <button
                        onClick={() => copyToClipboard(subUrl, 'url')}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors whitespace-nowrap flex items-center gap-1"
                      >
                        {copied === 'url' ? (
                          <>
                            <svg className="w-4 h-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {t('result.copied')}
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                            {t('result.copy')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-xs text-gray-400 space-y-2">
                    <p className="font-medium text-gray-300 text-sm">{t('result.usageTitle')}</p>
                    <ul className="space-y-1 list-disc list-inside">
                      {(LOCALES[locale]?.messages?.result?.usageItems ?? []).map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'yaml' && yamlPreview && (
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">
                      {t('result.yamlLines', { count: yamlPreview.split('\n').length })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(yamlPreview, 'yaml')}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors"
                      >
                        {copied === 'yaml' ? `✓ ${t('result.copied')}` : t('result.copy')}
                      </button>
                      <button
                        onClick={downloadYaml}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs transition-colors"
                      >
                        {t('result.download')}
                      </button>
                    </div>
                  </div>
                  <pre className="bg-gray-950 border border-gray-700 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-auto max-h-96">
                    {yamlPreview}
                  </pre>
                </div>
              )}
            </section>
          )}

          {/* Protocol Reference */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => document.getElementById('protocol-ref').classList.toggle('hidden')}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <h2 className="font-medium text-gray-300 text-sm">{t('protocolRef.title')}</h2>
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div id="protocol-ref" className="hidden border-t border-gray-800 p-4 space-y-4">
              {[
                { name: 'Hysteria2', key: 'hysteria2', example: 'hysteria2://password@host:port?peer=sni&insecure=1#NodeName' },
                { name: 'AnyTLS',   key: 'anytls',    example: 'anytls://password@host:port?peer=sni&insecure=1&fastopen=1#NodeName' },
                { name: 'VLESS',    key: 'vless',     example: 'vless://uuid@host:port?security=reality&pbk=publickey&sni=sni&fp=chrome&sid=shortid&type=tcp#NodeName' },
                { name: 'Trojan',   key: 'trojan',    example: 'trojan://password@host:port?sni=xxx#NodeName' },
              ].map(p => (
                <div key={p.key} className="space-y-1.5">
                  <div className="text-sm font-medium text-blue-400">{p.name}</div>
                  <code className="block text-xs font-mono bg-gray-950 border border-gray-700 rounded px-3 py-2 text-gray-300 break-all">
                    {p.example}
                  </code>
                  <p className="text-xs text-gray-500">{t(`protocolRef.fields.${p.key}`)}</p>
                </div>
              ))}
            </div>
          </section>

        </main>

        <footer className="border-t border-gray-800 mt-12 py-6">
          <div className="max-w-5xl mx-auto px-4 text-center text-xs text-gray-600">
            {t('footer')}
          </div>
        </footer>
      </div>
    </>
  )
}
