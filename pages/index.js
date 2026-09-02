import { useState, useCallback, useEffect, useRef } from 'react'
import Head from 'next/head'
import QRCode from 'qrcode'
import { useI18n, LOCALES } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import {
  LS_KEY_PROXY_LINKS, LS_KEY_TEMPLATE_URL, LS_KEY_ACCESS_TOKEN,
  LS_KEY_CUSTOM_RULES,
} from '../lib/constants'
import { expandPastedInput } from '../lib/parser'
import pkg from '../package.json'
import ThemeToggle from '../components/ThemeToggle'
import ProxyInput from '../components/ProxyInput'
import RuleGroups from '../components/RuleGroups'
import CustomRules, { GuidePanel } from '../components/CustomRules'
import ResultPanel from '../components/ResultPanel'
import { Card, secBtnCls } from '../components/UI'

const LS_KEY          = LS_KEY_PROXY_LINKS
const LS_KEY_TEMPLATE = LS_KEY_TEMPLATE_URL
const LS_KEY_TOKEN    = LS_KEY_ACCESS_TOKEN
const LS_KEY_RULES    = LS_KEY_CUSTOM_RULES

function getSavedToken() {
  try { return localStorage.getItem(LS_KEY_TOKEN) || '' } catch { return '' }
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

/* ── Update notification (bottom-right toast) ──────────────────────── */
function UpdateNotification() {
  const { t } = useI18n()
  const [info,      setInfo]      = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('update_dismissed')) { setDismissed(true); return }
    fetch('/api/check-update')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.hasUpdate) setInfo(d) })
      .catch(() => {})
  }, [])

  const dismiss = (e) => {
    e.stopPropagation()
    sessionStorage.setItem('update_dismissed', '1')
    setDismissed(true)
  }

  if (!info || dismissed) return null

  return (
    <a href={info.url} target="_blank" rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 flex items-start gap-3
        max-w-[280px] px-4 py-3 rounded-[13px]
        bg-white dark:bg-gray-900
        border border-blue-200 dark:border-blue-700/60
        text-gray-800 dark:text-gray-100
        hover:border-blue-400 dark:hover:border-blue-500
        transition-all cursor-pointer"
      style={{ boxShadow: '0 4px 20px rgba(37,99,235,.15), 0 1px 4px rgba(0,0,0,.08)', animation: 'fadeIn .3s ease both' }}>
      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-[3px]"
        style={{ boxShadow: '0 0 0 3px rgba(59,130,246,.2)' }}/>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white leading-tight">
          {t('update.title')}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-[2px]">
          {t('update.body', { version: info.latest })}
        </p>
      </div>
      <button onClick={dismiss}
        className="shrink-0 w-5 h-5 flex items-center justify-center
          rounded-full text-gray-300 dark:text-gray-600
          hover:text-gray-500 dark:hover:text-gray-400
          hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <svg width="9" height="9" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </button>
    </a>
  )
}

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
  const [accessToken,    setAccessToken]    = useState('')
  const [authRequired,   setAuthRequired]   = useState(false)
  const [showQr,         setShowQr]         = useState(false)
  const [qrDataUrl,      setQrDataUrl]      = useState('')
  const [qrError,        setQrError]        = useState(false)
  const [isMac,          setIsMac]          = useState(true)

  const resultRef  = useRef(null)
  const yamlPreRef = useRef(null)

  /* ── Warn before leaving if proxy links are entered but not yet generated ── */
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (proxyLinks.trim() && !yamlPreview) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [proxyLinks, yamlPreview])

  /* ── Restore persisted values ─────────────────────────────────── */
  useEffect(() => {
    try {
      const sl = localStorage.getItem(LS_KEY)
      const st = localStorage.getItem(LS_KEY_TEMPLATE)
      const sr = localStorage.getItem(LS_KEY_RULES)
      if (sl) setProxyLinks(sl)
      if (st) setTemplateUrl(st)
      if (sr) setCustomRules(sr)
    } catch { }
    setAccessToken(getSavedToken())
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
  }, [])

  /* ── QR code for the subscription URL ─────────────────────────── */
  useEffect(() => {
    if (!showQr || !subUrl) return
    QRCode.toDataURL(subUrl, { width: 220, margin: 1, errorCorrectionLevel: 'L' })
      .then(d => { setQrDataUrl(d); setQrError(false) })
      .catch(() => { setQrDataUrl(''); setQrError(true) })
  }, [showQr, subUrl])

  /* ── Fetch rule groups from template (debounced) ──────────────── */
  const debounceRef = useRef(null)
  const abortRef    = useRef(null)

  const fetchGroups = useCallback((url) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setGroupsLoading(true)
    setGroupsError('')
    const params = new URLSearchParams()
    if (url?.trim()) params.set('url', url.trim())
    const token = getSavedToken()
    if (token) params.set('token', token)
    fetch(`/api/preview-template?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then(({ groups, error, authRequired: needsAuth }) => {
        setAuthRequired(!!needsAuth)
        if (error && (!groups || groups.length === 0)) {
          setGroupsError(needsAuth ? '' : error)
          setRuleGroups([])
          setSelectedGroups(new Set())
        } else {
          setRuleGroups(groups)
          setSelectedGroups(new Set(groups))
          setGroupsError('')
        }
      })
      .catch(e => {
        if (e.name === 'AbortError') return
        setGroupsError(e.message)
        setRuleGroups([])
        setSelectedGroups(new Set())
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false)
      })
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

  const handleProxyInput = useCallback((raw) => {
    const { text, kind } = expandPastedInput(raw)
    setProxyLinks(text)
    try { localStorage.setItem(LS_KEY, text) } catch { }
    setExtractedFrom(kind)
    if (kind) setError('')
  }, [])

  const handleTemplateInput = useCallback((val) => {
    setTemplateUrl(val)
    try { localStorage.setItem(LS_KEY_TEMPLATE, val) } catch { }
  }, [])

  const handleTokenInput = useCallback((val) => {
    setAccessToken(val)
    try { localStorage.setItem(LS_KEY_TOKEN, val) } catch { }
  }, [])

  const handleCustomRulesInput = useCallback((val) => {
    setCustomRules(val)
    try { localStorage.setItem(LS_KEY_RULES, val) } catch { }
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
    if (accessToken.trim()) params.set('token', accessToken.trim())
    const tpl = templateUrl.trim()
    if (tpl) params.set('template', tpl)
    if (selectedGroups !== null && ruleGroups.length > 0 &&
        selectedGroups.size < ruleGroups.length)
      params.set('groups', JSON.stringify(Array.from(selectedGroups)))
    const customList = customRules.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'))
    if (customList.length > 0) params.set('customRules', JSON.stringify(customList))
    return `${base}/api/clash?${params.toString()}`
  }, [proxyLinks, templateUrl, selectedGroups, ruleGroups, customRules, accessToken])

  /* ── Generate ─────────────────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    const links = proxyLinks.trim()
    if (!links) { setError(t('generate.errorEmpty')); return }
    setError('')
    setLoading(true)
    try {
      const url = buildApiUrl(window.location.origin)
      if (!url) { setError(t('generate.errorEmpty')); setLoading(false); return }
      const body = { config: links }
      if (accessToken.trim()) body.token = accessToken.trim()
      if (templateUrl.trim()) body.template = templateUrl.trim()
      if (selectedGroups !== null && ruleGroups.length > 0 &&
          selectedGroups.size < ruleGroups.length) {
        body.groups = Array.from(selectedGroups)
      }
      const customList = customRules.trim().split('\n')
        .filter(l => l.trim() && !l.trim().startsWith('#'))
      if (customList.length > 0) body.customRules = customList

      const postUrl = accessToken.trim()
        ? `/api/clash?token=${encodeURIComponent(accessToken.trim())}`
        : '/api/clash'
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setYamlPreview(await res.text())
      setSubUrl(url)
      setActiveTab('url')
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch (e) {
      setError(e.message || t('generate.errorFailed'))
    } finally {
      setLoading(false)
    }
  }, [proxyLinks, templateUrl, selectedGroups, ruleGroups, customRules, accessToken, buildApiUrl, t])

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

  return (
    <>
      <Head>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="robots" content="noindex, nofollow, noarchive" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">

        {/* ── Header ───────────────────────────────────────────── */}
        <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800
          bg-white dark:bg-gray-900"
          style={{ boxShadow: '0 1px 0 var(--tw-shadow-color, rgba(0,0,0,.04))' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-2">

            <div className="flex items-center gap-[9px] sm:gap-[11px] min-w-0">
              <LogoMark size={30}/>
              <div className="min-w-0">
                <div className="flex items-baseline gap-[6px]">
                  <span className="text-[14px] font-semibold text-gray-900 dark:text-white
                    leading-tight tracking-tight whitespace-nowrap">
                    {t('header.title')}
                  </span>
                  <span className="hidden sm:inline text-[10.5px] font-medium text-gray-300 dark:text-gray-600
                    tracking-wide select-none">
                    v{pkg.version}
                  </span>
                </div>
                <div className="hidden sm:block text-[11px] text-gray-400 dark:text-gray-500 mt-px tracking-wide truncate">
                  {t('header.subtitle')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <ThemeToggle theme={theme} setTheme={setTheme} t={t}/>

              <div className="flex bg-gray-100 dark:bg-gray-800 border border-gray-200
                dark:border-gray-700 rounded-lg p-[3px] gap-[3px]">
                {Object.entries(LOCALES).map(([key, { name }]) => (
                  <button key={key} onClick={() => setLocale(key)}
                    className={`px-2 sm:px-[9px] py-[3px] rounded-md text-[11.5px] font-medium
                      transition-colors ${
                        locale === key
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                      }`}>
                    {name}
                  </button>
                ))}
              </div>

              <a href="https://github.com/ififi2017/mihomo-subconverter"
                target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex w-[30px] h-[30px] items-center justify-center rounded-lg
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

          {/* ── Access token (only when the deploy sets ACCESS_TOKEN) ── */}
          {authRequired && (
            <Card className="animate-in">
              <div className="p-[18px] flex flex-col gap-2">
                <span className="text-[13px] font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" className="text-amber-500">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                  </svg>
                  {t('auth.title')}
                </span>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={accessToken}
                    onChange={e => handleTokenInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') fetchGroups(templateUrl) }}
                    placeholder={t('auth.placeholder')}
                    className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-950
                      border border-gray-200 dark:border-gray-700 rounded-[9px]
                      px-[11px] py-[7px] text-[12px] font-mono
                      text-gray-700 dark:text-gray-200
                      placeholder-gray-300 dark:placeholder-gray-600
                      focus:outline-none focus:border-blue-500 transition-colors"
                    spellCheck={false}
                  />
                  <button onClick={() => fetchGroups(templateUrl)} className={secBtnCls}>
                    {t('auth.confirm')}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  {t('auth.hint')}
                </p>
              </div>
            </Card>
          )}

          {/* ── Step 1: Proxy Links ───────────────────────────── */}
          <ProxyInput
            value={proxyLinks}
            onChange={handleProxyInput}
            extractedFrom={extractedFrom}
            t={t}
          />

          {/* ── Step 2: Rule Groups ───────────────────────────── */}
          <RuleGroups
            templateUrl={templateUrl}
            onTemplateChange={handleTemplateInput}
            groupsLoading={groupsLoading}
            groupsError={groupsError}
            ruleGroups={ruleGroups}
            selectedGroups={selectedGroups}
            onToggleGroup={toggleGroup}
            onSelectAll={() => setSelectedGroups(new Set(ruleGroups))}
            onClear={() => setSelectedGroups(new Set())}
            onFetchGroups={fetchGroups}
            t={t}
          />

          {/* ── Steps 3 + 4 side by side ─────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CustomRules value={customRules} onChange={handleCustomRulesInput} t={t} />
            <GuidePanel t={t} />
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
                  <kbd className="text-[10px] opacity-50 font-mono border border-current rounded px-1 ml-1">{isMac ? '⌘↵' : 'Ctrl↵'}</kbd>
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
          <ResultPanel
            subUrl={subUrl}
            yamlPreview={yamlPreview}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            copied={copied}
            onCopy={copyToClipboard}
            onDownload={downloadYaml}
            showQr={showQr}
            qrDataUrl={qrDataUrl}
            qrError={qrError}
            onToggleQr={() => setShowQr(v => !v)}
            yamlPreRef={yamlPreRef}
            resultRef={resultRef}
            t={t}
          />

        </main>

        <footer className="border-t border-gray-100 dark:border-gray-800 mt-10 py-5">
          <div className="max-w-5xl mx-auto px-5 text-center text-[11.5px]
            text-gray-300 dark:text-gray-600 tracking-[.01em]">
            {t('footer')}
          </div>
        </footer>
      </div>

      <UpdateNotification />
    </>
  )
}