import { Analytics } from '@vercel/analytics/next'
import { I18nProvider } from '../lib/i18n'
import { ThemeProvider } from '../lib/theme'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Component {...pageProps} />
        <Analytics />
      </I18nProvider>
    </ThemeProvider>
  )
}
