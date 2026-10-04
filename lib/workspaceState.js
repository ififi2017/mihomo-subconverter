import { parseProxyLinks } from './parser'

export function analyzeInput(value) {
  const proxies = parseProxyLinks(value)
  const counts = {}
  for (const proxy of proxies)
    counts[proxy.type] = (counts[proxy.type] || 0) + 1
  // YAML is a document, not a URI per line. Only report line numbers for URI input.
  const structured = /^proxies:\s*$/m.test(value)
  const invalidLines = structured
    ? []
    : value.split('\n').flatMap((line, index) => {
        const text = line.trim()
        return !text || text.startsWith('#') || parseProxyLinks(text).length
          ? []
          : [index + 1]
      })
  return { proxies, breakdown: Object.entries(counts), invalidLines }
}

// Match the actual API payload so the preview can never silently represent older input.
export function configRevision({
  config,
  template,
  customRules,
  groups,
  token,
}) {
  return JSON.stringify({
    config: config.trim(),
    template: template.trim(),
    token: token.trim(),
    customRules: customRules
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
    groups: groups === null ? null : [...groups].sort(),
  })
}
