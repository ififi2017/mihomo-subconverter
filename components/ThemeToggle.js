import { Icon } from './UI'

export default function ThemeToggle({ theme, setTheme, t }) {
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'auto' : 'light'
  return (
    <button
      className="button icon-button theme-button"
      onClick={() => setTheme(next)}
      title={`${t(`theme.${theme}`)} → ${t(`theme.${next}`)}`}
      aria-label={`${t(`theme.${theme}`)} → ${t(`theme.${next}`)}`}
    >
      <Icon
        name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'auto'}
      />
      <span>{t(`theme.${theme}`)}</span>
    </button>
  )
}
