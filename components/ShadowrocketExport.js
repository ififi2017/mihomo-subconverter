import { useRef, useState } from 'react'
import { shadowrocketParams } from '../lib/shadowrocketUrl'
import { Icon } from './UI'

export default function ShadowrocketExport({
  templateUrl, customRules, selectedGroups, accessToken, disabled, onCopy, copied, t,
}) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const generating = useRef(false)
  const params = shadowrocketParams({ templateUrl, customRules, selectedGroups, accessToken }).toString()
  const stale = result && result.params !== params
  const locked = disabled || loading || stale

  async function generate() {
    if (disabled || generating.current) return
    generating.current = true
    setLoading(true)
    setError('')
    const path = `/api/shadowrocket${params ? `?${params}` : ''}`
    try {
      const response = await fetch('/api/shadowrocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new URLSearchParams(params))),
      })
      if (!response.ok) throw new Error(await response.text())
      // Finish reading the validated configuration before exposing its URL.
      await response.text()
      setResult({ url: window.location.origin + path, params })
    } catch (e) {
      setError(e.message || t('generate.errorFailed'))
    } finally {
      generating.current = false
      setLoading(false)
    }
  }

  return (
    <section className="shadowrocket-export" aria-labelledby="shadowrocket-title" aria-busy={loading}>
      <h3 id="shadowrocket-title">{t('shadowrocket.title')}</h3>
      <p>{t('shadowrocket.description')}</p>
      <button className="button secondary" disabled={disabled || loading} onClick={generate}>
        <Icon name={loading ? 'refresh' : 'arrow'} size={15} />
        {loading ? t('generate.loading') : t('shadowrocket.generate')}
      </button>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {result && (
        <div className="animate-in">
          {stale && <p className="stale-notice" role="status">{t('shadowrocket.stale')}</p>}
          <div className="subscription-url" title={t('shadowrocket.title')}>{result.url}</div>
          <button
            className="button copy-primary"
            disabled={locked}
            onClick={() => onCopy(result.url, 'shadowrocket')}
          >
            <Icon name={copied === 'shadowrocket' ? 'check' : 'copy'} size={15} />
            {copied === 'shadowrocket' ? t('result.copied') : t('shadowrocket.copy')}
          </button>
          <p>{t('shadowrocket.usage')}</p>
          {result.url.length > 8000 && <p className="warning">{t('result.urlTooLong', { count: result.url.length })}</p>}
        </div>
      )}
    </section>
  )
}
