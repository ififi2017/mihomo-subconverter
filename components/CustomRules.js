import { Card, StepBadge, Icon } from './UI'

export default function CustomRules({ value, onChange, t }) {
  const count = value
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#')).length
  return (
    <Card className="advanced-panel">
      <details>
        <summary>
          <div className="section-title">
            <StepBadge n="3" />
            <div>
              <h2>
                {t('step3.title')}
                <span className="optional-label">
                  {count
                    ? t('studio.ruleCount', { count })
                    : t('step3.optional')}
                </span>
              </h2>
              <p>{t('studio.customRulesHint')}</p>
            </div>
          </div>
          <Icon name="chevron" size={17} />
        </summary>
        <div className="advanced-content">
          <label className="sr-only" htmlFor="custom-rules">
            {t('step3.title')}
          </label>
          <textarea
            className="text-input rules-editor"
            id="custom-rules"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('step3.placeholder')}
            rows={6}
            spellCheck={false}
          />
        </div>
      </details>
    </Card>
  )
}

export function GuidePanel({ t }) {
  return (
    <details className="guide-panel" id="guide">
      <summary>
        <Icon name="info" size={16} />
        {t('guide.title')}
        <Icon name="chevron" size={15} />
      </summary>
      <ol>
        {[0, 1, 2].map((i) => (
          <li key={i}>{t(`guide.items.${i}`)}</li>
        ))}
      </ol>
    </details>
  )
}
