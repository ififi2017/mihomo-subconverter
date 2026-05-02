# Mihomo Subscription Converter

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ififi2017/mihomo-subconverter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

A lightweight Mihomo / Clash Meta subscription converter. Paste your proxy node links, pick your rule groups, and get a ready-to-use configuration file — deployable to Vercel in one click.

> Rule sets are based on [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR). Protocol parsing patterns reference [sublink-worker](https://github.com/7Sageer/sublink-worker) by 7Sageer. Thanks to both projects.

---

## Features

- **Multi-protocol support** — Hysteria2, AnyTLS, VLESS, Trojan, VMess, Shadowsocks, TUIC
- **Subscription URL import** — Paste a subscription URL and nodes are extracted automatically
- **Visual rule selection** — 16 built-in rule groups, toggle on/off, sensible defaults pre-selected
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
2. **Select rule groups** — Check the services you need; common ones are pre-selected
3. **Custom rules** *(optional)* — Add rules that take priority over all built-in ones
4. **Generate** — Click **Generate Config** or press `Ctrl / ⌘ + Enter`
5. **Use it** — Copy the subscription link into your client's remote profile URL field

---

## API

```
GET /api/clash?config=<encoded_links>[&rules=<rule_ids>][&customRules=<json_array>]
```

| Parameter | Description |
|-----------|-------------|
| `config` | URL-encoded proxy links, separated by newlines or `\|` |
| `rules` | Comma-separated rule group IDs (optional, defaults to all) |
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
