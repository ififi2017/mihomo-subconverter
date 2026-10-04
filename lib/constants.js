/**
 * Shared constants for mihomo-subconverter.
 *
 * Keeping them in one place means the default template URL, supported protocol
 * list, and other configuration values never get out of sync across files.
 */

/** Default template as shown in the UI / README — jsDelivr-CF, reachable from mainland China. */
export const DEFAULT_TEMPLATE_URL =
  'https://testingcf.jsdelivr.net/gh/ififi2017/clash_rules@master/config/MetaCubeX_Full.ini'

/** Fetch order for the built-in template. Last resort is the bundled INI snapshot. */
export const DEFAULT_TEMPLATE_MIRRORS = [
  DEFAULT_TEMPLATE_URL,
  'https://cdn.jsdelivr.net/gh/ififi2017/clash_rules@master/config/MetaCubeX_Full.ini',
  'https://raw.githubusercontent.com/ififi2017/clash_rules/master/config/MetaCubeX_Full.ini',
]

export const JSDELIVR_GH_PREFIX = 'https://testingcf.jsdelivr.net/gh'

export const LS_KEY_PROXY_LINKS  = 'mihomo_proxy_links'
export const LS_KEY_TEMPLATE_URL = 'mihomo_template_url'
export const LS_KEY_ACCESS_TOKEN = 'mihomo_access_token'
export const LS_KEY_CUSTOM_RULES = 'mihomo_custom_rules'
export const LS_KEY_LOCALE       = 'mihomo_locale'
export const LS_KEY_THEME        = 'mihomo_theme'

export const UPDATE_DISMISSED_KEY = 'update_dismissed'

export const PROXY_PREFIXES = [
  'hysteria2://', 'hy2://', 'anytls://', 'vless://',
  'trojan://', 'vmess://', 'ss://', 'tuic://',
]

export const PROTOCOL_MAP = {
  'hysteria2://': 'hy2',
  'hy2://':       'hy2',
  'anytls://':    'anytls',
  'vless://':     'vless',
  'trojan://':    'trojan',
  'vmess://':     'vmess',
  'ss://':        'ss',
  'tuic://':      'tuic',
}

export const YAML_SECTIONS_FOR_JUMP = ['proxies', 'proxy-groups', 'rule-providers', 'rules']

export const DEFAULT_DNS_NAMESERVER = [
  'https://120.53.53.53/dns-query',
  'https://223.5.5.5/dns-query',
]

export const DEFAULT_DNS_PROXY_SERVER_NAMESERVER = [
  'https://120.53.53.53/dns-query',
  'https://223.5.5.5/dns-query',
]

export const DEFAULT_DNS_CN_POLICY = 'https://120.53.53.53/dns-query'
export const DEFAULT_DNS_NOT_CN    = 'https://dns.cloudflare.com/dns-query'

export const DEFAULT_GEO_URLS = {
  geoip:   'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat',
  geosite: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat',
  mmdb:    'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb',
  asn:     'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/GeoLite2-ASN.mmdb',
}

export const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour for update check
export const TEMPLATE_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes for INI templates
