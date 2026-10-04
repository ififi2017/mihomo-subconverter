import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import Head from 'next/head'
import QRCode from 'qrcode'
import { useI18n, LOCALES } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import {
  LS_KEY_PROXY_LINKS,
  LS_KEY_TEMPLATE_URL,
  LS_KEY_ACCESS_TOKEN,
  LS_KEY_CUSTOM_RULES,
} from '../lib/constants'
import { expandPastedInput } from '../lib/parser'
import pkg from '../package.json'
import ThemeToggle from '../components/ThemeToggle'
import ProxyInput from '../components/ProxyInput'
import RuleGroups from '../components/RuleGroups'
import CustomRules, { GuidePanel } from '../components/CustomRules'
import ResultPanel from '../components/ResultPanel'
import { Card, Icon, LogoMark } from '../components/UI'
import { analyzeInput, configRevision } from '../lib/workspaceState'

const LS_KEY = LS_KEY_PROXY_LINKS
const LS_KEY_TEMPLATE = LS_KEY_TEMPLATE_URL
const LS_KEY_TOKEN = LS_KEY_ACCESS_TOKEN
const LS_KEY_RULES = LS_KEY_CUSTOM_RULES

function getSavedToken() {
  try {
    return localStorage.getItem(LS_KEY_TOKEN) || ''
  } catch {
    return ''
  }
}

function UpdateNotification() {
  const { t } = useI18n()
  const [info, setInfo] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    try {
      if (sessionStorage.getItem('update_dismissed')) return
    } catch {}
    fetch('/api/check-update')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.hasUpdate) setInfo(d)
      })
      .catch(() => {})
  }, [])
  if (!info || dismissed) return null
  return (
    <div className="update-toast">
      <span className="status-dot ready" />
      <a href={info.url} target="_blank" rel="noopener noreferrer">
        <strong>{t('update.title')}</strong>
        <span>{t('update.body', { version: info.latest })}</span>
      </a>
      <button
        className="button icon-button"
        aria-label={t('studio.close')}
        onClick={() => {
          setDismissed(true)
          try {
            sessionStorage.setItem('update_dismissed', '1')
          } catch {}
        }}
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  )
}

/* ── Main page ─────────────────────────────────────────────────────── */
export default function Home() {
  const { t, locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()

  const [proxyLinks, setProxyLinks] = useState('')
  const [templateUrl, setTemplateUrl] = useState('')
  const [ruleGroups, setRuleGroups] = useState([])
  const [selectedGroups, setSelectedGroups] = useState(null)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState('')
  const [customRules, setCustomRules] = useState('')
  const [subUrl, setSubUrl] = useState('')
  const [yamlPreview, setYamlPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [activeTab, setActiveTab] = useState('url')
  const [extractedFrom, setExtractedFrom] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [authRequired, setAuthRequired] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrError, setQrError] = useState(false)
  const [isMac, setIsMac] = useState(true)

  const [generatedRevision, setGeneratedRevision] = useState('')
  const generatingRef = useRef(false)
  const resultRef = useRef(null)
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
    } catch {}
    setAccessToken(getSavedToken())
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
  }, [])

  /* ── QR code for the subscription URL ─────────────────────────── */
  useEffect(() => {
    if (!showQr || !subUrl) return
    QRCode.toDataURL(subUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'L',
    })
      .then((d) => {
        setQrDataUrl(d)
        setQrError(false)
      })
      .catch(() => {
        setQrDataUrl('')
        setQrError(true)
      })
  }, [showQr, subUrl])

  /* ── Fetch rule groups from template (debounced) ──────────────── */
  const debounceRef = useRef(null)
  const abortRef = useRef(null)

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
      .then((r) => r.json())
      .then(({ groups, error, authRequired: needsAuth }) => {
        if (controller.signal.aborted) return
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
      .catch((e) => {
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
    if (isFirstTemplateChange.current) {
      isFirstTemplateChange.current = false
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchGroups(templateUrl), 800)
    return () => clearTimeout(debounceRef.current)
  }, [templateUrl, fetchGroups])

  /* ── Input handlers ───────────────────────────────────────────── */

  const handleProxyInput = useCallback((raw) => {
    const { text, kind } = expandPastedInput(raw)
    setProxyLinks(text)
    try {
      localStorage.setItem(LS_KEY, text)
    } catch {}
    setExtractedFrom(kind)
    if (kind) setError('')
  }, [])

  const handleTemplateInput = useCallback(
    (val) => {
      if (val === templateUrl) return
      abortRef.current?.abort()
      setTemplateUrl(val)
      setGroupsLoading(true)
      try {
        localStorage.setItem(LS_KEY_TEMPLATE, val)
      } catch {}
    },
    [templateUrl],
  )

  const handleTokenInput = useCallback((val) => {
    setAccessToken(val)
    try {
      localStorage.setItem(LS_KEY_TOKEN, val)
    } catch {}
  }, [])

  const handleCustomRulesInput = useCallback((val) => {
    setCustomRules(val)
    try {
      localStorage.setItem(LS_KEY_RULES, val)
    } catch {}
  }, [])

  const toggleGroup = useCallback((name) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }, [])

  /* ── Build API URL ────────────────────────────────────────────── */
  const buildApiUrl = useCallback(
    (base) => {
      const links = proxyLinks
        .trim()
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
        .join('\n')
      if (!links) return null
      const params = new URLSearchParams()
      params.set('config', links)
      if (accessToken.trim()) params.set('token', accessToken.trim())
      const tpl = templateUrl.trim()
      if (tpl) params.set('template', tpl)
      if (
        selectedGroups !== null &&
        ruleGroups.length > 0 &&
        selectedGroups.size < ruleGroups.length
      )
        params.set('groups', JSON.stringify(Array.from(selectedGroups)))
      const customList = customRules
        .trim()
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
      if (customList.length > 0)
        params.set('customRules', JSON.stringify(customList))
      return `${base}/api/clash?${params.toString()}`
    },
    [
      proxyLinks,
      templateUrl,
      selectedGroups,
      ruleGroups,
      customRules,
      accessToken,
    ],
  )

  /* ── Generate ─────────────────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    if (generatingRef.current || groupsLoading || groupsError || authRequired)
      return
    const links = proxyLinks.trim()
    if (!links) {
      setError(t('generate.errorEmpty'))
      return
    }
    setError('')
    setLoading(true)
    generatingRef.current = true
    const requestRevision = configRevision({
      config: proxyLinks,
      template: templateUrl,
      customRules,
      groups:
        selectedGroups !== null &&
        ruleGroups.length > 0 &&
        selectedGroups.size < ruleGroups.length
          ? selectedGroups
          : null,
      token: accessToken,
    })
    try {
      const url = buildApiUrl(window.location.origin)
      if (!url) {
        setError(t('generate.errorEmpty'))
        setLoading(false)
        return
      }
      const body = { config: links }
      if (accessToken.trim()) body.token = accessToken.trim()
      if (templateUrl.trim()) body.template = templateUrl.trim()
      if (
        selectedGroups !== null &&
        ruleGroups.length > 0 &&
        selectedGroups.size < ruleGroups.length
      ) {
        body.groups = Array.from(selectedGroups)
      }
      const customList = customRules
        .trim()
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#'))
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
      setGeneratedRevision(requestRevision)
      setShowQr(false)
      setQrDataUrl('')
      setCopied('')
      setActiveTab('url')
      if (window.innerWidth < 960)
        setTimeout(
          () =>
            resultRef.current?.scrollIntoView({
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                .matches
                ? 'auto'
                : 'smooth',
              block: 'start',
            }),
          60,
        )
    } catch (e) {
      setError(e.message || t('generate.errorFailed'))
    } finally {
      setLoading(false)
      generatingRef.current = false
    }
  }, [
    proxyLinks,
    templateUrl,
    selectedGroups,
    ruleGroups,
    customRules,
    accessToken,
    buildApiUrl,
    groupsLoading,
    groupsError,
    authRequired,
    t,
  ])

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleGenerate()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleGenerate])

  useEffect(() => {
    if (error && window.innerWidth < 960) {
      document.getElementById('generation-error')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'center',
      })
    }
  }, [error])

  /* ── Clipboard / download ─────────────────────────────────────── */
  const copyToClipboard = useCallback(
    async (text, key) => {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        const el = document.createElement('textarea')
        el.value = text
        document.body.appendChild(el)
        el.select()
        const success = document.execCommand('copy')
        document.body.removeChild(el)
        if (!success) {
          setError(t('studio.clipboardFailed'))
          return
        }
      }
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    },
    [t],
  )

  const downloadYaml = useCallback(() => {
    if (!yamlPreview) return
    const blob = new Blob([yamlPreview], { type: 'application/x-yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clash.yaml'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Let the browser start reading the Blob before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [yamlPreview])

  const analysis = useMemo(() => analyzeInput(proxyLinks), [proxyLinks])
  const effectiveGroups =
    selectedGroups !== null &&
    ruleGroups.length > 0 &&
    selectedGroups.size < ruleGroups.length
      ? selectedGroups
      : null
  const revision = configRevision({
    config: proxyLinks,
    template: templateUrl,
    customRules,
    groups: effectiveGroups,
    token: accessToken,
  })
  const stale = !!yamlPreview && revision !== generatedRevision
  const generationDisabled =
    loading || groupsLoading || !!groupsError || authRequired
  const ruleCount = customRules
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#')).length
  const generateLabel = loading
    ? t('generate.loading')
    : stale
      ? t('studio.generateAgain')
      : t('generate.button')
  const generateButton = (
    <>
      <Icon
        name={loading ? 'refresh' : 'arrow'}
        size={18}
        className={loading ? 'spin' : ''}
      />
      <span>{generateLabel}</span>
      <kbd>{isMac ? '⌘' : 'Ctrl'} ↵</kbd>
    </>
  )

  return (
    <>
      <Head>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta name="robots" content="noindex, nofollow, noarchive" />
      </Head>
      <div className="studio-shell">
        <a className="skip-link" href="#workspace">
          {t('studio.skip')}
        </a>
        <header className="site-header">
          <div className="header-inner">
            <a className="brand" href="#">
              <span className="brand-symbol">
                <LogoMark />
              </span>
              <span>
                mihomo<span className="brand-sub">SUBCONVERTER</span>
              </span>
              <span className="version-tag">v{pkg.version}</span>
            </a>
            <nav className="header-nav" aria-label={t('studio.workspace')}>
              <a href="#workspace" className="active">
                {t('studio.workspace')}
              </a>
              <a
                href="#guide"
                onClick={() => {
                  const guide = document.getElementById('guide')
                  if (guide) guide.open = true
                }}
              >
                {t('studio.help')}
                <Icon name="external" size={12} />
              </a>
            </nav>
            <div className="header-actions">
              <ThemeToggle theme={theme} setTheme={setTheme} t={t} />
              <label className="language-select">
                <span className="sr-only">Language / 语言</span>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  {Object.entries(LOCALES).map(([key, { name }]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <a
                className="button icon-button github-link"
                href="https://github.com/ififi2017/mihomo-subconverter"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
              >
                <Icon name="github" size={19} />
              </a>
            </div>
          </div>
        </header>
        <main className="main-container">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">
                <span /> {t('studio.eyebrow')}
              </p>
              <h1>
                {t('studio.heroTitle')}
                <br />
                <span>{t('studio.heroAccent')}</span>
              </h1>
              <p className="hero-description">{t('studio.heroDescription')}</p>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbital-ring ring-one" />
              <div className="orbital-ring ring-two" />
              <div className="orbital-ring ring-three" />
              <div className="hero-emblem">
                <LogoMark />
              </div>
              <span className="orbital-point point-one" />
              <span className="orbital-point point-two" />
              <span className="orbit-label orbit-label-one">PROXY</span>
              <span className="orbit-label orbit-label-two">RULES</span>
              <span className="orbit-label orbit-label-three">CONFIG</span>
              <span className="hero-art-caption">
                {t('studio.heroTag')} <span>↗</span>
              </span>
            </div>
          </section>
          <div className="workspace-heading" id="workspace">
            <div>
              <span className="workspace-indicator" />
              {t('studio.workspaceLabel')}
            </div>
            <span>{t('studio.workspaceHint')}</span>
          </div>
          {authRequired && (
            <Card className="auth-panel">
              <div className="section-title">
                <Icon name="shield" />
                <h2>{t('auth.title')}</h2>
              </div>
              <div className="input-action">
                <label className="sr-only" htmlFor="access-token">
                  {t('auth.title')}
                </label>
                <input
                  id="access-token"
                  type="password"
                  className="text-input"
                  value={accessToken}
                  onChange={(e) => handleTokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fetchGroups(templateUrl)
                  }}
                  placeholder={t('auth.placeholder')}
                />
                <button
                  className="button secondary"
                  onClick={() => fetchGroups(templateUrl)}
                >
                  {t('auth.confirm')}
                </button>
              </div>
              <p>{t('auth.hint')}</p>
            </Card>
          )}
          <div className="workspace-grid">
            <div className="editor-column">
              <ProxyInput
                value={proxyLinks}
                onChange={handleProxyInput}
                extractedFrom={extractedFrom}
                analysis={analysis}
                t={t}
              />
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
              <CustomRules
                value={customRules}
                onChange={handleCustomRulesInput}
                t={t}
              />
              <GuidePanel t={t} />
            </div>
            <aside className="output-column" aria-label={t('result.title')}>
              <div className="output-sticky">
                <section className="output-card">
                  <div className="output-intro">
                    <div className="output-kicker">
                      <Icon name="nodes" size={16} />
                      <span>CONFIGURATION STUDIO</span>
                      <span className="tiny-plus">+</span>
                    </div>
                    <h2>{t('studio.outputTitle')}</h2>
                    <p>{t('studio.outputSubtitle')}</p>
                  </div>
                  <div className="config-stats">
                    <div>
                      <strong>
                        {String(analysis.proxies.length).padStart(2, '0')}
                      </strong>
                      <span>{t('studio.nodes')}</span>
                    </div>
                    <div>
                      <strong>
                        {groupsLoading
                          ? '—'
                          : String(
                              selectedGroups?.size ?? ruleGroups.length,
                            ).padStart(2, '0')}
                      </strong>
                      <span>{t('studio.groups')}</span>
                    </div>
                    <div>
                      <strong>{String(ruleCount).padStart(2, '0')}</strong>
                      <span>{t('studio.customRules')}</span>
                    </div>
                  </div>
                  <div className="config-template">
                    <span>{t('studio.template')}</span>
                    <strong>
                      <span
                        className={`status-dot ${!groupsLoading && !groupsError ? 'ready' : ''}`}
                      />
                      {templateUrl ? t('studio.customShort') : 'MetaCubeX Full'}
                    </strong>
                  </div>
                  <div className="generate-area">
                    <button
                      className="button generate-button"
                      onClick={handleGenerate}
                      disabled={generationDisabled}
                    >
                      {generateButton}
                    </button>
                    <p>
                      {authRequired
                        ? t('studio.authNeeded')
                        : groupsLoading
                          ? t('studio.loadingTemplate')
                          : groupsError
                            ? t('studio.templateError')
                            : t('studio.generateHint')}
                    </p>
                  </div>
                  {error && (
                    <div
                      className="inline-error generation-error"
                      id="generation-error"
                      role="alert"
                    >
                      <Icon name="info" size={17} />
                      <span>{error}</span>
                    </div>
                  )}
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
                    onToggleQr={() => setShowQr((v) => !v)}
                    yamlPreRef={yamlPreRef}
                    resultRef={resultRef}
                    stale={stale}
                    loading={loading}
                    nodeCount={analysis.proxies.length}
                    t={t}
                  />
                </section>
                <div className="output-caption">
                  <span className="caption-line" />
                  {t('studio.builtWith')}
                  <span className="caption-line" />
                </div>
              </div>
            </aside>
          </div>
        </main>
        <footer className="site-footer">
          <div>
            <LogoMark />
            <span>Mihomo Subconverter</span>
            <span className="footer-divider">/</span>
            <span>{t('studio.footerNote')}</span>
          </div>
          <a
            href="https://github.com/ififi2017/mihomo-subconverter"
            target="_blank"
            rel="noopener noreferrer"
          >
            OPEN SOURCE
            <Icon name="external" size={12} />
          </a>
        </footer>
        <div className="mobile-action-bar">
          <div>
            <span>
              {analysis.proxies.length} {t('studio.nodes')}
            </span>
            <span>
              {stale
                ? t('studio.outdated')
                : yamlPreview
                  ? t('studio.ready')
                  : t('studio.standby')}
            </span>
          </div>
          <button
            className="button generate-button"
            disabled={generationDisabled}
            onClick={handleGenerate}
          >
            {generateButton}
          </button>
        </div>
        <UpdateNotification />
        <span className="sr-only" role="status">
          {copied ? t('result.copied') : ''}
        </span>
      </div>
    </>
  )
}
