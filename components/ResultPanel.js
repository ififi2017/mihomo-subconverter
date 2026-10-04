import { useMemo } from 'react'
import { Icon, SignalGraphic } from './UI'
import { YAML_SECTIONS_FOR_JUMP } from '../lib/constants'

/* ── Lightweight YAML syntax highlighting for the preview pane ────── */
const YAML_SECTIONS = YAML_SECTIONS_FOR_JUMP

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightYamlValue(raw) {
  const v = raw.trim()
  if (!v) return escapeHtml(raw)
  const pad = raw.slice(0, raw.length - raw.trimStart().length)
  let color = null
  if (v.startsWith("'") || v.startsWith('"')) color = '#a5d6ff'
  else if (/^(true|false)$/.test(v)) color = '#ff7b72'
  else if (/^-?[\d.]+$/.test(v)) color = '#ffa657'
  else if (/^https?:\/\//.test(v)) color = '#a5d6ff'
  return color
    ? `${pad}<span style="color:${color}">${escapeHtml(v)}</span>`
    : escapeHtml(raw)
}

function highlightYamlLine(line) {
  if (/^\s*#/.test(line))
    return `<span style="color:#8b949e">${escapeHtml(line)}</span>`

  const section = line.match(/^([\w-]+):\s*$/)
  if (section && YAML_SECTIONS.includes(section[1])) {
    return `<span id="yaml-sec-${section[1]}" style="color:#79c0ff;font-weight:600">${escapeHtml(line)}</span>`
  }

  const kv = line.match(/^(\s*(?:- )?)([\w-]+)(:)(.*)$/)
  if (kv) {
    const [, lead, key, colon, rest] = kv
    return `${escapeHtml(lead)}<span style="color:#79c0ff">${escapeHtml(key)}</span>${colon}${highlightYamlValue(rest)}`
  }

  const li = line.match(/^(\s*- )(.*)$/)
  if (li) return `${li[1]}${highlightYamlValue(li[2])}`

  return escapeHtml(line)
}

export default function ResultPanel({
  subUrl,
  yamlPreview,
  activeTab,
  onTabChange,
  copied,
  onCopy,
  onDownload,
  showQr,
  qrDataUrl,
  qrError,
  onToggleQr,
  yamlPreRef,
  resultRef,
  stale,
  loading,
  nodeCount,
  t,
}) {
  const highlightedYaml = useMemo(
    () => yamlPreview?.split('\n').map(highlightYamlLine).join('\n'),
    [yamlPreview],
  )
  const hasResult = !!yamlPreview
  const locked = stale || loading
  const jumpToYamlSection = (sec) => {
    const pre = yamlPreRef?.current
    const el = pre?.querySelector(`#yaml-sec-${sec}`)
    if (pre && el) pre.scrollTop = Math.max(0, el.offsetTop - 8)
  }
  return (
    <div
      ref={resultRef}
      className="result-panel"
      id="result"
      aria-busy={loading}
    >
      <div className="result-heading">
        <span className="small-label">OUTPUT / MIHOMO</span>
        <span
          className={`result-state ${stale ? 'warning' : hasResult ? 'success' : ''}`}
        >
          <span
            className={`status-dot ${hasResult && !stale ? 'ready' : ''}`}
          />
          {loading
            ? t('generate.loading')
            : stale
              ? t('studio.outdated')
              : hasResult
                ? t('studio.ready')
                : t('studio.standby')}
        </span>
      </div>
      {!hasResult ? (
        <div className="result-empty">
          <SignalGraphic active={nodeCount > 0} loading={loading} />
          <h3>{loading ? t('studio.building') : t('studio.emptyTitle')}</h3>
          <p>{loading ? t('studio.buildingHint') : t('studio.emptyHint')}</p>
          <div className="pipeline">
            <span className={nodeCount ? 'complete' : ''}>
              01 {t('studio.pipelineInput')}
            </span>
            <i />
            <span>02 {t('studio.pipelineRules')}</span>
            <i />
            <span>03 {t('studio.pipelineOutput')}</span>
          </div>
        </div>
      ) : (
        <div className="result-content animate-in">
          {stale && (
            <p className="stale-notice" role="status">
              <Icon name="refresh" size={15} />
              {t('studio.staleHint')}
            </p>
          )}
          <div className="result-tabs">
            <button
              onClick={() => onTabChange('url')}
              aria-pressed={activeTab === 'url'}
            >
              <Icon name="nodes" size={15} />
              {t('result.tabUrl')}
            </button>
            <button
              onClick={() => onTabChange('yaml')}
              aria-pressed={activeTab === 'yaml'}
            >
              <Icon name="code" size={15} />
              {t('result.tabYaml')}
            </button>
          </div>
          {activeTab === 'url' ? (
            <div className="subscription-result">
              <div className="result-success-icon">
                <Icon name={stale ? 'refresh' : 'check'} size={26} />
              </div>
              <h3>{stale ? t('studio.outdated') : t('studio.resultTitle')}</h3>
              <p>{t('result.urlDescription')}</p>
              <div className="subscription-url" title={t('result.tabUrl')}>
                {subUrl}
              </div>
              <button
                className="button copy-primary"
                disabled={locked}
                onClick={() => onCopy(subUrl, 'url')}
              >
                <Icon name={copied === 'url' ? 'check' : 'copy'} size={17} />
                {copied === 'url'
                  ? t('result.copied')
                  : t('studio.copySubscription')}
              </button>
              <div className="result-actions">
                <button
                  className="button secondary"
                  disabled={locked}
                  onClick={onDownload}
                >
                  <Icon name="download" size={15} />
                  {t('studio.download')}
                </button>
                <button
                  className="button secondary"
                  aria-expanded={showQr && !locked}
                  disabled={locked}
                  onClick={onToggleQr}
                >
                  <Icon name="qr" size={15} />
                  {t('result.qr')}
                </button>
              </div>
              {showQr && !locked && (
                <div className="qr-area">
                  {qrError ? (
                    <p className="warning">{t('result.qrTooLong')}</p>
                  ) : qrDataUrl ? (
                    <>
                      <img
                        src={qrDataUrl}
                        alt={t('result.qr')}
                        width={220}
                        height={220}
                      />
                      <p>{t('result.qrHint')}</p>
                    </>
                  ) : (
                    <span className="spinner" />
                  )}
                </div>
              )}
              <p className="security-note">
                <Icon name="shield" size={14} />
                {t('result.urlSecurityNote')}
              </p>
              {subUrl.length > 8000 && (
                <p className="warning result-warning">
                  {t('result.urlTooLong', { count: subUrl.length })}
                </p>
              )}
            </div>
          ) : (
            <div className="yaml-result">
              <div className="yaml-toolbar">
                <span>
                  {t('result.yamlLines', {
                    count: yamlPreview.split('\n').length,
                  })}
                </span>
                <button
                  className="button icon-button"
                  aria-label={t('result.copy')}
                  title={t('result.copy')}
                  disabled={locked}
                  onClick={() => onCopy(yamlPreview, 'yaml')}
                >
                  <Icon name={copied === 'yaml' ? 'check' : 'copy'} size={15} />
                </button>
                <button
                  className="button icon-button"
                  aria-label={t('result.download')}
                  title={t('result.download')}
                  disabled={locked}
                  onClick={onDownload}
                >
                  <Icon name="download" size={15} />
                </button>
              </div>
              <div className="yaml-jumps">
                {YAML_SECTIONS.filter((sec) =>
                  yamlPreview.includes(`${sec}:`),
                ).map((sec) => (
                  <button key={sec} onClick={() => jumpToYamlSection(sec)}>
                    {sec}
                  </button>
                ))}
              </div>
              <pre
                ref={yamlPreRef}
                tabIndex={0}
                aria-label={t('result.tabYaml')}
                dangerouslySetInnerHTML={{ __html: highlightedYaml }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
