'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'

interface Applicant {
  position: number; uid: string; vi_score: number; id_score: number
  total_score: number; admission_type: string; priority: number; has_consent: boolean
}
interface CompList {
  institute: string; education_form: string; category: string; specialty: string
  total_seats: number; budget_seats: number; contract_seats: number; applicants: Applicant[]
}
interface Data { scraped_at: string|null; total_lists: number; total_applicants: number; lists: CompList[] }
interface Found extends Applicant {
  institute: string; specialty: string; category: string; budget_seats: number
  total_seats: number; contract_seats: number; total_applicants: number
  consent_list: Applicant[]; consent_pos: number; _all: Applicant[]
}

const t = {
  bg:'#06090f', surface:'#0c1322', card:'#111c30', border:'#1a2d4d',
  text:'#e2e8f0', sub:'#8194b2', dim:'#3e5170',
  blue:'#3b82f6', blueSoft:'rgba(59,130,246,0.14)',
  green:'#10b981', greenBg:'rgba(16,185,129,0.10)',
  red:'#ef4444', redBg:'rgba(239,68,68,0.08)',
  amber:'#f59e0b', amberBg:'rgba(245,158,11,0.10)', cyan:'#06b6d4',
}
const mono = "'JetBrains Mono','SF Mono','Fira Code',monospace"
const sans = "'Inter',-apple-system,sans-serif"

export default function Page() {
  const [data, setData] = useState<Data|null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number|null>(null)
  const [listMode, setListMode] = useState<'consent'|'full'>('consent')
  const [savedIds, setSavedIds] = useState<string[]>([])

  useEffect(() => {
    fetch('/data/latest.json').then(r=>r.json()).then(d=>{setData(d);setLoading(false)})
      .catch(()=>fetch('/api/data').then(r=>r.json()).then(d=>{setData(d);setLoading(false)})
      .catch(()=>setLoading(false)))
  }, [])

  useEffect(() => {
    try { const s=localStorage.getItem('tiu_ids'); if(s) setSavedIds(JSON.parse(s)) } catch{}
  }, [])

  const toggleSave = useCallback((id:string) => {
    setSavedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]
      try{localStorage.setItem('tiu_ids',JSON.stringify(next))}catch{}
      return next
    })
  }, [])

  const doSearch = useCallback((id:string) => {
    if(id.trim().length>=3){setActiveId(id.trim());setExpandedIdx(null);setListMode('consent')}
  }, [])

  // Find all entries for activeId
  const results = useMemo<Found[]|null>(() => {
    if(!activeId||!data) return null
    const found:Found[] = []
    for(const lst of data.lists){
      for(const a of lst.applicants){
        if(a.uid===activeId){
          // Consent list = has_consent + vi_score > 0, sorted by total desc
          const cl = lst.applicants
            .filter(x=>x.has_consent && x.vi_score>0)
            .sort((a,b)=>b.total_score-a.total_score)
          const cp = cl.findIndex(x=>x.uid===activeId)
          found.push({
            ...a, institute:lst.institute, specialty:lst.specialty,
            category:lst.category, budget_seats:lst.budget_seats,
            total_seats:lst.total_seats, contract_seats:lst.contract_seats,
            total_applicants:lst.applicants.length,
            consent_list:cl, consent_pos:cp>=0?cp+1:0, _all:lst.applicants,
          })
        }
      }
    }
    found.sort((a,b)=>a.priority-b.priority)
    return found
  }, [activeId, data])

  if(loading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',fontFamily:mono,color:t.dim}}>Загрузка...</div>

  const scrapedAt = data?.scraped_at ? new Date(data.scraped_at).toLocaleString('ru-RU') : null

  return (
    <div style={{fontFamily:sans,background:t.bg,color:t.text,minHeight:'100vh',maxWidth:640,margin:'0 auto'}}>

      {/* Header */}
      <header style={{padding:'24px 20px 0',textAlign:'center'}}>
        <div style={{fontFamily:mono,fontWeight:800,fontSize:28,letterSpacing:3}}>
          <span style={{color:t.blue}}>TIU</span><span style={{color:t.dim}}>/</span><span style={{color:t.sub}}>TRACKER</span>
        </div>
        {scrapedAt && <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:6,marginTop:8,fontSize:11,color:t.dim}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:t.green,display:'inline-block'}}/>
          Обновлено: {scrapedAt}
        </div>}
      </header>

      {/* Search */}
      <div style={{padding:'20px 16px 8px'}}>
        <div style={{display:'flex',border:`1.5px solid ${activeId&&results?.length?t.green:t.border}`,borderRadius:10,overflow:'hidden',background:t.surface}}>
          <input type="text" inputMode="numeric" value={query}
            onChange={e=>setQuery(e.target.value.replace(/\D/g,''))}
            onKeyDown={e=>e.key==='Enter'&&doSearch(query)}
            placeholder="Уникальный идентификатор..."
            style={{flex:1,padding:'14px 16px',background:'transparent',border:'none',outline:'none',color:t.text,fontSize:18,fontFamily:mono,letterSpacing:2,minWidth:0}}
          />
          <button onClick={()=>doSearch(query)}
            style={{padding:'14px 24px',background:t.blue,border:'none',color:'#fff',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:sans}}>
            Найти
          </button>
        </div>
      </div>

      {/* Landing */}
      {!activeId && (
        <div style={{padding:'20px',textAlign:'center'}}>
          <div style={{fontSize:48,marginBottom:16,opacity:0.25}}>🎓</div>
          <p style={{color:t.sub,fontSize:14,lineHeight:1.7,maxWidth:360,margin:'0 auto'}}>
            Введи <strong style={{color:t.text}}>уникальный идентификатор</strong> — покажу все направления и позицию среди тех, кто подал согласие.
          </p>
          {savedIds.length>0 && (
            <div style={{marginTop:20,textAlign:'left'}}>
              <div style={{fontSize:11,color:t.dim,fontFamily:mono,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Сохранённые</div>
              {savedIds.map(id=>(
                <div key={id} style={{display:'flex',alignItems:'center',gap:8,background:t.card,border:`1px solid ${t.border}`,borderRadius:8,padding:'10px 14px',marginBottom:6,cursor:'pointer'}}
                  onClick={()=>{setQuery(id);doSearch(id)}}>
                  <span style={{fontSize:16,fontWeight:800,fontFamily:mono,color:t.cyan,letterSpacing:1,flex:1}}>{id}</span>
                  <span style={{fontSize:12,color:t.blue}}>→</span>
                  <button onClick={e=>{e.stopPropagation();toggleSave(id)}}
                    style={{background:'none',border:'none',color:t.dim,cursor:'pointer',fontSize:14,padding:'0 4px'}}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Not found */}
      {activeId && results?.length===0 && (
        <div style={{padding:'40px 20px',textAlign:'center'}}>
          <div style={{fontSize:36,marginBottom:10,opacity:0.25}}>🔍</div>
          <p style={{color:t.sub,fontSize:14}}>ID <strong style={{color:t.text,fontFamily:mono}}>{activeId}</strong> не найден.</p>
          <button onClick={()=>{setActiveId('');setQuery('')}} style={{marginTop:16,padding:'8px 20px',background:t.card,border:`1px solid ${t.border}`,borderRadius:6,color:t.sub,cursor:'pointer',fontSize:13,fontFamily:sans}}>← Новый поиск</button>
        </div>
      )}

      {/* Results */}
      {results && results.length>0 && (
        <div style={{padding:'4px 16px 32px'}}>

          {/* Person header */}
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:'16px 18px',marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:11,color:t.dim,fontFamily:mono,textTransform:'uppercase',letterSpacing:1}}>Идентификатор</div>
                <div style={{fontSize:24,fontWeight:800,fontFamily:mono,letterSpacing:2,color:t.cyan,marginTop:2}}>{activeId}</div>
              </div>
              <div style={{padding:'5px 12px',borderRadius:6,background:t.blueSoft,color:t.blue,fontSize:13,fontWeight:700,fontFamily:mono}}>
                {results.length} напр.
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
              {(()=>{
                const pass = results.filter(r=>r.consent_pos>0 && r.consent_pos<=r.budget_seats).length
                const edge = results.filter(r=>r.consent_pos>0 && r.consent_pos>r.budget_seats && r.consent_pos<=r.budget_seats+3).length
                const noConsent = results.filter(r=>r.consent_pos===0).length
                return <>
                  {pass>0 && <Badge bg={t.greenBg} c={t.green}>✓ Проходит: {pass}</Badge>}
                  {edge>0 && <Badge bg={t.amberBg} c={t.amber}>⚡ На грани: {edge}</Badge>}
                  {noConsent>0 && <Badge bg={t.redBg} c={t.red}>Нет согласия: {noConsent}</Badge>}
                  {pass===0 && edge===0 && noConsent===0 && <Badge bg={t.redBg} c={t.red}>Не проходит</Badge>}
                </>
              })()}
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button onClick={()=>{setActiveId('');setQuery('')}} style={{background:'none',border:'none',color:t.blue,cursor:'pointer',fontSize:12,fontFamily:sans,padding:0}}>← Поиск</button>
              <button onClick={()=>toggleSave(activeId)} style={{background:'none',border:'none',color:savedIds.includes(activeId)?t.amber:t.dim,cursor:'pointer',fontSize:12,fontFamily:sans,padding:0}}>
                {savedIds.includes(activeId)?'★ Сохранён':'☆ Сохранить'}
              </button>
            </div>
          </div>

          {/* Direction cards */}
          {results.map((r,i)=>{
            const pass = r.consent_pos>0 && r.consent_pos<=r.budget_seats
            const edge = r.consent_pos>0 && r.consent_pos>r.budget_seats && r.consent_pos<=r.budget_seats+3
            const noConsent = r.consent_pos===0
            const accent = pass?t.green:edge?t.amber:t.red
            const status = pass?'ПРОХОДИТ':edge?'НА ГРАНИ':noConsent?'НЕТ СОГЛАСИЯ':'НЕ ПРОХОДИТ'
            const statusBg = pass?t.greenBg:edge?t.amberBg:t.redBg
            const expanded = expandedIdx===i

            return (
              <div key={i} style={{background:t.card,border:`1px solid ${pass?'rgba(16,185,129,0.3)':edge?'rgba(245,158,11,0.3)':t.border}`,borderLeft:`3px solid ${accent}`,borderRadius:10,marginBottom:10,overflow:'hidden'}}>
                <div style={{padding:'16px 18px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <div style={{fontSize:10,fontFamily:mono,color:t.dim,textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>Приоритет {r.priority}</div>
                    <div style={{fontSize:10,fontWeight:700,fontFamily:mono,padding:'3px 10px',borderRadius:4,background:statusBg,color:accent,letterSpacing:0.5}}>{status}</div>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,lineHeight:1.35,marginBottom:4}}>{r.specialty}</div>
                  <div style={{fontSize:11,color:t.sub,marginBottom:14}}>{r.institute}</div>

                  {/* Stats */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:t.border,borderRadius:8,overflow:'hidden'}}>
                    <Stat label="Среди согласий" value={r.consent_pos||'—'} sub={`из ${r.consent_list.length}`} color={accent} big />
                    <Stat label="Баллы" value={r.total_score} sub={`ВИ ${r.vi_score} + ИД ${r.id_score}`} color={t.cyan} big />
                    <Stat label="Бюджет мест" value={r.budget_seats} sub={`всего ${r.total_seats}`} color={t.sub} big />
                  </div>

                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12}}>
                    <div style={{display:'flex',gap:12}}>
                      <Dot active={r.has_consent} label="Согласие" />
                      <Dot active={r.vi_score>0} label="ВИ сдан" />
                    </div>
                    <div style={{fontSize:11,color:t.dim,fontFamily:mono}}>общ. позиция: {r.position}/{r.total_applicants}</div>
                  </div>

                  <button onClick={()=>{setExpandedIdx(expanded?null:i);setListMode('consent')}}
                    style={{marginTop:12,width:'100%',padding:'8px',background:t.surface,border:`1px solid ${t.border}`,borderRadius:6,color:t.sub,cursor:'pointer',fontSize:11,fontFamily:sans}}>
                    {expanded?'Скрыть ▲':'Показать список ▼'}
                  </button>
                </div>

                {/* Expanded list */}
                {expanded && (
                  <div style={{borderTop:`1px solid ${t.border}`,overflowX:'auto'}}>
                    {/* Two tabs: consent list vs full list */}
                    <div style={{display:'flex',borderBottom:`1px solid ${t.border}`}}>
                      {([
                        {key:'consent' as const, label:`С согласием (${r.consent_list.length})`},
                        {key:'full' as const, label:`Полный список (${r._all.length})`},
                      ]).map(tab=>(
                        <button key={tab.key} onClick={()=>setListMode(tab.key)}
                          style={{flex:1,padding:'8px',fontSize:11,fontFamily:sans,border:'none',cursor:'pointer',
                            background:listMode===tab.key?t.card:t.surface,
                            color:listMode===tab.key?(tab.key==='consent'?t.green:t.blue):t.dim,
                            fontWeight:listMode===tab.key?700:400,
                            borderBottom:listMode===tab.key?`2px solid ${tab.key==='consent'?t.green:t.blue}`:'2px solid transparent',
                          }}>
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,fontFamily:mono}}>
                      <thead>
                        <tr style={{background:t.surface}}>
                          {['№','ID','ВИ','ИД','Сумма','Пр.',listMode==='full'?'Согл.':null].filter(Boolean).map((h,j)=>(
                            <th key={j} style={{padding:'8px 6px',textAlign:j===1?'left':'center',color:t.dim,fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5,borderBottom:`1px solid ${t.border}`,whiteSpace:'nowrap'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(listMode==='consent'?r.consent_list:r._all).map((a,j)=>{
                          const isMe = a.uid===activeId
                          const pos = listMode==='consent'?j+1:a.position
                          const rowPass = r.budget_seats>0 && pos<=r.budget_seats
                          return (
                            <tr key={j} style={{background:isMe?t.blueSoft:rowPass?'rgba(16,185,129,0.04)':'transparent',borderBottom:`1px solid ${t.border}`}}>
                              <td style={{padding:'7px 6px',textAlign:'center',fontWeight:700,color:isMe?t.blue:rowPass?t.green:t.dim}}>{pos}</td>
                              <td style={{padding:'7px 6px',fontWeight:isMe?800:400,color:isMe?t.cyan:t.text}}>
                                {a.uid}{isMe&&<span style={{color:t.blue,fontSize:9,marginLeft:6}}>← ты</span>}
                              </td>
                              <td style={{padding:'7px 6px',textAlign:'center',color:a.vi_score>0?t.sub:t.dim}}>{a.vi_score||'—'}</td>
                              <td style={{padding:'7px 6px',textAlign:'center',color:t.sub}}>{a.id_score}</td>
                              <td style={{padding:'7px 6px',textAlign:'center',fontWeight:700,color:t.cyan}}>{a.total_score}</td>
                              <td style={{padding:'7px 6px',textAlign:'center',color:t.sub}}>{a.priority}</td>
                              {listMode==='full'&&<td style={{padding:'7px 6px',textAlign:'center',color:a.has_consent?t.green:t.dim}}>{a.has_consent?'Да':'Нет'}</td>}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div style={{padding:'6px 12px',fontSize:10,fontFamily:mono,background:t.surface,color:t.dim,textAlign:'center',borderTop:`1px solid ${t.border}`}}>
                      Бюджет: {r.budget_seats} · Договор: {r.contract_seats} · Всего: {r.total_seats}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div style={{textAlign:'center',fontSize:10,color:t.dim,fontFamily:mono,marginTop:14}}>
            {scrapedAt&&`данные от ${scrapedAt}`}
          </div>
        </div>
      )}

      <footer style={{textAlign:'center',padding:'20px 16px 32px',fontSize:10,color:t.dim,fontFamily:mono,borderTop:`1px solid ${t.border}`,marginTop:20}}>
        TIU TRACKER · incoming.tyuiu.ru
      </footer>
    </div>
  )
}

function Badge({children,bg,c}:{children:React.ReactNode;bg:string;c:string}){
  return <span style={{fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:6,background:bg,color:c,fontFamily:"'JetBrains Mono',monospace"}}>{children}</span>
}
function Stat({label,value,sub,color,big}:{label:string;value:number|string;sub?:string;color?:string;big?:boolean}){
  return <div style={{background:'#0c1322',padding:big?'12px 8px':'10px 8px',textAlign:'center'}}>
    <div style={{fontSize:9,color:'#3e5170',textTransform:'uppercase',letterSpacing:1,fontFamily:"'JetBrains Mono',monospace",marginBottom:3}}>{label}</div>
    <div style={{fontSize:big?22:16,fontWeight:800,color:color||'#e2e8f0',fontFamily:"'JetBrains Mono',monospace"}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:'#3e5170',fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{sub}</div>}
  </div>
}
function Dot({active,label}:{active:boolean;label:string}){
  return <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:active?'#10b981':'#3e5170',fontWeight:active?600:400}}>
    <span style={{width:7,height:7,borderRadius:'50%',background:active?'#10b981':'#3e5170',opacity:active?1:0.35}}/>
    {label}
  </div>
}
