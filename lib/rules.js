const ACL = 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash'
const CUSTOM = 'https://raw.githubusercontent.com/ififi2017/clash_rules/master/rules'

function rp(name, url) {
  return { name, url, behavior: 'classical', format: 'text', interval: 86400 }
}

// ── 核心规则（不可关闭，按 INI 顺序分三段插入）─────────────────────────
// 段1: 最前面的直连规则
export const CORE_BEFORE = [
  rp('LocalAreaNetwork',  `${ACL}/LocalAreaNetwork.list`),
  rp('UnBan',             `${ACL}/UnBan.list`),
  rp('Fix_Steam_CN_CDN',  `${CUSTOM}/Fix_Steam_CN_CDN.list`),
]

// 段2: 广告/FCM 之后、微软之前的直连规则
export const CORE_MID = [
  rp('GoogleCN',  `${ACL}/GoogleCN.list`),
  rp('SteamCN',   `${ACL}/Ruleset/SteamCN.list`),
]

// 段3: ProxyGFW 之后的直连规则（中国规则）
export const CORE_AFTER = [
  rp('zerotier',       `${CUSTOM}/zerotier.list`),
  rp('ChinaDomain',    `${ACL}/ChinaDomain.list`),
  rp('ChinaCompanyIp', `${ACL}/ChinaCompanyIp.list`),
  rp('Download',       `${ACL}/Download.list`),
]

// GFW 代理规则（在 CORE_AFTER 之前）
export const CORE_PROXY = [
  rp('ProxyGFWlist', `${ACL}/ProxyGFWlist.list`),
]

// ── 可选规则组（对应 UI 复选框，顺序与 INI ruleset 段一致）────────────────
// type 决定该组代理策略组的默认优先顺序
//   proxy-first  → 节点优先（流媒体/代理服务）
//   direct-first → 直连优先（微软/苹果/游戏）
//   reject-first → 拦截优先（广告）
//   bilibili     → 直连 > HK（B站）
//   cn-media     → 直连 > HK > 手动（国内媒体）
//   bahamut      → 节点 > 手动 > 直连（巴哈姆特，台湾专线）

export const RULE_GROUPS = [
  {
    id: 'BanAD',
    label: '🛑 广告拦截',
    description: '广告拦截 + 应用净化',
    default: true,
    entries: [
      { provider: rp('BanAD',       `${ACL}/BanAD.list`),       target: '🛑 广告拦截', type: 'reject-first' },
      { provider: rp('BanProgramAD',`${ACL}/BanProgramAD.list`),target: '🍃 应用净化', type: 'reject-first' },
    ],
  },
  {
    id: 'GoogleFCM',
    label: '📢 谷歌FCM',
    description: 'Google Firebase 推送',
    default: true,
    entries: [
      { provider: rp('GoogleFCM', `${ACL}/Ruleset/GoogleFCM.list`), target: '📢 谷歌FCM', type: 'direct-first' },
    ],
  },
  // ── CORE_MID 在这里插入（代码层面处理，非规则组）──
  {
    id: 'Microsoft',
    label: 'Ⓜ️ 微软服务',
    description: 'OneDrive + Microsoft 全系列',
    default: true,
    entries: [
      { provider: rp('OneDrive',  `${ACL}/OneDrive.list`),  target: 'Ⓜ️ 微软云盘', type: 'direct-first' },
      { provider: rp('Microsoft', `${ACL}/Microsoft.list`), target: 'Ⓜ️ 微软服务', type: 'direct-first' },
    ],
  },
  {
    id: 'Apple',
    label: '🍎 苹果服务',
    description: 'Apple 全系列',
    default: true,
    entries: [
      { provider: rp('Apple', `${CUSTOM}/apple.list`), target: '🍎 苹果服务', type: 'direct-first' },
    ],
  },
  {
    id: 'Telegram',
    label: '📲 电报消息',
    description: 'Telegram',
    default: true,
    entries: [
      { provider: rp('Telegram', `${ACL}/Telegram.list`), target: '📲 电报消息', type: 'proxy-first' },
    ],
  },
  {
    id: 'OpenAI',
    label: '💬 OpenAI',
    description: 'ChatGPT / OpenAI',
    default: true,
    entries: [
      { provider: rp('OpenAI', `${CUSTOM}/OpenAI.list`), target: '💬 OpenAi', type: 'proxy-first' },
    ],
  },
  {
    id: 'NewBing',
    label: '🤖 NewBing',
    description: 'Microsoft Bing AI',
    default: true,
    entries: [
      { provider: rp('Bing', `${CUSTOM}/Bing.list`), target: '🤖 NewBing', type: 'proxy-first' },
    ],
  },
  {
    id: 'NetEaseMusic',
    label: '🎶 网易音乐',
    description: '网易云音乐',
    default: true,
    entries: [
      { provider: rp('NetEaseMusic', `${ACL}/Ruleset/NetEaseMusic.list`), target: '🎶 网易音乐', type: 'direct-first' },
    ],
  },
  {
    id: 'Gaming',
    label: '🎮 游戏平台',
    description: 'EA / Epic / Origin / Sony / Steam / Nintendo / FUT',
    default: true,
    entries: [
      { provider: rp('EA',       `${CUSTOM}/EA.list`),               target: '⚽ EA',      type: 'direct-first' },
      { provider: rp('Epic',     `${ACL}/Ruleset/Epic.list`),        target: '🎮 游戏平台', type: 'direct-first' },
      { provider: rp('Origin',   `${ACL}/Ruleset/Origin.list`),      target: '🎮 游戏平台', type: 'direct-first' },
      { provider: rp('Sony',     `${ACL}/Ruleset/Sony.list`),        target: '🎮 游戏平台', type: 'direct-first' },
      { provider: rp('Steam',    `${CUSTOM}/Steam.list`),            target: '🎮 游戏平台', type: 'direct-first' },
      { provider: rp('Nintendo', `${ACL}/Ruleset/Nintendo.list`),    target: '🎮 游戏平台', type: 'direct-first' },
      { provider: rp('FUT',      `${CUSTOM}/FUT.list`),              target: '🎮 游戏平台', type: 'direct-first' },
    ],
  },
  {
    id: 'TikTok',
    label: '🎵 TikTok',
    description: 'TikTok',
    default: true,
    entries: [
      { provider: rp('TikTok', `${CUSTOM}/TikTok.list`), target: '🎵 TikTok', type: 'proxy-first' },
    ],
  },
  {
    id: 'YouTube',
    label: '📹 油管视频',
    description: 'YouTube',
    default: true,
    entries: [
      { provider: rp('YouTube', `${ACL}/Ruleset/YouTube.list`), target: '📹 油管视频', type: 'proxy-first' },
    ],
  },
  {
    id: 'Netflix',
    label: '🎥 奈飞视频',
    description: 'Netflix',
    default: true,
    entries: [
      { provider: rp('Netflix', `${ACL}/Ruleset/Netflix.list`), target: '🎥 奈飞视频', type: 'proxy-first' },
    ],
  },
  {
    id: 'Bahamut',
    label: '📺 巴哈姆特',
    description: '巴哈姆特动画（台湾）',
    default: false,
    entries: [
      { provider: rp('Bahamut', `${ACL}/Ruleset/Bahamut.list`), target: '📺 巴哈姆特', type: 'bahamut' },
    ],
  },
  {
    id: 'Bilibili',
    label: '📺 哔哩哔哩',
    description: 'B站（含港澳台）',
    default: true,
    entries: [
      { provider: rp('BilibiliHMT', `${ACL}/Ruleset/BilibiliHMT.list`), target: '📺 哔哩哔哩', type: 'bilibili' },
      { provider: rp('Bilibili',    `${ACL}/Ruleset/Bilibili.list`),     target: '📺 哔哩哔哩', type: 'bilibili' },
    ],
  },
  {
    id: 'ChinaMedia',
    label: '🌏 国内媒体',
    description: '国内流媒体',
    default: true,
    entries: [
      { provider: rp('ChinaMedia', `${ACL}/ChinaMedia.list`), target: '🌏 国内媒体', type: 'cn-media' },
    ],
  },
  {
    id: 'ForeignMedia',
    label: '🌍 国外媒体',
    description: '海外流媒体（YouTube/Netflix 之外）',
    default: true,
    entries: [
      { provider: rp('ProxyMedia', `${ACL}/ProxyMedia.list`), target: '🌍 国外媒体', type: 'proxy-first' },
    ],
  },
]
