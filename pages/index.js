import { useState, useCallback, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useI18n, LOCALES } from '../lib/i18n'
import { useTheme } from '../lib/theme'

const LS_KEY          = 'mihomo_proxy_links'
const LS_KEY_TEMPLATE = 'mihomo_template_url'

const PROTO_COLORS = {
  hy2:    'bg-violet-500/15 text-violet-500 dark:text-violet-400 ring-violet-500/20',
  anytls: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20',
  vless:  'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-blue-500/20',
  trojan: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/20',
  vmess:  'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  ss:     'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  tuic:   'bg-pink-500/15 text-pink-600 dark:text-pink-400 ring-pink-500/20',
}

const THEME_OPTIONS = [
  {
    key: 'auto',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    key: 'light',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
      </svg>
    ),
  },
  {
    key: 'dark',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
      </svg>
    ),
  },
]

export default function Home() {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme }      = useTheme()

  const [proxyLinks,     setProxyLinks]     = useState('')
  const [templateUrl,    setTemplateUrl]    = useState('')
  const [ruleGroups,     setRuleGroups]     = useState([])    // group names from template
  const [selectedGroups, setSelectedGroups] = useState(null)  // null = loading/all
  const [groupsLoading,  setGroupsLoading]  = useState(false)
  const [groupsError,    setGroupsError]    = useState('')
  const [customRules,    setCustomRules]    = useState('')
  const [subUrl,         setSubUrl]         = useState('')
  const [yamlPreview,    setYamlPreview]    = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [copied,         setCopied]         = useState('')
  const [activeTab,      setActiveTab]      = useState('url')
  const [extractedFrom,  setExtractedFrom]  = useState('')

  // ── Restore persisted values ───────────────────────────────────────────
  useEffect(() => {
    try {
      const savedLinks    = localStorage.getItem(LS_KEY)
      const savedTemplate = localStorage.getItem(LS_KEY_TEMPLATE)
      if (savedLinks)    setProxyLinks(savedLinks)
      if (savedTemplate) setTemplateUrl(savedTemplate)
    } catch { }
  }, [])

  // ── Fetch rule groups from template (debounced) ────────────────────────
  const debounceRef = useRef(null)

  const fetchGroups = useCallback((url) => {
    setGroupsLoading(true)
    setGroupsError('')
    const params = new URLSearchParams()
    if (url?.trim()) params.set('url', url.trim())
    fetch(`/api/preview-template?${params}`)
      .then(r => r.json())
      .then(({ groups, error }) => {
        if (error && (!groups || groups.length === 0)) {
          setGroupsError(error)
          setRuleGroups([])
          setSelectedGroups(new Set())
        } else {
          setRuleGroups(groups)
          setSelectedGroups(new Set(groups))  // default: all selected
          setGroupsError('')
        }
      })
      .catch(e => {
        setGroupsError(e.message)
        setRuleGroups([])
        setSelectedGroups(new Set())
      })
      .finally(() => setGroupsLoading(false))
  }, [])

  // Initial load using the restored / default template
  const didInitialLoad = useRef(false)
  useEffect(() => {
    if (didInitialLoad.current) return
    didInitialLoad.current = true
    fetchGroups(templateUrl)
  }, [templateUrl, fetchGroups])

  // Re-fetch when template URL changes (debounced 800 ms)
  const isFirstTemplateChange = useRef(true)
  useEffect(() => {
    if (isFirstTemplateChange.current) { isFirstTemplateChange.current = false; return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchGroups(templateUrl), 800)
    return () => clearTimeout(debounceRef.current)
  }, [templateUrl, fetchGroups])

  // ── Proxy link helpers ─────────────────────────────────────────────────
  const PROXY_PREFIXES = ['hysteria2://', 'hy2://', 'anytls://', 'vless://', 'trojan://', 'vmess://', 'ss://', 'tuic://']

  const handleProxyInput = useCallback((raw) => {
    const trimmed = raw.trim()
    if (/^https?:\/\//.test(trimmed) && !trimmed.includes('\n')) {
      try {
        const url    = new URL(trimmed)
        const config = url.searchParams.get('config')
        if (config) {
          const decoded = decodeURIComponent(config)
          const lines   = decoded.split(/\n|\|/).map(l => l.trim()).filter(l =>
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
      } catch { }
    }
    setProxyLinks(raw)
    try { localStorage.setItem(LS_KEY, raw) } catch { }
    setExtractedFrom('')
  }, [])

  const handleTemplateInput = useCallback((val) => {
    setTemplateUrl(val)
    try { localStorage.setItem(LS_KEY_TEMPLATE, val) } catch { }
  }, [])

  const toggleGroup = useCallback((name) => {
    setSelectedGroups(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }, [])

  // ── Build API URL ──────────────────────────────────────────────────────
  const buildApiUrl = useCallback((base) => {
    const links = proxyLinks.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'))
      .join('\n')
    if (!links) return null

    const params = new URLSearchParams()
    params.set('config', links)

    const tpl = templateUrl.trim()
    if (tpl) params.set('template', tpl)

    // Only pass groups if the user has deselected at least one
    if (selectedGroups !== null && ruleGroups.length > 0 &&
        selectedGroups.size < ruleGroups.length) {
      params.set('groups', JSON.stringify(Array.from(selectedGroups)))
    }

    const customList = customRules.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'))
    if (customList.length > 0) params.set('customRules', JSON.stringify(customList))

    return `${base}/api/clash?${params.toString()}`
  }, [proxyLinks, templateUrl, selectedGroups, ruleGroups, customRules])

  // ── Generate ───────────────────────────────────────────────────────────
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

  // ── Clipboard / download ───────────────────────────────────────────────
  const copyToClipboard = useCallback(async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text; document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }, [])

  const downloadYaml = useCallback(() => {
    if (!yamlPreview) return
    const blob = new Blob([yamlPreview], { type: 'application/x-yaml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'clash.yaml'; a.click()
    URL.revokeObjectURL(url)
  }, [yamlPreview])

  // ── Protocol breakdown ─────────────────────────────────────────────────
  const analyzeProxies = () => {
    const PROTO_MAP = {
      'hysteria2://': 'hy2', 'hy2://': 'hy2',
      'anytls://': 'anytls', 'vless://': 'vless',
      'trojan://': 'trojan', 'vmess://': 'vmess',
      'ss://': 'ss', 'tuic://': 'tuic',
    }
    const counts = {}
    for (const line of proxyLinks.split('\n')) {
      const l = line.trim()
      if (!l || l.startsWith('#')) continue
      for (const [prefix, proto] of Object.entries(PROTO_MAP)) {
        if (l.startsWith(prefix)) { counts[proto] = (counts[proto] || 0) + 1; break }
      }
    }
    return {
      total:     Object.values(counts).reduce((a, b) => a + b, 0),
      breakdown: Object.entries(counts),
    }
  }

  const { total, breakdown } = analyzeProxies()

  // ── Shared class fragments ─────────────────────────────────────────────
  const card     = 'bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden'
  const cardHdr  = 'px-5 py-4 border-b border-gray-200 dark:border-gray-800'
  const pill     = 'bg-gray-100 dark:bg-gray-800 rounded-lg p-1'
  const pillBtn  = (active) => `px-3 py-1 text-xs rounded-md transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`
  const textarea = 'w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y'

  return (
    <>
      <Head>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">

        {/* ── Header ── */}
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold text-white">M</div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t('header.title')}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('header.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={pill}>
                {THEME_OPTIONS.map(({ key, icon }) => (
                  <button key={key} onClick={() => setTheme(key)} title={t(`theme.${key}`)} className={pillBtn(theme === key)}>
                    {icon}
                  </button>
                ))}
              </div>
              <div className={pill}>
                {Object.entries(LOCALES).map(([key, { name }]) => (
                  <button key={key} onClick={() => setLocale(key)} className={pillBtn(locale === key)}>
                    {name}
                  </button>
                ))}
              </div>
              <a
                href="https://github.com/ACL4SSR/ACL4SSR"
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hidden sm:block"
              >
                {t('header.credit')}
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

          {/* ── Step 1: Proxy Links ── */}
          <section className={card}>
            <div className={`${cardHdr} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-xs flex items-center justify-center font-bold text-white">1</span>
                <h2 className="font-medium text-gray-900 dark:text-white">{t('step1.title')}</h2>
              </div>
              <div className="flex items-center gap-2">
                {extractedFrom && (
                  <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {t('step1.extractedBadge')}
                  </span>
                )}
                {total > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('step1.nodeCount', { count: total })}
                    </span>
                    <span className="text-gray-300 dark:text-gray-700">·</span>
                    {breakdown.map(([proto, count]) => (
                      <span
                        key={proto}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ${PROTO_COLORS[proto] ?? 'bg-gray-500/15 text-gray-500 ring-gray-500/20'}`}
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
                className={textarea}
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                {t('step1.supported')}{' '}
                {[
                  { key: 'hy2',    label: 'Hysteria2'   },
                  { key: 'anytls', label: 'AnyTLS'      },
                  { key: 'vless',  label: 'VLESS'       },
                  { key: 'trojan', label: 'Trojan'      },
                  { key: 'vmess',  label: 'VMess'       },
                  { key: 'ss',     label: 'Shadowsocks' },
                  { key: 'tuic',   label: 'TUIC'        },
                ].map(({ key, label }, i, arr) => (
                  <span key={key}>
                    <code className="text-blue-500 dark:text-blue-400">{label}</code>
                    {i < arr.length - 1 && <span className="text-gray-300 dark:text-gray-600"> · </span>}
                  </span>
                ))}
              </p>
            </div>
          </section>

          {/* ── Step 2: Rule Groups ── */}
          <section className={card}>
            {/* Card header */}
            <div className={`${cardHdr} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-xs flex items-center justify-center font-bold text-white">2</span>
                <h2 className="font-medium text-gray-900 dark:text-white">{t('step2.title')}</h2>
              </div>
              {!groupsLoading && ruleGroups.length > 0 && selectedGroups && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedGroups(new Set(ruleGroups))}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {t('step2.selectAll')}
                  </button>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <button
                    onClick={() => setSelectedGroups(new Set())}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    {t('step2.clear')}
                  </button>
                </div>
              )}
            </div>

            {/* Template URL sub-row */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800/60 flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
                {t('step2.templateLabel')}
                <span className="ml-1 opacity-60">{t('step2.templateOptional')}</span>
              </span>
              <input
                type="url"
                value={templateUrl}
                onChange={e => handleTemplateInput(e.target.value)}
                placeholder={t('step2.templatePlaceholder')}
                className="flex-1 min-w-0 bg-transparent text-xs font-mono text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none"
                spellCheck={false}
              />
              {!templateUrl && (
                <span className="text-[11px] text-gray-300 dark:text-gray-600 whitespace-nowrap shrink-0 italic hidden sm:block">
                  {t('step2.templateDefault')}
                </span>
              )}
            </div>

            {/* Groups area */}
            <div className="p-4">
              {groupsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-4 justify-center">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('step2.loading')}
                </div>
              ) : groupsError ? (
                <div className="flex items-center gap-3 py-3 text-sm text-red-500 dark:text-red-400">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="flex-1">{t('step2.loadError')}: {groupsError}</span>
                  <button
                    onClick={() => fetchGroups(templateUrl)}
                    className="text-xs underline underline-offset-2 hover:no-underline"
                  >
                    {t('step2.retry')}
                  </button>
                </div>
              ) : ruleGroups.length === 0 ? null : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {ruleGroups.map(group => {
                    const checked = selectedGroups?.has(group) ?? true
                    return (
                      <label
                        key={group}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-400 dark:border-blue-500/50'
                            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroup(group)}
                          className="mt-px accent-blue-500 shrink-0"
                        />
                        <span className={`text-sm truncate ${checked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                          {group}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ── Step 3: Custom Rules ── */}
          <section className={card}>
            <div className={cardHdr}>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-xs flex items-center justify-center font-bold text-white">3</span>
                <h2 className="font-medium text-gray-900 dark:text-white">
                  {t('step3.title')}
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-normal ml-2">{t('step3.optional')}</span>
                </h2>
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={customRules}
                onChange={e => setCustomRules(e.target.value)}
                placeholder={t('step3.placeholder')}
                rows={4}
                className={textarea}
                spellCheck={false}
              />
            </div>
          </section>

          {/* ── Generate Button ── */}
          <div className="flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center gap-2 text-sm"
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

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 rounded-xl px-5 py-4 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Result ── */}
          {(subUrl || yamlPreview) && (
            <section className={card}>
              <div className={`${cardHdr} flex items-center justify-between`}>
                <h2 className="font-medium text-gray-900 dark:text-white">{t('result.title')}</h2>
                <div className={pill}>
                  <button onClick={() => setActiveTab('url')}  className={pillBtn(activeTab === 'url')} >{t('result.tabUrl')}</button>
                  <button onClick={() => setActiveTab('yaml')} className={pillBtn(activeTab === 'yaml')}>{t('result.tabYaml')}</button>
                </div>
              </div>

              {activeTab === 'url' && subUrl && (
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('result.urlDescription')}</p>
                    <div className="flex gap-2">
                      <input
                        readOnly value={subUrl}
                        className="flex-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm font-mono text-gray-700 dark:text-gray-300 focus:outline-none min-w-0"
                      />
                      <button
                        onClick={() => copyToClipboard(subUrl, 'url')}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors whitespace-nowrap flex items-center gap-1 text-gray-700 dark:text-gray-200"
                      >
                        {copied === 'url' ? (
                          <><svg className="w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>{t('result.copied')}</>
                        ) : (
                          <><svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>{t('result.copy')}</>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-xs text-gray-500 dark:text-gray-400 space-y-2">
                    <p className="font-medium text-gray-700 dark:text-gray-300 text-sm">{t('result.usageTitle')}</p>
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
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('result.yamlLines', { count: yamlPreview.split('\n').length })}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(yamlPreview, 'yaml')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs transition-colors">
                        {copied === 'yaml' ? `✓ ${t('result.copied')}` : t('result.copy')}
                      </button>
                      <button onClick={downloadYaml} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs transition-colors">
                        {t('result.download')}
                      </button>
                    </div>
                  </div>
                  <pre className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-96">
                    {yamlPreview}
                  </pre>
                </div>
              )}
            </section>
          )}

        </main>

        <footer className="border-t border-gray-200 dark:border-gray-800 mt-12 py-6">
          <div className="max-w-5xl mx-auto px-4 text-center text-xs text-gray-400 dark:text-gray-600">
            {t('footer')}
          </div>
        </footer>
      </div>
    </>
  )
}
