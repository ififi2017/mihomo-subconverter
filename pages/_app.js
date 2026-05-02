import { I18nProvider } from '../lib/i18n'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <I18nProvider>
      <Component {...pageProps} />
    </I18nProvider>
  )
}
