import { useState, useCallback, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useI18n, LOCALES } from '../lib/i18n'
import { useTheme } from '../lib/theme'

const LS_KEY          = 'mihomo_proxy_links'
const LS_KEY_TEMPLATE = 'mihomo_template_url'

/* ── Protocol badge colors [bg, text, border] ─────────────────────── */
const PROTO_COLORS = {
  hy2:    ['rgba(139,92,246,.12)',  '#7c3aed', 'rgba(139,92,246,.25)'],
  anytls: ['rgba(6,182,212,.12)',   '#0e7490', 'rgba(6,182,212,.25)'],
  vless:  ['rgba(37,99,235,.12)',   '#1d4ed8', 'rgba(37,99,235,.25)'],
  trojan: ['rgba(244,63,94,.12)',   '#be123c', 'rgba(244,63,94,.25)'],
  vmess:  ['rgba(245,158,11,.12)',  '#b45309', 'rgba(245,158,11,.25)'],
  ss:     ['rgba(16,185,129,.12)',  '#047857', 'rgba(16,185,129,.25)'],
  tuic:   ['rgba(236,72,153,.12)',  '#9d174d', 'rgba(236,72,153,.25)'],
}
const PROTO_LABELS = {
  hy2: 'Hysteria2', anytls: 'AnyTLS', vless: 'VLESS',
  trojan: 'Trojan', vmess: 'VMess', ss: 'Shadowsocks', tuic: 'TUIC',
}

/* ── Icons ────────────────────────────────────────────────────────── */
function IconSun()  {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
  </svg>
}
function IconMoon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/>
  </svg>
}
function IconAuto() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>
}

/* ── Logo ─────────────────────────────────────────────────────────── */
function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(37,99,235,.4))' }}>
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#1d4ed8"/>
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logoGrad)"/>
      <path d="M7.5 22.5 L11.5 9.5 L16 17 L20.5 9.5 L24.5 22.5"
        stroke="white" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

/* ── Single-button theme toggle ────────────────────────────────────── */
function ThemeToggle({ theme, setTheme, t }) {
  const cycle = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light'
    setTheme(next)
  }
  const label = t(`theme.${theme}`)
  return (
    <button
      onClick={cycle}
      title={`${label} — click to cycle`}
      className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg
        bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        text-gray-500 dark:text-gray-400 text-[11.5px] font-medium
        hover:border-blue-500 transition-colors"
    >
      {theme === 'dark' ? <IconMoon/> : theme === 'light' ? <IconSun/> : <IconAuto/>}
      {label}
    </button>
  )
}

/* ── Step badge ────────────────────────────────────────────────────── */
function StepBadge({ n }) {
  return (
    <span className="w-[22px] h-[22px] rounded-full bg-blue-600 text-white
      flex items-center justify-center text-[11px] font-bold shrink-0"
      style={{ boxShadow: 'var(--shadow-badge)' }}>
      {n}
    </span>
  )
}

/* ── Card wrapper ──────────────────────────────────────────────────── */
function Card({ children, className = '' }) {
  return (
    <section
      className={`bg-white dark:bg-gray-900 rounded-[14px]
        border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {children}
    </section>
  )
}

/* ── Card header ───────────────────────────────────────────────────── */
function CardHeader({ children }) {
  return (
    <div className="px-[18px] py-[13px] border-b border-gray-100 dark:border-gray-800
      flex items-center justify-between">
      {children}
    </div>
  )
}

/* ── Protocol badge ────────────────────────────────────────────────── */
function ProtoBadge({ proto, count }) {
  const [bg, color, border] = PROTO_COLORS[proto] || ['rgba(100,100,100,.1)', '#6b7280', 'rgba(100,100,100,.2)']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 7px', borderRadius: 9999,
      fontSize: 10.5, fontWeight: 500,
      background: bg, color, border: `1px solid ${border}`, letterSpacing: .01,
    }}>
      {PROTO_LABELS[proto] ?? proto}<span style={{ opacity: .55, marginLeft: 1 }}>×{count}</span>
    </span>
  )
}

/* ── Shared button style ───────────────────────────────────────────── */
const secBtnCls = 'flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-xs font-medium ' +
  'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 ' +
  'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 ' +
  'transition-colors cursor-pointer'

/* ── Main page ─────────────────────────────────────────────────────── */
export default function Home() {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme }      = useTheme()

  const [proxyLinks,     setProxyLinks]     = useState('')
  const [templateUrl,    setTemplateUrl]    = useState('')
  const [ruleGroups,     setRuleGroups]     = useState([])
  const [selectedGroups, setSelectedGroups] = useState(null)
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

  /* ── Restore persisted values ─────────────────────────────────── */
  useEffect(() => {
    try {
      const sl = localStorage.getItem(LS_KEY)
      const st = localStorage.getItem(LS_KEY_TEMPLATE)
      if (sl) setProxyLinks(sl)
      if (st) setTemplateUrl(st)
    } catch { }
  }, [])

  /* ── Fetch rule groups from template (debounced) ──────────────── */
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
          setSelectedGroups(new Set(groups))
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

  const didInitialLoad = useRef(false)
  useEffect(() => {
    if (didInitialLoad.current) return
    didInitialLoad.current = true
    fetchGroups(templateUrl)
  }, [templateUrl, fetchGroups])

  const isFirstTemplateChange = useRef(true)
  useEffect(() => {
    if (isFirstTemplateChange.current) { isFirstTemplateChange.current = false; return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchGroups(templateUrl), 800)
    return () => clearTimeout(debounceRef.current)
  }, [templateUrl, fetchGroups])

  /* ── Input handlers ───────────────────────────────────────────── */
  const PROXY_PREFIXES = ['hysteria2://', 'hy2://', 'anytls://', 'vless://', 'trojan://', 'vmess://', 'ss://', 'tuic://']

  const handleProxyInput = useCallback((raw) => {
    const trimmed = raw.trim()
    if (/^https?:\/\//.test(trimmed) && !trimmed.includes('\n')) {
      try {
        const url    = new URL(trimmed)
        const config = url.searchParams.get('config')
        if (config) {
          const lines = decodeURIComponent(config).split(/\n|\|/)
            .map(l => l.trim()).filter(l => PROXY_PREFIXES.some(p => l.startsWith(p)))
          if (lines.length > 0) {
            const joined = lines.join('\n')
            setProxyLinks(joined)
            try { localStorage.setItem(LS_KEY, joined) } catch { }
            setExtractedFrom(trimmed)
            setError(''); return
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

  /* ── Build API URL ────────────────────────────────────────────── */
  const buildApiUrl = useCallback((base) => {
    const links = proxyLinks.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#')).join('\n')
    if (!links) return null
    const params = new URLSearchParams()
    params.set('config', links)
    const tpl = templateUrl.trim()
    if (tpl) params.set('template', tpl)
    if (selectedGroups !== null && ruleGroups.length > 0 &&
        selectedGroups.size < ruleGroups.length)
      params.set('groups', JSON.stringify(Array.from(selectedGroups)))
    const customList = customRules.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'))
    if (customList.length > 0) params.set('customRules', JSON.stringify(customList))
    return `${base}/api/clash?${params.toString()}`
  }, [proxyLinks, templateUrl, selectedGroups, ruleGroups, customRules])

  /* ── Generate ─────────────────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    const links = proxyLinks.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#')).join('\n')
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
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleGenerate() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleGenerate])

  /* ── Clipboard / download ─────────────────────────────────────── */
  const copyToClipboard = useCallback(async (text, key) => {
    try { await navigator.clipboard.writeText(text) } catch {
      const el = document.createElement('textarea')
      el.value = text; document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(key); setTimeout(() => setCopied(''), 2000)
  }, [])

  const downloadYaml = useCallback(() => {
    if (!yamlPreview) return
    const blob = new Blob([yamlPreview], { type: 'application/x-yaml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'clash.yaml'; a.click()
    URL.revokeObjectURL(url)
  }, [yamlPreview])

  /* ── Protocol breakdown ───────────────────────────────────────── */
  const analyzeProxies = () => {
    const MAP = {
      'hysteria2://':'hy2','hy2://':'hy2','anytls://':'anytls',
      'vless://':'vless','trojan://':'trojan','vmess://':'vmess',
      'ss://':'ss','tuic://':'tuic',
    }
    const counts = {}
    for (const line of proxyLinks.split('\n')) {
      const l = line.trim()
      if (!l || l.startsWith('#')) continue
      for (const [pfx, proto] of Object.entries(MAP))
        if (l.startsWith(pfx)) { counts[proto] = (counts[proto]||0)+1; break }
    }
    return { total: Object.values(counts).reduce((a,b)=>a+b,0), breakdown: Object.entries(counts) }
  }
  const { total, breakdown } = analyzeProxies()

  /* ── textarea / input shared style ───────────────────────────── */
  const inputCls = 'w-full bg-gray-50 dark:bg-gray-950 ' +
    'border border-gray-200 dark:border-gray-700 rounded-[9px] ' +
    'px-[13px] py-[9px] text-[12.5px] font-mono ' +
    'text-gray-800 dark:text-gray-200 ' +
    'placeholder-gray-300 dark:placeholder-gray-600 ' +
    'focus:outline-none focus:border-blue-500 ' +
    'transition-colors resize-y leading-relaxed'

  return (
    <>
      <Head>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">

        {/* ── Header ───────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800
          bg-white dark:bg-gray-900"
          style={{ boxShadow: '0 1px 0 var(--tw-shadow-color, rgba(0,0,0,.04))' }}>
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">

            {/* Logo + wordmark */}
            <div className="flex items-center gap-[11px]">
              <LogoMark size={30}/>
              <div>
                <div className="text-[14px] font-semibold text-gray-900 dark:text-white
                  leading-tight tracking-tight">
                  {t('header.title')}
                </div>
                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-px tracking-wide">
                  {t('header.subtitle')}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <ThemeToggle theme={theme} setTheme={setTheme} t={t}/>

              {/* Language toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-800 border border-gray-200
                dark:border-gray-700 rounded-lg p-[3px] gap-[3px]">
                {Object.entries(LOCALES).map(([key, { name }]) => (
                  <button key={key} onClick={() => setLocale(key)}
                    className={`px-[9px] py-[3px] rounded-md text-[11.5px] font-medium
                      transition-colors ${
                        locale === key
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                      }`}>
                    {name}
                  </button>
                ))}
              </div>

              {/* GitHub link */}
              <a href="https://github.com/ififi2017/mihomo-subconverter"
                target="_blank" rel="noopener noreferrer"
                className="w-[30px] h-[30px] flex items-center justify-center rounded-lg
                  border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800
                  text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-gray-700
                  dark:hover:text-white transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-5 py-7 flex flex-col gap-4">

          {/* ── Step 1: Proxy Links ───────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-[9px]">
                <StepBadge n="1"/>
                <span className="text-[13.5px] font-medium text-gray-900 dark:text-white">
                  {t('step1.title')}
                </span>
              </div>
              <div className="flex items-center gap-[7px]">
                {extractedFrom && (
                  <span className="inline-flex items-center gap-1 px-[9px] py-[2px] rounded-full
                    text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400
                    border border-emerald-500/20">
                    <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    {t('step1.extractedBadge')}
                  </span>
                )}
                {total > 0 && (
                  <div className="flex items-center gap-[5px]">
                    <span className="text-[11.5px] font-medium text-gray-400 dark:text-gray-500">
                      {t('step1.nodeCount', { count: total })}
                    </span>
                    <span className="text-gray-300 dark:text-gray-700 text-sm">·</span>
                    <div className="flex gap-[3px]">
                      {breakdown.map(([p,c]) => <ProtoBadge key={p} proto={p} count={c}/>)}
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <div className="p-[18px]">
              <textarea
                value={proxyLinks}
                onChange={e => handleProxyInput(e.target.value)}
                placeholder={t('step1.placeholder')}
                rows={8}
                className={inputCls}
                spellCheck={false}
              />
              <p className="mt-2 text-[11.5px] text-gray-400 dark:text-gray-500 flex flex-wrap gap-[3px] items-center">
                <span>{t('step1.supported')}</span>
                {[
                  ['hy2','Hysteria2'],['anytls','AnyTLS'],['vless','VLESS'],
                  ['trojan','Trojan'],['vmess','VMess'],['ss','Shadowsocks'],['tuic','TUIC'],
                ].map(([k, label], i, arr) => (
                  <span key={k}>
                    <code className="text-blue-500 dark:text-blue-400 font-mono text-[11px]">{label}</code>
                    {i < arr.length-1 && <span className="text-gray-200 dark:text-gray-700 ml-[3px]">·</span>}
                  </span>
                ))}
              </p>
            </div>
          </Card>

          {/* ── Step 2: Rule Groups ───────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-[9px]">
                <StepBadge n="2"/>
                <span className="text-[13.5px] font-medium text-gray-900 dark:text-white">
                  {t('step2.title')}
                </span>
              </div>
              {!groupsLoading && ruleGroups.length > 0 && selectedGroups && (
                <div className="flex gap-2">
                  <button onClick={() => setSelectedGroups(new Set(ruleGroups))}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
                    {t('step2.selectAll')}
                  </button>
                  <span className="text-gray-200 dark:text-gray-700">·</span>
                  <button onClick={() => setSelectedGroups(new Set())}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
                    {t('step2.clear')}
                  </button>
                </div>
              )}
            </CardHeader>

            {/* Template URL sub-row */}
            <div className="px-[18px] pt-3 pb-3 border-b border-gray-50 dark:border-gray-800/60">
              <div className="flex flex-col gap-[6px]">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('step2.templateLabel')}
                  <span className="ml-1 font-normal opacity-60">{t('step2.templateOptional')}</span>
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={templateUrl}
                    onChange={e => handleTemplateInput(e.target.value)}
                    placeholder={t('step2.templatePlaceholder')}
                    className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-950
                      border border-gray-200 dark:border-gray-700 rounded-[9px]
                      px-[11px] py-[7px] text-[12px] font-mono
                      text-gray-700 dark:text-gray-200
                      placeholder-gray-300 dark:placeholder-gray-600
                      focus:outline-none focus:border-blue-500
                      transition-colors"
                    spellCheck={false}
                  />
                  {!templateUrl && (
                    <span className="text-[11px] text-gray-300 dark:text-gray-600 shrink-0 italic hidden sm:block">
                      {t('step2.templateDefault')}
                    </span>
                  )}
                </div>
              </div>
              {/* Description: sub-web compat note + example link */}
              <p className="mt-[7px] text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed flex flex-wrap items-baseline gap-x-1">
                <span>{t('step2.templateDescription')}</span>
                <a href="https://sub-web.pages.dev/" target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 hover:underline">
                  {t('step2.templateDescriptionSubweb')}
                </a>
                <span>{t('step2.templateDescriptionSuffix')}</span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <a href="https://raw.githubusercontent.com/ififi2017/clash_rules/master/config/ACL4SSR_Online_Full.ini"
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 dark:text-blue-400 hover:underline">
                  {t('step2.templateViewExample')}
                  <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor" style={{ display: 'inline', marginLeft: 2, marginBottom: 1 }}>
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                  </svg>
                </a>
              </p>
            </div>

            {/* Groups */}
            <div className="p-[18px]">
              {groupsLoading ? (
                <div className="flex items-center gap-2 justify-center py-5
                  text-sm text-gray-400 dark:text-gray-500">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".25"/>
                    <path fill="currentColor" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {t('step2.loading')}
                </div>
              ) : groupsError ? (
                <div className="flex items-center gap-3 py-3 text-sm text-red-500 dark:text-red-400">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <span className="flex-1">{t('step2.loadError')}: {groupsError}</span>
                  <button onClick={() => fetchGroups(templateUrl)}
                    className="text-xs underline underline-offset-2 hover:no-underline">
                    {t('step2.retry')}
                  </button>
                </div>
              ) : ruleGroups.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {ruleGroups.map(group => {
                    const checked = selectedGroups?.has(group) ?? true
                    return (
                      <label key={group}
                        className={`flex items-center gap-[10px] px-3 py-[10px] rounded-[10px]
                          border cursor-pointer transition-all ${
                          checked
                            ? 'bg-blue-50 dark:bg-blue-600/10 border-blue-400 dark:border-blue-500/50'
                            : 'bg-gray-50/80 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/80 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleGroup(group)}
                          className="mt-px accent-blue-500 shrink-0"/>
                        <span className={`text-[13px] truncate ${
                          checked ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                        }`}>{group}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* ── Steps 3 + 4 side by side ─────────────────────── */}
          {/* We intentionally use "Step 3" label for Custom Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Template description (mobile: first; desktop: right of custom rules) */}
            {/* Step 3: Custom Rules */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-[9px]">
                  <StepBadge n="3"/>
                  <span className="text-[13.5px] font-medium text-gray-900 dark:text-white">
                    {t('step3.title')}
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 font-normal ml-[6px]">
                      {t('step3.optional')}
                    </span>
                  </span>
                </div>
              </CardHeader>
              <div className="p-[18px]">
                <textarea
                  value={customRules}
                  onChange={e => setCustomRules(e.target.value)}
                  placeholder={t('step3.placeholder')}
                  rows={5}
                  className={inputCls}
                  spellCheck={false}
                />
              </div>
            </Card>

            {/* Usage hints panel */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-[9px]">
                  <span className="w-[22px] h-[22px] rounded-full bg-gray-200 dark:bg-gray-700
                    flex items-center justify-center shrink-0">
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"
                      className="text-gray-500 dark:text-gray-400">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                    </svg>
                  </span>
                  <span className="text-[13.5px] font-medium text-gray-900 dark:text-white">
                    {t('guide.title')}
                  </span>
                </div>
              </CardHeader>
              <div className="p-[18px]">
                <ul className="space-y-3">
                  {[
                    <path key="0" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>,
                    <path key="1" fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>,
                    <path key="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>,
                  ].map((icon, i) => (
                    <li key={i} className="flex items-start gap-[10px]">
                      <span className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-900/30
                        flex items-center justify-center shrink-0 mt-px">
                        <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"
                          className="text-blue-500 dark:text-blue-400">
                          {icon}
                        </svg>
                      </span>
                      <span className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t(`guide.items.${i}`)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                    {t('guide.footnote').split('{acl4ssr}').map((part, i) =>
                      i === 0 ? part : (
                        <span key={i}>
                          <a href="https://github.com/ACL4SSR/ACL4SSR" target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 dark:text-blue-400 hover:underline">ACL4SSR</a>
                          {part}
                        </span>
                      )
                    )}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Generate Button ───────────────────────────────── */}
          <div className="flex justify-center py-1">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-[7px] px-8 py-[11px] rounded-[10px]
                text-white text-[13.5px] font-semibold tracking-[.01em]
                disabled:cursor-not-allowed transition-all"
              style={{
                background: loading
                  ? '#93c5fd'
                  : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: loading ? 'none' : 'var(--shadow-btn)',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg,#1d4ed8,#1e40af)' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}
            >
              {loading ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    style={{ animation: 'spin .8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".25"/>
                    <path fill="currentColor" opacity=".8" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {t('generate.loading')}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd"/>
                  </svg>
                  {t('generate.button')}
                  <kbd className="text-[10px] opacity-50 font-mono border border-current rounded px-1 ml-1">⌘↵</kbd>
                </>
              )}
            </button>
          </div>

          {/* ── Error ─────────────────────────────────────────── */}
          {error && (
            <div className="animate-in flex items-center gap-2 px-4 py-3 rounded-xl
              bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50
              text-red-600 dark:text-red-400 text-[13px]">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="shrink-0">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              {error}
            </div>
          )}

          {/* ── Result ────────────────────────────────────────── */}
          {(subUrl || yamlPreview) && (
            <Card className="animate-in">
              <CardHeader>
                <div className="flex items-center gap-2">
                  {/* Live green dot */}
                  <span className="w-[7px] h-[7px] rounded-full bg-emerald-500"
                    style={{ boxShadow: '0 0 0 3px rgba(34,197,94,.2)' }}/>
                  <span className="text-[13.5px] font-medium text-gray-900 dark:text-white">
                    {t('result.title')}
                  </span>
                </div>
                {/* Tab switcher */}
                <div className="flex bg-gray-100 dark:bg-gray-800 border border-gray-200
                  dark:border-gray-700 rounded-lg p-[3px] gap-[3px]">
                  {[['url', t('result.tabUrl')], ['yaml', t('result.tabYaml')]].map(([key, label]) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                      className={`px-3 py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                        activeTab === key
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </CardHeader>

              {activeTab === 'url' && subUrl && (
                <div className="p-[18px] flex flex-col gap-4">
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                      {t('result.urlDescription')}
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-950
                        border border-gray-200 dark:border-gray-700 rounded-[9px] px-3 py-2 overflow-hidden">
                        <div className="text-[12px] font-mono text-gray-600 dark:text-gray-300
                          whitespace-nowrap overflow-hidden text-ellipsis">
                          {subUrl}
                        </div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(subUrl, 'url')}
                        className={`${secBtnCls} whitespace-nowrap ${
                          copied === 'url'
                            ? '!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400 !border-emerald-500/30'
                            : ''
                        }`}>
                        {copied === 'url' ? (
                          <><svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>{t('result.copied')}</>
                        ) : (
                          <><svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>{t('result.copy')}</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'yaml' && yamlPreview && (
                <div className="p-[18px]">
                  <div className="flex justify-between items-center mb-[10px]">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {t('result.yamlLines', { count: yamlPreview.split('\n').length })}
                    </span>
                    <div className="flex gap-[6px]">
                      <button onClick={() => copyToClipboard(yamlPreview, 'yaml')}
                        className={secBtnCls}>
                        {copied === 'yaml' ? `✓ ${t('result.copied')}` : t('result.copy')}
                      </button>
                      <button onClick={downloadYaml}
                        className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg
                          text-xs font-medium text-white transition-colors"
                        style={{
                          background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                          boxShadow: 'var(--shadow-btn)',
                        }}>
                        <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                        </svg>
                        {t('result.download')}
                      </button>
                    </div>
                  </div>
                  <pre className="rounded-[10px] p-[14px] text-[12px] font-mono
                    overflow-auto max-h-[300px] leading-[1.7]"
                    style={{
                      background: '#0d1117',
                      border: '1px solid rgba(255,255,255,.06)',
                      color: '#8fbcbb',
                    }}>
                    {yamlPreview}
                  </pre>
                </div>
              )}
            </Card>
          )}

        </main>

        <footer className="border-t border-gray-100 dark:border-gray-800 mt-10 py-5">
          <div className="max-w-5xl mx-auto px-5 text-center text-[11.5px]
            text-gray-300 dark:text-gray-600 tracking-[.01em]">
            {t('footer')}
          </div>
        </footer>
      </div>
    </>
  )
}
