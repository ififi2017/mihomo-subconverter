# Mihomo Subscription Converter

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ififi2017/mihomo-subconverter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)

A lightweight Mihomo / Clash Meta subscription converter. Paste your proxy node links, pick your rule groups, and get a ready-to-use configuration file — deployable to Vercel in one click.

> Rule sets are based on [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR). Thanks to for his work.

---

## Features

- **Multi-protocol support** — Hysteria2, AnyTLS, VLESS, Trojan, VMess, Shadowsocks
- **Subscription URL import** — Paste a subscription URL and nodes are extracted automatically
- **Visual rule selection** — 16 built-in rule groups, toggle on/off, sensible defaults pre-selected
- **Custom rules** — Append your own `DOMAIN-SUFFIX` / `IP-CIDR` rules with highest priority
- **Subscription link output** — Generates a URL you can paste directly into any Mihomo-compatible client
- **Custom domain aware** — Bind a custom domain in Vercel; generated links automatically use it
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

## License

MIT
