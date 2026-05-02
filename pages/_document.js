import { Html, Head, Main, NextScript } from 'next/document'

// Injected before React hydrates to prevent flash of wrong theme
const themeScript = `(function(){try{var t=localStorage.getItem('mihomo_theme')||'auto';if(t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`

export default function Document() {
  return (
    <Html>
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
