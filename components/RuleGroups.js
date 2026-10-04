import { useState } from 'react'
import { Card, CardHeader, StepBadge, Icon } from './UI'
import { DEFAULT_TEMPLATE_URL } from '../lib/constants'

export default function RuleGroups({
  templateUrl,
  onTemplateChange,
  groupsLoading,
  groupsError,
  ruleGroups,
  selectedGroups,
  onToggleGroup,
  onSelectAll,
  onClear,
  onFetchGroups,
  t,
}) {
  const [query, setQuery] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const visibleGroups = ruleGroups.filter((group) =>
    group.toLowerCase().includes(query.toLowerCase()),
  )
  const custom = customOpen
  return (
    <Card id="rules">
      <CardHeader>
        <div className="section-title">
          <StepBadge n="2" />
          <div>
            <h2>{t('step2.title')}</h2>
            <p>{t('studio.rulesSubtitle')}</p>
          </div>
        </div>
        <span className="small-label">ROUTING</span>
      </CardHeader>
      <div className="template-area">
        <div className="template-card">
          <div className="template-icon">
            <Icon name="settings" size={20} />
          </div>
          <div className="template-description">
            <strong>
              {templateUrl ? t('studio.customTemplate') : 'MetaCubeX Full'}
            </strong>
            <span>
              {templateUrl
                ? t('studio.customTemplateHint')
                : t('studio.defaultTemplateHint')}
            </span>
          </div>
          <button
            className="button text-button"
            onClick={() => setCustomOpen(!customOpen)}
            aria-expanded={custom}
            aria-controls="template-settings"
          >
            {t('studio.configure')}
            <Icon name="chevron" size={13} />
          </button>
        </div>
        {custom && (
          <div className="template-settings animate-in" id="template-settings">
            <label htmlFor="template-url">{t('step2.templateLabel')}</label>
            <div className="input-action">
              <input
                id="template-url"
                className="text-input"
                type="url"
                value={templateUrl}
                onChange={(e) => onTemplateChange(e.target.value)}
                placeholder={t('step2.templatePlaceholder')}
                spellCheck={false}
              />
              <button
                className="button secondary"
                onClick={() => {
                  onTemplateChange('')
                  setCustomOpen(false)
                }}
              >
                {t('studio.reset')}
              </button>
            </div>
            <a
              className="text-link"
              href={DEFAULT_TEMPLATE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('step2.templateViewExample')}
              <Icon name="external" size={12} />
            </a>
          </div>
        )}
      </div>
      <div className="group-area">
        <div className="group-toolbar">
          <label className="search-field">
            <Icon name="search" size={15} />
            <input
              aria-label={t('studio.searchGroups')}
              placeholder={t('studio.searchGroups')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="selection-count">
            {selectedGroups?.size ?? ruleGroups.length}
            <span> / {ruleGroups.length}</span>
          </span>
          <button
            className="text-button"
            disabled={groupsLoading || !ruleGroups.length}
            onClick={onSelectAll}
          >
            {t('step2.selectAll')}
          </button>
          <button
            className="text-button"
            disabled={groupsLoading || !ruleGroups.length}
            onClick={onClear}
          >
            {t('step2.clear')}
          </button>
        </div>
        {groupsLoading ? (
          <div className="group-loading" role="status">
            <span className="spinner" />
            {t('step2.loading')}
          </div>
        ) : groupsError ? (
          <div className="inline-error" role="alert">
            <Icon name="info" />
            <span>
              {t('step2.loadError')}: {groupsError}
            </span>
            <button
              className="text-button"
              onClick={() => onFetchGroups(templateUrl)}
            >
              {t('step2.retry')}
            </button>
          </div>
        ) : (
          <div className="group-grid">
            {visibleGroups.map((group) => {
              const checked = selectedGroups?.has(group) ?? true
              return (
                <label
                  className={`group-chip ${checked ? 'selected' : ''}`}
                  key={group}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleGroup(group)}
                  />
                  <span className="checkbox-mark">
                    <Icon name="check" size={11} />
                  </span>
                  <span title={group}>{group}</span>
                </label>
              )
            })}
            {!visibleGroups.length && (
              <p className="group-empty">{t('studio.noGroups')}</p>
            )}
          </div>
        )}
      </div>
      <div className="panel-footnote">
        <Icon name="info" size={14} />
        <span>{t('studio.rulesHint')}</span>
      </div>
    </Card>
  )
}
