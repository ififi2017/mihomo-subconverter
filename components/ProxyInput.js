import { Card, CardHeader, StepBadge, inputCls } from './UI'
import { parseProxyLinks } from '../lib/parser'
import { PROXY_PREFIXES } from '../lib/constants'

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

function ProtoBadge({ proto, count }) {
  const [bg, color, border] = PROTO_COLORS[proto] || ['rgba(100,100,100,.1)', '#6b7280', 'rgba(100,100,100,.2)']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 7px', borderRadius: 9999,
      fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap',
      background: bg, color, border: `1px solid ${border}`, letterSpacing: .01,
    }}>
      {PROTO_LABELS[proto] ?? proto}<span style={{ opacity: .55, marginLeft: 1 }}>×{count}</span>
    </span>
  )
}

function analyzeProxies(proxyLinks) {
  const parsed = parseProxyLinks(proxyLinks)
  const counts = {}
  for (const p of parsed) {
    const k = p.type === 'hysteria2' ? 'hy2' : p.type
    counts[k] = (counts[k] || 0) + 1
  }
  let invalid = 0
  const looksStructured = /^proxies:\s*$/m.test(proxyLinks)
  if (!looksStructured) {
    for (const line of proxyLinks.split('\n')) {
      const l = line.trim()
      if (!l || l.startsWith('#')) continue
      const proto = PROXY_PREFIXES.some(pfx => l.startsWith(pfx))
      if (!proto) invalid++
    }
  }
  return {
    total: parsed.length,
    breakdown: Object.entries(counts),
    invalid,
  }
}

export default function ProxyInput({ value, onChange, extractedFrom, t }) {
  const { total, breakdown, invalid } = analyzeProxies(value)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-[9px] shrink-0">
          <StepBadge n="1"/>
          <span className="text-[13.5px] font-medium text-gray-900 dark:text-white whitespace-nowrap">
            {t('step1.title')}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-[7px] min-w-0">
          {extractedFrom && (
            <span className="inline-flex items-center gap-1 px-[9px] py-[2px] rounded-full whitespace-nowrap
              text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400
              border border-emerald-500/20">
              <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
              {t(
                extractedFrom === 'base64' ? 'step1.extractedBase64'
                : extractedFrom === 'yaml' ? 'step1.extractedYaml'
                : 'step1.extractedBadge',
              )}
            </span>
          )}
          {invalid > 0 && (
            <span className="inline-flex items-center gap-1 px-[9px] py-[2px] rounded-full whitespace-nowrap
              text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400
              border border-amber-500/20">
              <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              {t('step1.invalidLines', { count: invalid })}
            </span>
          )}
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-[5px]">
              <span className="text-[11.5px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {t('step1.nodeCount', { count: total })}
              </span>
              <span className="text-gray-300 dark:text-gray-700 text-sm">·</span>
              <div className="flex flex-wrap justify-end gap-[3px]">
                {breakdown.map(([p,c]) => <ProtoBadge key={p} proto={p} count={c}/>)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <div className="p-[18px]">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
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
  )
}