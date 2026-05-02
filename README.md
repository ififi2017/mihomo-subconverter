# Mihomo Subscription Converter

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ififi2017/mihomo-subconverter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

A lightweight Mihomo / Clash Meta subscription converter. Paste your proxy node links, choose a rule template, and get a ready-to-use configuration file — deployable to Vercel in one click.

> Rule sets are based on [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR). Protocol parsing patterns reference [sublink-worker](https://github.com/7Sageer/sublink-worker) by 7Sageer. Thanks to both projects.

---

## Features

- **Multi-protocol support** — Hysteria2, AnyTLS, VLESS, Trojan, VMess, Shadowsocks, TUIC
- **Subscription URL import** — Paste a subscription URL and nodes are extracted automatically
- **INI rule templates** — Use the built-in ACL4SSR Full template or point to any compatible `.ini` file
- **sub-web compatible** — Template URLs are compatible with [CareyWang/sub-web](https://github.com/CareyWang/sub-web) remote config links
- **Custom rules** — Append your own `DOMAIN-SUFFIX` / `IP-CIDR` rules with highest priority
- **Subscription link output** — Generates a URL you can paste directly into any Mihomo-compatible client
- **Custom domain aware** — Bind a custom domain in Vercel; generated links automatically use it
- **i18n** — UI available in English and Chinese; adding a new language takes two steps (see below)
- **Zero-config deploy** — No environment variables needed, just import and deploy

---

## Deploy to Vercel

### One-click deploy

Click the **Deploy with Vercel** button above. Fork the repo and deploy — no environment variables required.

### Custom domain

Add your domain under **Vercel project → Settings → Domains**. Once set up, any subscription link generated through your domain will automatically use it — no extra configuration needed.

### Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Usage

1. **Paste nodes** — Add proxy links one per line, or paste a subscription URL (nodes are extracted automatically)
2. **Rule template** *(optional)* — Leave empty to use the default ACL4SSR Full template, or paste a URL to your own `.ini` file
3. **Custom rules** *(optional)* — Add rules that take priority over all built-in ones
4. **Generate** — Click **Generate Config** or press `Ctrl / ⌘ + Enter`
5. **Use it** — Copy the subscription link into your client's remote profile URL field

---

## Rule Templates

The converter uses an ACL4SSR-style INI file to define proxy groups and rule sets.

**Default template** (used when the Custom Template URL field is left empty):

```
https://raw.githubusercontent.com/ififi2017/clash_rules/master/config/ACL4SSR_Online_Full.ini
```

Open the link above to see a working example of the expected format — it's a good starting point for writing your own template.

### Using a custom template

1. Copy the default template above as a starting point
2. Edit the `custom_proxy_group` and `ruleset` lines to suit your needs
3. Host the file on GitHub (raw URL), any CDN, or a static file server
4. Paste the URL into the **Custom Template URL** field in the UI

**sub-web compatibility:** The template format follows the ACL4SSR / sub-web INI convention — any remote config URL that works in [CareyWang/sub-web](https://sub-web.pages.dev/) ([GitHub](https://github.com/CareyWang/sub-web)) under "远程配置" will also work here without modification.

### Template format reference

```ini
; Lines starting with ; or # are comments

; Proxy groups — backtick-separated fields
custom_proxy_group=🚀 Node Select`select`[]♻️ Auto Select`[]DIRECT
custom_proxy_group=♻️ Auto Select`url-test`.*`http://www.gstatic.com/generate_204`300,,50
custom_proxy_group=🇭🇰 HK Nodes`url-test`(HK|Hong Kong|港)`http://www.gstatic.com/generate_204`300,,50

; Rule sets — GROUP,URL  or  GROUP,[]INLINE_RULE
ruleset=🛑 AdBlock,https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/BanAD.list
ruleset=🎯 Direct,[]GEOIP,CN
ruleset=🐟 Catch-all,[]FINAL
```

**Proxy group types:**

| Type | Fields after type |
|------|-------------------|
| `select` | `[]GroupName` or `[]DIRECT` / `[]REJECT` (one per backtick field) |
| `url-test` | `filter-regex` · `health-check-url` · `interval,,tolerance` |
| `fallback` | same as `url-test` |
| `load-balance` | same as `url-test` |

**Special inline rules:**

| INI value | Clash output |
|-----------|-------------|
| `[]FINAL` | `MATCH,<group>` |
| `[]GEOIP,CN` | `GEOIP,CN,<group>,no-resolve` |
| `[]IP-CIDR,x.x.x.x/y` | `IP-CIDR,x.x.x.x/y,<group>` |

---

## API

```
GET /api/clash?config=<encoded_links>[&template=<encoded_url>][&customRules=<json_array>]
```

| Parameter | Description |
|-----------|-------------|
| `config` | URL-encoded proxy links, separated by newlines or `\|` |
| `template` | URL-encoded `.ini` template URL (optional, defaults to ACL4SSR Full) |
| `customRules` | JSON array of custom rule strings (optional) |

**Example:**

```bash
curl "https://your-domain.vercel.app/api/clash?config=hysteria2%3A%2F%2Fpwd%40host%3A443%3Fpeer%3Dsni%23MyNode"
```

---

## Adding a New Language

Translations live in the `locales/` directory as plain JSON files. Adding a new language requires two steps:

**1. Create the translation file**

Copy `locales/en.json` to `locales/<lang>.json` (use a [BCP 47](https://en.wikipedia.org/wiki/IETF_language_tag) language code, e.g. `ja`, `ko`, `fr`) and translate the values.

**2. Register the language**

In `lib/i18n.js`, add two lines:

```js
import ja from '../locales/ja.json'          // 1. import the file

export const LOCALES = {
  en: { name: 'English', messages: en },
  zh: { name: '中文',    messages: zh },
  ja: { name: '日本語',  messages: ja },     // 2. register it here
}
```

That's it — the language switcher in the header will pick it up automatically. PRs are welcome!

---

## License

MIT
