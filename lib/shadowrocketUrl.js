// Rules-only payload: proxy input and node credentials never enter this URL.
export function shadowrocketParams({ templateUrl, customRules, selectedGroups, accessToken }) {
  const params = new URLSearchParams()
  if (templateUrl.trim()) params.set('template', templateUrl.trim())
  const rules = customRules.split('\n').map(r => r.trim()).filter(r => r && !r.startsWith('#'))
  if (rules.length) params.set('customRules', JSON.stringify(rules))
  if (selectedGroups !== null) params.set('groups', JSON.stringify([...selectedGroups].sort()))
  if (accessToken.trim()) params.set('token', accessToken.trim())
  return params
}
