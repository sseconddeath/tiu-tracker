'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────

interface Applicant {
  position: number
  uid: string
  vi_score: number
  id_score: number
  total_score: number
  admission_type: string
  priority: number
  has_consent: boolean
}

interface CompList {
  institute: string
  education_form: string
  category: string
  specialty: string
  total_seats: number
  budget_seats: number
  contract_seats: number
  applicants: Applicant[]
}

interface Data {
  scraped_at: string | null
  total_lists: number
  total_applicants: number
  lists: CompList[]
}

interface SearchResult extends Applicant {
  institute: string
  specialty: string
  category: string
  education_form: string
  total_seats: number
  budget_seats: number
  contract_seats: number
  total_applicants: number
  consents_count: number
  consent_pri1_count: number
  consent_position: number
  consent_pri1_position: number
  _applicants: Applicant[]
}

// ─── Theme ──────────────────────────────────────────────────────────────

const t = {
  bg: '#06090f',
  surface: '#0c1322',
  card: '#111c30',
  border: '#1a2d4d',
  borderHi: '#3b82f6',
  text: '#e2e8f0',
  sub: '#8194b2',
  dim: '#3e5170',
  blue: '#3b82f6',
  blueSoft: 'rgba(59,130,246,0.14)',
  green: '#10b981',
  greenBg: 'rgba(16,185,129,0.10)',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.08)',
  amber: '#f59e0b',
  amberBg: 'rgba(245,158,11,0.10)',
  cyan: '#06b6d4',
}
const mono = "'JetBrains Mono','SF Mono','Fira Code',monospace"
const sans = "'Inter',-apple-system,sans-serif"

// ─── App ────────────────────────────────────────────────────────────────

export default function Page() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [showOnlyConsent, setShowOnlyConsent] = useState<'all'|'consent'|'exam'|'both'>('consent')
  const [priorityFilter, setPriorityFilter] = useState<number>(1) // 0=all, 1=only pri 1, 2=pri 1-2, etc
  const [savedIds, setSavedIds] = useState<{id: string, label: string}[]>([])

  // Load data
  useEffect(() => {
    fetch('/data/latest.json')
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => {
        // Fallback to API route
        fetch('/api/data')
          .then(r => r.json())
          .then(d => { setData(d); setLoading(false) })
          .catch(e => { setError('Не удалось загрузить данные'); setLoading(false) })
      })
  }, [])

  // Load history and saved IDs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tiu_history')
      if (saved) setHistory(JSON.parse(saved))
      const ids = localStorage.getItem('tiu_saved_ids')
      if (ids) setSavedIds(JSON.parse(ids))
    } catch {}
  }, [])

  const toggleSaveId = useCallback((id: string) => {
    setSavedIds(prev => {
      const exists = prev.find(x => x.id === id)
      const next = exists ? prev.filter(x => x.id !== id) : [...prev, { id, label: '' }]
      try { localStorage.setItem('tiu_saved_ids', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const doSearch = useCallback((id: string) => {
    const clean = id.trim()
    if (clean.length < 3) return
    setActiveId(clean)
    setExpandedIdx(null)
    setHistory(prev => {
      const next = [clean, ...prev.filter(x => x !== clean)].slice(0, 8)
      try { localStorage.setItem('tiu_history', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Search
  const results = useMemo<SearchResult[] | null>(() => {
    if (!activeId || !data) return null
    const found: SearchResult[] = []
    for (const lst of data.lists) {
      for (const a of lst.applicants) {
        if (a.uid === activeId) {
          const consents = lst.applicants.filter(x => x.has_consent).length
          const consentPri1 = lst.applicants.filter(x => x.has_consent && x.priority === 1)
          const consentPos = consentPri1.findIndex(x => x.uid === activeId)
          const allConsents = lst.applicants.filter(x => x.has_consent)
          const consentPosAll = allConsents.findIndex(x => x.uid === activeId)
          found.push({
            ...a,
            institute: lst.institute,
            specialty: lst.specialty,
            category: lst.category,
            education_form: lst.education_form,
            total_seats: lst.total_seats,
            budget_seats: lst.budget_seats,
            contract_seats: lst.contract_seats,
            total_applicants: lst.applicants.length,
            consents_count: consents,
            consent_pri1_count: consentPri1.length,
            consent_position: consentPosAll >= 0 ? consentPosAll + 1 : 0,
            consent_pri1_position: consentPos >= 0 ? consentPos + 1 : 0,
            _applicants: lst.applicants,
          })
        }
      }
    }
    found.sort((a, b) => a.priority - b.priority)
    return found
  }, [activeId, data])

  const inBudget = (r: SearchResult) => r.budget_seats > 0 && r.position <= r.budget_seats
  const onEdge = (r: SearchResult) => r.budget_seats > 0 && r.position > r.budget_seats && r.position <= r.budget_seats + 3

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: mono, color: t.dim }}>
        Загрузка данных...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 36, opacity: 0.3 }}>⚠️</div>
        <div style={{ color: t.sub }}>{error}</div>
        <div style={{ color: t.dim, fontSize: 12 }}>Скрейпер ещё не запускался или данные не загружены.</div>
      </div>
    )
  }

  const scrapedAt = data?.scraped_at ? new Date(data.scraped_at).toLocaleString('ru-RU') : null

  return (
    <div style={{ fontFamily: sans, background: t.bg, color: t.text, minHeight: '100vh', maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <header style={{ padding: '24px 20px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: mono, fontWeight: 800, fontSize: 28, letterSpacing: 3 }}>
          <span style={{ color: t.blue }}>TIU</span>
          <span style={{ color: t.dim }}>/</span>
          <span style={{ color: t.sub }}>TRACKER</span>
        </div>
        <p style={{ color: t.dim, fontSize: 11, fontFamily: mono, margin: '6px 0 0' }}>
          мониторинг конкурсных списков · incoming.tyuiu.ru
        </p>
        {scrapedAt && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: t.dim }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.green, display: 'inline-block' }} />
            Обновлено: {scrapedAt}
          </div>
        )}
        {data && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10, fontSize: 11, fontFamily: mono }}>
            <span style={{ color: t.sub }}>{data.total_lists} списков</span>
            <span style={{ color: t.cyan }}>{data.total_applicants} абитуриентов</span>
          </div>
        )}
      </header>

      {/* Search */}
      <div style={{ padding: '20px 16px 8px' }}>
        <div style={{
          display: 'flex', gap: 0,
          border: `1.5px solid ${activeId && results?.length ? t.green : t.border}`,
          borderRadius: 10, overflow: 'hidden', background: t.surface,
          transition: 'border-color 0.2s',
        }}>
          <input
            type="text"
            inputMode="numeric"
            value={query}
            onChange={e => setQuery(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && doSearch(query)}
            placeholder="Уникальный идентификатор..."
            style={{
              flex: 1, padding: '14px 16px',
              background: 'transparent', border: 'none', outline: 'none',
              color: t.text, fontSize: 18, fontFamily: mono, letterSpacing: 2,
              minWidth: 0,
            }}
          />
          <button
            onClick={() => doSearch(query)}
            style={{
              padding: '14px 24px', background: t.blue, border: 'none',
              color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              fontFamily: sans,
            }}
          >
            Найти
          </button>
        </div>

        {/* History */}
        {history.length > 0 && !activeId && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: t.dim, lineHeight: '28px' }}>Недавние:</span>
            {history.map(id => (
              <button key={id} onClick={() => { setQuery(id); doSearch(id) }}
                style={{
                  padding: '5px 12px', fontSize: 13, fontFamily: mono,
                  background: t.card, border: `1px solid ${t.border}`,
                  borderRadius: 6, color: t.cyan, cursor: 'pointer', letterSpacing: 1,
                }}>
                {id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Landing */}
      {!activeId && (
        <div style={{ padding: '20px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.25 }}>🎓</div>
          <p style={{ color: t.sub, fontSize: 14, lineHeight: 1.7, maxWidth: 360, margin: '0 auto' }}>
            Введи <strong style={{ color: t.text }}>уникальный идентификатор</strong> из Сервиса Приёма — покажу все направления, позицию и шансы.
          </p>

          {/* Saved IDs */}
          {savedIds.length > 0 && (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: t.dim, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Сохранённые ID
              </div>
              {savedIds.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: t.card, border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 6,
                  cursor: 'pointer',
                }} onClick={() => { setQuery(s.id); doSearch(s.id) }}>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: mono, color: t.cyan, letterSpacing: 1, flex: 1 }}>
                    {s.id}
                  </span>
                  <span style={{ fontSize: 12, color: t.blue }}>→</span>
                  <button onClick={(e) => { e.stopPropagation(); toggleSaveId(s.id) }}
                    style={{ background: 'none', border: 'none', color: t.dim, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Not found */}
      {activeId && results !== null && results.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.25 }}>🔍</div>
          <p style={{ color: t.sub, fontSize: 14 }}>
            ID <strong style={{ color: t.text, fontFamily: mono, letterSpacing: 1 }}>{activeId}</strong> не найден.
          </p>
          <p style={{ color: t.dim, fontSize: 12, marginTop: 6 }}>Проверь номер или дождись обновления.</p>
          <button onClick={() => { setActiveId(''); setQuery('') }}
            style={{ marginTop: 16, padding: '8px 20px', background: t.card, border: `1px solid ${t.border}`,
              borderRadius: 6, color: t.sub, cursor: 'pointer', fontSize: 13, fontFamily: sans }}>
            ← Новый поиск
          </button>
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div style={{ padding: '4px 16px 32px' }}>

          {/* Person header */}
          <div style={{
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 10, padding: '16px 18px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: t.dim, fontFamily: mono, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Идентификатор
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: mono, letterSpacing: 2, color: t.cyan, marginTop: 2 }}>
                  {activeId}
                </div>
              </div>
              <div style={{
                padding: '5px 12px', borderRadius: 6,
                background: t.blueSoft, color: t.blue,
                fontSize: 13, fontWeight: 700, fontFamily: mono,
              }}>
                {results.length} напр.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {(() => {
                const pass = results.filter(r => inBudget(r)).length
                const edge = results.filter(r => onEdge(r)).length
                return <>
                  {pass > 0 && <Badge bg={t.greenBg} c={t.green}>✓ Проходит: {pass}</Badge>}
                  {edge > 0 && <Badge bg={t.amberBg} c={t.amber}>⚡ На грани: {edge}</Badge>}
                  {pass === 0 && edge === 0 && <Badge bg={t.redBg} c={t.red}>Не проходит</Badge>}
                </>
              })()}
            </div>

            <button onClick={() => { setActiveId(''); setQuery('') }}
              style={{ marginTop: 12, background: 'none', border: 'none', color: t.blue,
                cursor: 'pointer', fontSize: 12, fontFamily: sans, padding: 0 }}>
              ← Новый поиск
            </button>
            <button onClick={() => toggleSaveId(activeId)}
              style={{ marginTop: 12, marginLeft: 16, background: 'none', border: 'none',
                color: savedIds.find(x => x.id === activeId) ? t.amber : t.dim,
                cursor: 'pointer', fontSize: 12, fontFamily: sans, padding: 0 }}>
              {savedIds.find(x => x.id === activeId) ? '★ Сохранён' : '☆ Сохранить'}
            </button>
          </div>

          {/* Cards */}
          {results.map((r, i) => {
            const pass = inBudget(r)
            const edge = onEdge(r)
            const accent = pass ? t.green : edge ? t.amber : t.red
            const statusText = pass ? 'ПРОХОДИТ' : edge ? 'НА ГРАНИ' : 'НЕ ПРОХОДИТ'
            const statusBg = pass ? t.greenBg : edge ? t.amberBg : t.redBg
            const expanded = expandedIdx === i

            return (
              <div key={i} style={{
                background: t.card,
                border: `1px solid ${pass ? 'rgba(16,185,129,0.3)' : edge ? 'rgba(245,158,11,0.3)' : t.border}`,
                borderLeft: `3px solid ${accent}`,
                borderRadius: 10, marginBottom: 10, overflow: 'hidden',
              }}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, fontFamily: mono, color: t.dim, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                      Приоритет {r.priority}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, fontFamily: mono,
                      padding: '3px 10px', borderRadius: 4,
                      background: statusBg, color: accent, letterSpacing: 0.5,
                    }}>
                      {statusText}
                    </div>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>
                    {r.specialty}
                  </div>
                  <div style={{ fontSize: 11, color: t.sub, marginBottom: 14 }}>
                    {r.institute} · {r.education_form} · {r.category}
                  </div>

                  {/* Stats */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: 1, background: t.border, borderRadius: 8, overflow: 'hidden',
                  }}>
                    <Cell label="Позиция" value={r.position} sub={`из ${r.total_applicants}`} color={accent} big />
                    <Cell label="Баллы" value={r.total_score} sub={`ВИ ${r.vi_score} + ИД ${r.id_score}`} color={t.cyan} big />
                    <Cell label="Согл.+Пр.1" value={r.consent_pri1_position || '—'} sub={`из ${r.consent_pri1_count}`} color={r.consent_pri1_position && r.consent_pri1_position <= r.budget_seats ? t.green : t.amber} big />
                    <Cell label="Все согл." value={r.consent_position || '—'} sub={`${r.consents_count} чел.`} color={t.sub} big />
                  </div>

                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 12, flexWrap: 'wrap', gap: 8,
                  }}>
                    <Dot active={r.has_consent} label="Согласие" />
                    <div style={{ fontSize: 11, color: t.dim, fontFamily: mono }}>
                      {r.budget_seats} бюдж. · {r.consents_count} согл.
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedIdx(expanded ? null : i)}
                    style={{
                      marginTop: 12, width: '100%', padding: '8px',
                      background: t.surface, border: `1px solid ${t.border}`,
                      borderRadius: 6, color: t.sub, cursor: 'pointer',
                      fontSize: 11, fontFamily: sans,
                    }}
                  >
                    {expanded ? 'Скрыть список ▲' : `Весь список (${r.total_applicants} чел.) ▼`}
                  </button>
                </div>

                {/* Expanded table */}
                {expanded && (
                  <div style={{ borderTop: `1px solid ${t.border}`, overflowX: 'auto' }}>
                    {/* Filter buttons */}
                    <div style={{
                      display: 'flex', gap: 4, padding: '8px 10px',
                      background: t.surface, borderBottom: `1px solid ${t.border}`,
                      flexWrap: 'wrap',
                    }}>
                      {([
                        { key: 'all', label: `Все (${r._applicants.length})` },
                        { key: 'consent', label: `С согласием (${r._applicants.filter(a => a.has_consent).length})` },
                        { key: 'exam', label: `Сдали ВИ (${r._applicants.filter(a => a.vi_score > 0).length})` },
                        { key: 'both', label: `Согл. + ВИ (${r._applicants.filter(a => a.has_consent && a.vi_score > 0).length})` },
                      ] as const).map(f => (
                        <button key={f.key} onClick={() => setShowOnlyConsent(f.key)}
                          style={{
                            padding: '4px 8px', fontSize: 10, fontFamily: sans,
                            background: showOnlyConsent === f.key ? (f.key === 'all' ? t.blueSoft : t.greenBg) : t.card,
                            border: `1px solid ${showOnlyConsent === f.key ? (f.key === 'all' ? t.blue : t.green) : t.border}`,
                            borderRadius: 5, cursor: 'pointer',
                            color: showOnlyConsent === f.key ? (f.key === 'all' ? t.blue : t.green) : t.sub,
                            fontWeight: showOnlyConsent === f.key ? 600 : 400,
                          }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                    {/* Priority filter */}
                    <div style={{
                      display: 'flex', gap: 4, padding: '4px 10px 8px',
                      background: t.surface, borderBottom: `1px solid ${t.border}`,
                      flexWrap: 'wrap', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 10, color: t.dim, marginRight: 4 }}>Приоритет:</span>
                      {[
                        { val: 0, label: 'Все' },
                        { val: 1, label: '1' },
                        { val: 2, label: '1-2' },
                        { val: 3, label: '1-3' },
                      ].map(p => (
                        <button key={p.val} onClick={() => setPriorityFilter(p.val)}
                          style={{
                            padding: '3px 8px', fontSize: 10, fontFamily: mono,
                            background: priorityFilter === p.val ? t.amberBg : t.card,
                            border: `1px solid ${priorityFilter === p.val ? t.amber : t.border}`,
                            borderRadius: 4, cursor: 'pointer',
                            color: priorityFilter === p.val ? t.amber : t.sub,
                            fontWeight: priorityFilter === p.val ? 700 : 400,
                          }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: mono }}>
                      <thead>
                        <tr style={{ background: t.surface }}>
                          {['№', 'ID', 'ВИ', 'ИД', 'Сумма', 'Пр.', 'Согл.'].map((h, j) => (
                            <th key={j} style={{
                              padding: '8px 6px', textAlign: j === 1 ? 'left' : 'center',
                              color: t.dim, fontSize: 9, fontWeight: 600,
                              textTransform: 'uppercase', letterSpacing: 0.5,
                              borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r._applicants.filter(a => {
                          let pass = true
                          if (showOnlyConsent === 'consent') pass = a.has_consent
                          if (showOnlyConsent === 'exam') pass = a.vi_score > 0
                          if (showOnlyConsent === 'both') pass = a.has_consent && a.vi_score > 0
                          if (priorityFilter > 0) pass = pass && a.priority >= 1 && a.priority <= priorityFilter
                          return pass
                        }).map((a, j) => {
                          const isMe = a.uid === activeId
                          const filteredPos = j + 1
                          const isFiltered = showOnlyConsent !== 'all' || priorityFilter > 0
                          const displayPos = isFiltered ? filteredPos : a.position
                          const rowPass = r.budget_seats > 0 && displayPos <= r.budget_seats
                          return (
                            <tr key={j} style={{
                              background: isMe ? t.blueSoft : rowPass ? 'rgba(16,185,129,0.04)' : 'transparent',
                              borderBottom: `1px solid ${t.border}`,
                            }}>
                              <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 700,
                                color: isMe ? t.blue : rowPass ? t.green : t.dim }}>{displayPos}</td>
                              <td style={{ padding: '7px 6px', fontWeight: isMe ? 800 : 400,
                                color: isMe ? t.cyan : t.text }}>
                                {a.uid}{isMe && <span style={{ color: t.blue, fontSize: 9, marginLeft: 6 }}>← ты</span>}
                              </td>
                              <td style={{ padding: '7px 6px', textAlign: 'center', color: t.sub }}>{a.vi_score}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'center', color: t.sub }}>{a.id_score}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: 700, color: t.cyan }}>{a.total_score}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'center', color: t.sub }}>{a.priority}</td>
                              <td style={{ padding: '7px 6px', textAlign: 'center',
                                color: a.has_consent ? t.green : t.dim }}>
                                {a.has_consent ? 'Да' : 'Нет'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div style={{
                      padding: '6px 12px', fontSize: 10, fontFamily: mono,
                      background: t.surface, color: t.dim, textAlign: 'center',
                      borderTop: `1px solid ${t.border}`,
                    }}>
                      Бюджет: {r.budget_seats} · Договор: {r.contract_seats} · Всего мест: {r.total_seats}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ textAlign: 'center', fontSize: 10, color: t.dim, fontFamily: mono, marginTop: 14 }}>
            {scrapedAt && `данные от ${scrapedAt} · `}обновляются автоматически
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '20px 16px 32px',
        fontSize: 10, color: t.dim, fontFamily: mono,
        borderTop: `1px solid ${t.border}`, marginTop: 20,
      }}>
        TIU TRACKER · данные с incoming.tyuiu.ru
      </footer>
    </div>
  )
}

// ─── Components ─────────────────────────────────────────────────────────

function Badge({ children, bg, c }: { children: React.ReactNode; bg: string; c: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '4px 10px',
      borderRadius: 6, background: bg, color: c,
      fontFamily: "'JetBrains Mono',monospace",
    }}>{children}</span>
  )
}

function Cell({ label, value, sub, color, big }: {
  label: string; value: number | string; sub?: string; color?: string; big?: boolean
}) {
  return (
    <div style={{
      background: '#0c1322', padding: big ? '12px 8px' : '10px 8px', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 9, color: '#3e5170', textTransform: 'uppercase' as const,
        letterSpacing: 1, fontFamily: "'JetBrains Mono',monospace", marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontSize: big ? 22 : 16, fontWeight: 800, color: color || '#e2e8f0',
        fontFamily: "'JetBrains Mono',monospace",
      }}>{value}</div>
      {sub && <div style={{
        fontSize: 10, color: '#3e5170', fontFamily: "'JetBrains Mono',monospace", marginTop: 2,
      }}>{sub}</div>}
    </div>
  )
}

function Dot({ active, label }: { active: boolean; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
      color: active ? '#10b981' : '#3e5170', fontWeight: active ? 600 : 400,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: active ? '#10b981' : '#3e5170', opacity: active ? 1 : 0.35,
      }} />
      {label}: {active ? 'Да' : 'Нет'}
    </div>
  )
}
