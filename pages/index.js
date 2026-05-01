import { useState, useCallback, useEffect } from 'react'
import Head from 'next/head'
import { RULE_GROUPS } from '../lib/rules'

const DEFAULT_RULES = RULE_GROUPS.filter(g => g.default).map(g => g.id)

const EXAMPLE_LINKS = `# 粘贴你的节点链接，每行一个，支持以下格式：
# hysteria2://password@host:port?peer=sni&insecure=1#节点名称
# anytls://password@host:port?peer=sni&insecure=1#节点名称
# vless://uuid@host:port?security=reality&pbk=xxx&sni=xxx&fp=chrome&sid=xxx#节点名称
# trojan://password@host:port?sni=xxx#节点名称
# vmess://base64...
# ss://method:password@host:port#节点名称`

export default function Home() {
  const [proxyLinks, setProxyLinks] = useState('')
  const [selectedRules, setSelectedRules] = useState(new Set(DEFAULT_RULES))
  const [customRules, setCustomRules] = useState('')
  const [subUrl, setSubUrl] = useState('')
  const [yamlPreview, setYamlPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [activeTab, setActiveTab] = useState('url')
  const [extractedFrom, setExtractedFrom] = useState('')  // URL that nodes were extracted from

  const PROXY_PREFIXES = ['hysteria2://', 'hy2://', 'anytls://', 'vless://', 'trojan://', 'vmess://', 'ss://']

  const handleProxyInput = useCallback((raw) => {
    const trimmed = raw.trim()
    // 单行 http(s):// 链接 → 尝试从 config 参数提取节点
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
            setProxyLinks(lines.join('\n'))
            setExtractedFrom(trimmed)
            setError('')
            return
          }
        }
      } catch { /* 不是合法 URL，当普通文本处理 */ }
    }
    // 普通文本
    setProxyLinks(raw)
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
    if (selectedRules.size > 0) {
      params.set('rules', Array.from(selectedRules).join(','))
    }

    const customList = customRules.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
    if (customList.length > 0) {
      params.set('customRules', JSON.stringify(customList))
    }

    return `${base}/api/clash?${params.toString()}`
  }, [proxyLinks, selectedRules, customRules])

  const handleGenerate = useCallback(async () => {
    const links = proxyLinks.trim().split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#'))
      .join('\n')

    if (!links) {
      setError('请输入至少一条节点链接')
      return
    }

    setError('')
    setLoading(true)

    try {
      const origin = window.location.origin
      const url = buildApiUrl(origin)
      if (!url) {
        setError('请输入节点链接')
        setLoading(false)
        return
      }

      setSubUrl(url)

      // Fetch preview
      const res = await fetch(url)
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text)
      }
      const yaml = await res.text()
      setYamlPreview(yaml)
      setActiveTab('url')
    } catch (e) {
      setError(e.message || '生成失败，请检查节点链接格式')
    } finally {
      setLoading(false)
    }
  }, [proxyLinks, selectedRules, customRules, buildApiUrl])

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
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    }
  }, [])

  const downloadYaml = useCallback(() => {
    if (!yamlPreview) return
    const blob = new Blob([yamlPreview], { type: 'application/x-yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clash.yaml'
    a.click()
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
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      for (const [prefix, proto] of Object.entries(PROTO_MAP)) {
        if (t.startsWith(prefix)) {
          counts[proto] = (counts[proto] || 0) + 1
          break
        }
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    const detail = Object.entries(counts).map(([p, n]) => `${p}×${n}`).join(' ')
    return { total, detail }
  }

  return (
    <>
      <Head>
        <title>Mihomo 订阅转换</title>
        <meta name="description" content="Clash / Mihomo 订阅链接转换工具，支持 Hysteria2、AnyTLS、VLESS Reality 等协议" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">M</div>
              <div>
                <h1 className="text-lg font-semibold text-white">Mihomo 订阅转换</h1>
                <p className="text-xs text-gray-400">Clash Meta 配置生成器</p>
              </div>
            </div>
            <a
              href="https://github.com/ACL4SSR/ACL4SSR"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              感谢 ACL4SSR 提供规则集
            </a>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

          {/* Step 1: Proxy Links */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-xs flex items-center justify-center font-bold">1</span>
                <h2 className="font-medium text-white">输入节点链接</h2>
              </div>
              <div className="flex items-center gap-2">
                {extractedFrom && (
                  <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    已从订阅链接提取
                  </span>
                )}
                {analyzeProxies().total > 0 && (
                  <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full" title={analyzeProxies().detail}>
                    {analyzeProxies().total} 条节点 · {analyzeProxies().detail}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={proxyLinks}
                onChange={e => handleProxyInput(e.target.value)}
                placeholder={EXAMPLE_LINKS}
                rows={8}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y scrollbar-thin"
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-gray-500">
                支持协议：<code className="text-blue-400">hysteria2</code>、<code className="text-blue-400">anytls</code>、<code className="text-blue-400">vless</code>、<code className="text-blue-400">trojan</code>、<code className="text-blue-400">vmess</code>、<code className="text-blue-400">ss</code>
              </p>
            </div>
          </section>

          {/* Step 2: Rule Groups */}
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-xs flex items-center justify-center font-bold">2</span>
                <h2 className="font-medium text-white">选择规则组</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRules(new Set(RULE_GROUPS.map(g => g.id)))}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  全选
                </button>
                <span className="text-gray-700">·</span>
                <button
                  onClick={() => setSelectedRules(new Set())}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  清空
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
                    <div className="text-sm font-medium truncate">{group.label}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{group.description}</div>
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
                <div>
                  <h2 className="font-medium text-white">自定义规则 <span className="text-xs text-gray-500 font-normal ml-1">（可选）</span></h2>
                </div>
              </div>
            </div>
            <div className="p-4">
              <textarea
                value={customRules}
                onChange={e => setCustomRules(e.target.value)}
                placeholder={`# 自定义规则，每行一条，优先于内置规则生效\n# 例如：\nDOMAIN-SUFFIX,example.com,🔰 节点选择\nIP-CIDR,1.2.3.4/32,DIRECT`}
                rows={4}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-y scrollbar-thin"
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
                  生成中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                  </svg>
                  生成订阅配置
                  <kbd className="ml-1 text-[10px] opacity-50 font-mono border border-current rounded px-1">⌘↵</kbd>
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-5 py-4 text-red-400 text-sm">
              <strong>错误：</strong>{error}
            </div>
          )}

          {/* Result */}
          {(subUrl || yamlPreview) && (
            <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="font-medium text-white">生成结果</h2>
                <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setActiveTab('url')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      activeTab === 'url' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    订阅链接
                  </button>
                  <button
                    onClick={() => setActiveTab('yaml')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      activeTab === 'yaml' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    配置预览
                  </button>
                </div>
              </div>

              {activeTab === 'url' && subUrl && (
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-2">将以下链接填入 Clash / Mihomo 客户端的订阅地址栏：</p>
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
                            已复制
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                            复制
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-xs text-gray-400 space-y-2">
                    <p className="font-medium text-gray-300 text-sm">使用说明</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>将订阅链接填入 <strong className="text-gray-200">Clash for Windows / Mihomo Party / Stash</strong> 等客户端</li>
                      <li>订阅链接会动态生成最新配置，节点更新后重新生成链接即可</li>
                      <li>规则组使用 <strong className="text-gray-200">ACL4SSR</strong> 规则，客户端首次加载时会自动下载</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'yaml' && yamlPreview && (
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">{yamlPreview.split('\n').length} 行配置</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(yamlPreview, 'yaml')}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs transition-colors flex items-center gap-1"
                      >
                        {copied === 'yaml' ? '✓ 已复制' : '复制'}
                      </button>
                      <button
                        onClick={downloadYaml}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs transition-colors flex items-center gap-1"
                      >
                        下载 clash.yaml
                      </button>
                    </div>
                  </div>
                  <pre className="bg-gray-950 border border-gray-700 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-auto max-h-96 scrollbar-thin">
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
              <h2 className="font-medium text-gray-300 text-sm">节点链接格式参考</h2>
              <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div id="protocol-ref" className="hidden border-t border-gray-800 p-4 space-y-4">
              {[
                {
                  name: 'Hysteria2',
                  example: 'hysteria2://password@host:port?peer=sni&insecure=1#节点名称',
                  fields: 'peer/sni: SNI域名, insecure: 跳过证书验证',
                },
                {
                  name: 'AnyTLS',
                  example: 'anytls://password@host:port?peer=sni&insecure=1&fastopen=1&udp=1#节点名称',
                  fields: 'peer/sni: SNI域名, fastopen: TCP快速打开, fp: 指纹',
                },
                {
                  name: 'VLESS Reality',
                  example: 'vless://uuid@host:port?security=reality&pbk=publickey&sni=sni&fp=chrome&sid=shortid&type=tcp&flow=xtls-rprx-vision#节点名称',
                  fields: 'pbk: 公钥, sid: shortId, sni: SNI, fp: 指纹',
                },
                {
                  name: 'Trojan',
                  example: 'trojan://password@host:port?sni=xxx#节点名称',
                  fields: 'sni: SNI域名, insecure: 跳过证书验证',
                },
              ].map(p => (
                <div key={p.name} className="space-y-1.5">
                  <div className="text-sm font-medium text-blue-400">{p.name}</div>
                  <code className="block text-xs font-mono bg-gray-950 border border-gray-700 rounded px-3 py-2 text-gray-300 break-all">
                    {p.example}
                  </code>
                  <p className="text-xs text-gray-500">{p.fields}</p>
                </div>
              ))}
            </div>
          </section>

        </main>

        <footer className="border-t border-gray-800 mt-12 py-6">
          <div className="max-w-5xl mx-auto px-4 text-center text-xs text-gray-600">
            Mihomo Subconverter · 仅供个人使用 · 请遵守当地法律法规
          </div>
        </footer>
      </div>
    </>
  )
}
