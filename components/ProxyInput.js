import { useState } from 'react'
import { Card, CardHeader, StepBadge, Icon } from './UI'

export default function ProxyInput({
  value,
  onChange,
  extractedFrom,
  analysis,
  t,
}) {
  const [view, setView] = useState('source')
  const { proxies, invalidLines, breakdown } = analysis
  return (
    <Card className="node-panel" id="nodes">
      <CardHeader>
        <div className="section-title">
          <StepBadge n="1" />
          <div>
            <h2>{t('step1.title')}</h2>
            <p>{t('studio.nodeSubtitle')}</p>
          </div>
        </div>
        <span className="small-label">INPUT</span>
      </CardHeader>
      <div className="editor-tabs">
        <div className="segmented" aria-label={t('step1.title')}>
          <button
            aria-pressed={view === 'source'}
            onClick={() => setView('source')}
          >
            <Icon name="code" size={15} />
            {t('studio.source')}
          </button>
          <button
            aria-pressed={view === 'nodes'}
            onClick={() => setView('nodes')}
          >
            <Icon name="nodes" size={15} />
            {t('studio.nodeList')}
            <span className="count">{proxies.length}</span>
          </button>
        </div>
        <span className="editor-format">URI / YAML / BASE64</span>
      </div>
      {view === 'source' ? (
        <div className={`source-editor ${value ? 'has-content' : ''}`}>
          <div className="editor-gutter" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>{String(i + 1).padStart(2, '0')}</span>
            ))}
          </div>
          <textarea
            id="proxy-input"
            aria-label={t('step1.title')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('studio.inputPlaceholder')}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          {!value && (
            <div className="editor-watermark" aria-hidden="true">
              <Icon name="nodes" size={66} />
            </div>
          )}
        </div>
      ) : (
        <div className="node-list">
          {proxies.length ? (
            proxies.map((p, i) => (
              <div className="node-row" key={`${i}-${p.name}`}>
                <span className="node-index">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {p.server}:{p.port}
                  </span>
                </div>
                <span className="protocol-tag">{p.type}</span>
                <Icon name="check" size={14} />
              </div>
            ))
          ) : (
            <div className="list-empty">
              <Icon name="nodes" size={28} />
              <p>{t('studio.noNodes')}</p>
            </div>
          )}
        </div>
      )}
      <div className="editor-status" aria-live="polite">
        <span className={`status-dot ${proxies.length ? 'ready' : ''}`} />
        <span>
          {proxies.length
            ? t('step1.nodeCount', { count: proxies.length })
            : t('studio.awaitingInput')}
        </span>
        <div className="protocol-breakdown">
          {breakdown.map(([type, count]) => (
            <span key={type}>
              {type} <b>{count}</b>
            </span>
          ))}
        </div>
      </div>
      {extractedFrom && (
        <p className="inline-note success">
          <Icon name="check" size={14} />
          {t(
            extractedFrom === 'base64'
              ? 'step1.extractedBase64'
              : extractedFrom === 'yaml'
                ? 'step1.extractedYaml'
                : 'step1.extractedBadge',
          )}
        </p>
      )}
      {invalidLines.length > 0 && (
        <p className="inline-note warning" role="status">
          <Icon name="info" size={15} />
          {t('studio.invalidAt', {
            lines: invalidLines.slice(0, 8).join(', '),
          })}
          {invalidLines.length > 8 ? '…' : ''}
        </p>
      )}
      <div className="panel-footnote">
        <Icon name="shield" size={14} />
        <span>{t('studio.localParsing')}</span>
        <span className="protocol-total">7 {t('studio.protocols')}</span>
      </div>
    </Card>
  )
}
