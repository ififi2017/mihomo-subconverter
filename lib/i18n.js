import { createContext, useContext, useState, useEffect } from 'react'
import en from '../locales/en.json'
import zh from '../locales/zh.json'

// ── 添加新语言说明 ────────────────────────────────────────────────────────────
// 1. 在 /locales/ 目录下新建 <lang>.json（参考 en.json 的结构）
// 2. 在下方 import 该文件
// 3. 在 LOCALES 对象中注册：key 为 BCP 47 语言代码，name 为显示名称
// ─────────────────────────────────────────────────────────────────────────────
export const LOCALES = {
  en: { name: 'English', messages: en },
  zh: { name: '中文',    messages: zh },
}

const LS_LOCALE_KEY = 'mihomo_locale'

function detectLocale() {
  if (typeof navigator === 'undefined') return 'en'
  const lang = navigator.language?.slice(0, 2)
  return lang in LOCALES ? lang : 'en'
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState('en')

  useEffect(() => {
    const saved = localStorage.getItem(LS_LOCALE_KEY)
    setLocaleState(saved && saved in LOCALES ? saved : detectLocale())
  }, [])

  const setLocale = (lang) => {
    if (!(lang in LOCALES)) return
    localStorage.setItem(LS_LOCALE_KEY, lang)
    setLocaleState(lang)
  }

  const messages = LOCALES[locale]?.messages ?? en

  // 支持 {{var}} 插值，例如 t('step1.nodeCount', { count: 3 })
  const t = (key, vars) => {
    const parts = key.split('.')
    let val = messages
    for (const part of parts) {
      val = val?.[part]
      if (val === undefined) return key
    }
    if (typeof val !== 'string') return key
    if (!vars) return val
    return val.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
  }

  return (
    <I18nContext.Provider value={{ t, locale, setLocale, locales: LOCALES }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
