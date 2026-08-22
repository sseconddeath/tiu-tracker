'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

interface Applicant {
  position:number; uid:string; vi_score:number; id_score:number
  total_score:number; admission_type:string; priority:number; has_consent:boolean
}
interface CompList {
  institute:string; education_form:string; category:string; specialty:string
  total_seats:number; budget_seats:number; contract_seats:number
  applicants:Applicant[]; consent_applicants:Applicant[]
}
interface Data { scraped_at:string|null; total_lists:number; total_applicants:number; lists:CompList[] }
interface Found extends Applicant {
  institute:string; specialty:string; budget_seats:number; total_seats:number
  contract_seats:number; full_count:number; consent_count:number
  consent_pos:number; full:Applicant[]; consent:Applicant[]
}
interface SavedId { id:string; label:string }

export default function Page(){
  const [data,setData]=useState<Data|null>(null)
  const [loading,setLoading]=useState(true)
  const [query,setQuery]=useState('')
  const [activeId,setActiveId]=useState('')
  const [expandedIdx,setExpandedIdx]=useState<number|null>(null)
  const [listMode,setListMode]=useState<'consent'|'full'>('consent')
  const [savedIds,setSavedIds]=useState<SavedId[]>([])
  const [editingId,setEditingId]=useState<string|null>(null)
  const editRef=useRef<HTMLInputElement>(null)

  useEffect(()=>{
    fetch('/data/latest.json?v='+Date.now()).then(r=>r.json()).then(d=>{setData(d);setLoading(false)})
      .catch(()=>fetch('/api/data?v='+Date.now()).then(r=>r.json()).then(d=>{setData(d);setLoading(false)}).catch(()=>setLoading(false)))
  },[])
  useEffect(()=>{try{const s=localStorage.getItem('tiu_ids2');if(s)setSavedIds(JSON.parse(s))}catch{}},[])
  useEffect(()=>{if(editingId&&editRef.current)editRef.current.focus()},[editingId])

  const savePersist=(next:SavedId[])=>{try{localStorage.setItem('tiu_ids2',JSON.stringify(next))}catch{}}
  const toggleSave=useCallback((id:string)=>{
    setSavedIds(p=>{const ex=p.find(x=>x.id===id);const n=ex?p.filter(x=>x.id!==id):[...p,{id,label:''}];savePersist(n);return n})
  },[])
  const updateLabel=useCallback((id:string,label:string)=>{
    setSavedIds(p=>{const n=p.map(x=>x.id===id?{...x,label}:x);savePersist(n);return n})
  },[])
  const doSearch=useCallback((id:string)=>{if(id.trim().length>=3){setActiveId(id.trim());setExpandedIdx(null);setListMode('consent')}},[])

  const results=useMemo<Found[]|null>(()=>{
    if(!activeId||!data)return null
    const found:Found[]=[]
    for(const lst of data.lists){
      for(const a of lst.applicants){
        if(a.uid===activeId){
          const cl=lst.consent_applicants||[]
          const cp=cl.findIndex(x=>x.uid===activeId)
          found.push({...a,institute:lst.institute,specialty:lst.specialty,
            budget_seats:lst.budget_seats,total_seats:lst.total_seats,contract_seats:lst.contract_seats,
            full_count:lst.applicants.length,consent_count:cl.length,
            consent_pos:cp>=0?cp+1:0,full:lst.applicants,consent:cl})
          break
        }
      }
      if(!found.find(f=>f.specialty===lst.specialty)){
        const cl=lst.consent_applicants||[]
        for(const a of cl){
          if(a.uid===activeId){
            const cp=cl.findIndex(x=>x.uid===activeId)
            found.push({...a,institute:lst.institute,specialty:lst.specialty,
              budget_seats:lst.budget_seats,total_seats:lst.total_seats,contract_seats:lst.contract_seats,
              full_count:lst.applicants.length,consent_count:cl.length,
              consent_pos:cp>=0?cp+1:0,full:lst.applicants,consent:cl})
            break
          }
        }
      }
    }
    found.sort((a,b)=>a.priority-b.priority)
    return found
  },[activeId,data])

  const savedLabel=savedIds.find(x=>x.id===activeId)?.label||''
  if(loading)return<div style={styles.loadWrap}><style>{globalCSS}</style><div style={styles.loadText}>INITIALIZING<span className="blink">_</span></div></div>
  const ts=data?.scraped_at?new Date(data.scraped_at).toLocaleString('ru-RU'):null

  return(
    <div style={styles.root}>
      <style>{globalCSS}</style>
      {/* Scan lines overlay */}
      <div style={styles.scanlines}/>
      {/* Matrix bg */}
      <MatrixBg/>

      <div style={styles.content}>
      {/* Header */}
      <header style={styles.header}>
        <div className="glitch" data-text="ТИУ://ТРЕКЕР" style={styles.logo}>ТИУ://ТРЕКЕР</div>
        <div style={styles.headerSub}>СИСТЕМА МОНИТОРИНГА КОНКУРСНЫХ СПИСКОВ</div>
        {ts&&<div style={styles.headerTime}><span style={styles.dot}/>SYNC: {ts}</div>}
      </header>

      {/* Search */}
      <div style={styles.searchWrap}>
        <div style={{...styles.searchBox,borderColor:activeId&&results?.length?'#4ade80':'#333'}}>
          <span style={styles.searchPrefix}>&gt;_</span>
          <input type="text" inputMode="numeric" value={query} maxLength={7}
            onChange={e=>setQuery(e.target.value.replace(/\D/g,'').slice(0,7))}
            onKeyDown={e=>e.key==='Enter'&&doSearch(query)}
            placeholder="ВВЕДИТЕ ID"
            style={styles.searchInput}/>
          <button onClick={()=>doSearch(query)} style={styles.searchBtn}>
            <span style={styles.searchBtnText}>ПОИСК</span>
          </button>
        </div>
      </div>

      {/* Landing */}
      {!activeId&&(
        <div style={styles.landing}>
          <pre style={{fontFamily:mono,fontSize:11,color:'#333',lineHeight:1.5,textAlign:'center',margin:'0 auto 16px'}}>{`
  ╔══════════════════════════════╗
  ║  ВВЕДИТЕ 7-ЗНАЧНЫЙ          ║
  ║  ИДЕНТИФИКАТОР ИЗ            ║
  ║  СЕРВИСА ПРИЁМА              ║
  ╠══════════════════════════════╣
  ║  > ОТСЛЕЖИВАНИЕ НАПРАВЛЕНИЙ ║
  ║  > СПИСКИ С СОГЛАСИЯМИ      ║
  ║  > МОНИТОРИНГ МЕСТ          ║
  ╚══════════════════════════════╝`}</pre>

          {savedIds.length>0&&(
            <div style={{marginTop:24}}>
              <div style={styles.sectionLabel}>{'>'} СОХРАНЁННЫЕ ЗАПИСИ</div>
              {savedIds.map(s=>(
                <div key={s.id} style={styles.savedCard} className="card-hover"
                  onClick={()=>{if(editingId!==s.id){setQuery(s.id);doSearch(s.id)}}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,flex:1}}>
                    <span style={styles.savedId}>{s.id}</span>
                    {editingId===s.id?(
                      <input ref={editRef} value={s.label} placeholder="Имя..."
                        onClick={e=>e.stopPropagation()}
                        onChange={e=>updateLabel(s.id,e.target.value)}
                        onBlur={()=>setEditingId(null)}
                        onKeyDown={e=>{if(e.key==='Enter')setEditingId(null)}}
                        style={styles.labelInput}/>
                    ):s.label?(
                      <span style={styles.savedLabel} onClick={e=>{e.stopPropagation();setEditingId(s.id)}}>{s.label}</span>
                    ):(
                      <span style={styles.addLabel} onClick={e=>{e.stopPropagation();setEditingId(s.id)}}>+ подпись</span>
                    )}
                  </div>
                  <button onClick={e=>{e.stopPropagation();toggleSave(s.id)}} style={styles.removeBtn}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Not found */}
      {activeId&&results?.length===0&&(
        <div style={styles.notFound}>
          <pre style={{fontFamily:'inherit',color:'#ef4444',fontSize:12}}>{`[ERROR] ID_NOT_FOUND: ${activeId}`}</pre>
          <button onClick={()=>{setActiveId('');setQuery('')}} style={styles.backBtn}>← НАЗАД</button>
        </div>
      )}

      {/* Results */}
      {results&&results.length>0&&(
        <div style={{padding:'4px 16px 32px'}}>
          <div style={styles.idCard}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={styles.idLabel}>ID</div>
                <div className="glitch" data-text={activeId} style={styles.idValue}>{activeId}</div>
                {savedLabel&&<div style={{fontSize:12,color:'#888',marginTop:2}}>{savedLabel}</div>}
              </div>
              <div style={styles.idBadge}>{results.length} направл.</div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
              {(()=>{
                const p=results.filter(r=>r.consent_pos>0&&r.consent_pos<=r.budget_seats).length
                const e=results.filter(r=>r.consent_pos>0&&r.consent_pos>r.budget_seats&&r.consent_pos<=r.budget_seats+3).length
                const f=results.filter(r=>r.consent_pos>0&&r.consent_pos>r.budget_seats+3).length
                const n=results.filter(r=>r.consent_pos===0).length
                return<>
                  {p>0&&<span style={{...styles.tag,background:'rgba(74,222,128,0.1)',color:'#4ade80',borderColor:'rgba(74,222,128,0.3)'}}>ПРОХОДИТ: {p}</span>}
                  {e>0&&<span style={{...styles.tag,background:'rgba(251,191,36,0.1)',color:'#fbbf24',borderColor:'rgba(251,191,36,0.3)'}}>НА ГРАНИ: {e}</span>}
                  {f>0&&<span style={{...styles.tag,background:'rgba(248,113,113,0.1)',color:'#f87171',borderColor:'rgba(248,113,113,0.3)'}}>НЕ ПРОХОДИТ: {f}</span>}
                  {n>0&&<span style={{...styles.tag,background:'rgba(255,255,255,0.03)',color:'#666',borderColor:'rgba(255,255,255,0.1)'}}>НЕТ В СПИСКЕ: {n}</span>}
                </>
              })()}
            </div>
            <div style={{display:'flex',gap:12,marginTop:14}}>
              <button onClick={()=>{setActiveId('');setQuery('')}} style={styles.linkBtn}>← НАЗАД</button>
              <button onClick={()=>toggleSave(activeId)} style={{...styles.linkBtn,color:savedIds.find(x=>x.id===activeId)?'#fbbf24':'#555'}}>
                {savedIds.find(x=>x.id===activeId)?'★ СОХРАНЁН':'☆ СОХРАНИТЬ'}
              </button>
              {savedIds.find(x=>x.id===activeId)&&!editingId&&(
                <button onClick={()=>setEditingId(activeId)} style={{...styles.linkBtn,color:'#555'}}>✎ ПОДПИСЬ</button>
              )}
            </div>
            {editingId===activeId&&(
              <input ref={editRef} value={savedLabel} placeholder="Введите имя или заметку..."
                onChange={e=>updateLabel(activeId,e.target.value)}
                onBlur={()=>setEditingId(null)} onKeyDown={e=>{if(e.key==='Enter')setEditingId(null)}}
                style={{...styles.labelInput,marginTop:10,width:'100%'}}/>
            )}
          </div>

          {results.map((r,i)=>{
            const pass=r.consent_pos>0&&r.consent_pos<=r.budget_seats
            const edge=r.consent_pos>0&&r.consent_pos>r.budget_seats&&r.consent_pos<=r.budget_seats+3
            const fail=r.consent_pos>0&&r.consent_pos>r.budget_seats+3
            const noList=r.consent_pos===0
            const accent=pass?'#4ade80':edge?'#fbbf24':fail?'#f87171':'#444'
            const status=pass?'ПРОХОДИТ':edge?'НА ГРАНИ':fail?'НЕ ПРОХОДИТ':'НЕТ В СПИСКЕ'
            const expanded=expandedIdx===i

            return(
              <div key={i} className="card-hover" style={{...styles.dirCard,borderLeftColor:accent}}>
                <div style={{padding:'16px 18px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={styles.prioLabel}>ПРИОРИТЕТ {r.priority}</div>
                    <div style={{...styles.statusTag,background:pass?'rgba(74,222,128,0.1)':edge?'rgba(251,191,36,0.1)':fail?'rgba(248,113,113,0.1)':'rgba(255,255,255,0.03)',color:accent}}>{status}</div>
                  </div>
                  <div style={styles.specName}>{r.specialty}</div>
                  <div style={styles.instName}>{r.institute}</div>

                  <div style={styles.statsGrid}>
                    <div style={styles.statCell}>
                      <div style={styles.statLabel}>ПОЗИЦИЯ</div>
                      <div style={{...styles.statValue,color:accent}}>{r.consent_pos||'—'}</div>
                      <div style={styles.statSub}>из {r.consent_count}</div>
                    </div>
                    <div style={styles.statCell}>
                      <div style={styles.statLabel}>БАЛЛЫ</div>
                      <div style={styles.statValue}>{r.total_score}</div>
                      <div style={styles.statSub}>ВИ {r.vi_score} + ИД {r.id_score}</div>
                    </div>
                    <div style={styles.statCell}>
                      <div style={styles.statLabel}>БЮДЖЕТ</div>
                      <div style={{...styles.statValue,color:'#888'}}>{r.budget_seats}</div>
                      <div style={styles.statSub}>всего {r.total_seats}</div>
                    </div>
                  </div>

                  <div style={{display:'flex',justifyContent:'space-between',marginTop:12}}>
                    <div style={{display:'flex',gap:14}}>
                      <span style={{...styles.dotLabel,color:r.has_consent?'#4ade80':'#333'}}><span style={{...styles.dotSmall,background:r.has_consent?'#4ade80':'#333',boxShadow:r.has_consent?'0 0 8px #4ade80':'none'}}/>Согласие</span>
                      <span style={{...styles.dotLabel,color:r.vi_score>0?'#4ade80':'#333'}}><span style={{...styles.dotSmall,background:r.vi_score>0?'#4ade80':'#333',boxShadow:r.vi_score>0?'0 0 8px #4ade80':'none'}}/>ВИ</span>
                    </div>
                    <span style={{fontSize:10,color:'#333',fontFamily:mono}}>#{r.position}/{r.full_count}</span>
                  </div>

                  <button onClick={()=>{setExpandedIdx(expanded?null:i);setListMode('consent')}} className="card-hover" style={styles.expandBtn}>
                    {expanded?'СКРЫТЬ ▲':'СПИСОК ▼'}
                  </button>
                </div>

                {expanded&&(
                  <div style={{borderTop:'1px solid #222',overflowX:'auto'}}>
                    <div style={{display:'flex',borderBottom:'1px solid #222'}}>
                      {([{k:'consent' as const,l:`С согласием (${r.consent.length})`},{k:'full' as const,l:`Полный (${r.full.length})`}]).map(tab=>(
                        <button key={tab.k} onClick={()=>setListMode(tab.k)}
                          style={{flex:1,padding:'8px',fontSize:10,fontFamily:mono,border:'none',cursor:'pointer',letterSpacing:1,transition:'all 0.2s',
                            background:listMode===tab.k?'#1a1a1a':'#111',
                            color:listMode===tab.k?'#fff':'#444',
                            borderBottom:listMode===tab.k?'1px solid #fff':'1px solid transparent'}}>
                          {tab.l}
                        </button>
                      ))}
                    </div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,fontFamily:mono}}>
                      <thead><tr style={{background:'#141414'}}>
                        {['№','ID','ВИ','ИД','Σ','ПР.',listMode==='full'?'СОГЛ.':null].filter(Boolean).map((h,j)=>(
                          <th key={j}style={{padding:'8px 6px',textAlign:j===1?'left':'center',color:'#444',fontSize:8,fontWeight:600,letterSpacing:1,borderBottom:'1px solid #222'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {(listMode==='consent'?r.consent:r.full).map((a,j)=>{
                          const isMe=a.uid===activeId
                          const pos=listMode==='consent'?j+1:a.position
                          const rp=r.budget_seats>0&&pos<=r.budget_seats
                          return(
                            <tr key={j}className="row-hover"style={{borderBottom:'1px solid #1a1a1a',background:isMe?'rgba(255,255,255,0.04)':rp?'rgba(74,222,128,0.02)':'transparent'}}>
                              <td style={{padding:'6px',textAlign:'center',fontWeight:700,color:isMe?'#fff':rp?'#4ade80':'#444'}}>{pos}</td>
                              <td style={{padding:'6px',fontWeight:isMe?800:400,color:isMe?'#fff':'#ccc'}}>
                                {a.uid}{isMe&&<span style={{color:'#555',fontSize:8,marginLeft:6}}>← вы</span>}
                              </td>
                              <td style={{padding:'6px',textAlign:'center',color:a.vi_score>0?'#999':'#333'}}>{a.vi_score||'—'}</td>
                              <td style={{padding:'6px',textAlign:'center',color:'#999'}}>{a.id_score}</td>
                              <td style={{padding:'6px',textAlign:'center',fontWeight:700,color:'#fff'}}>{a.total_score}</td>
                              <td style={{padding:'6px',textAlign:'center',color:'#999'}}>{a.priority}</td>
                              {listMode==='full'&&<td style={{padding:'6px',textAlign:'center',color:a.has_consent?'#4ade80':'#333'}}>{a.has_consent?'✓':'—'}</td>}
                            </tr>)
                        })}
                      </tbody>
                    </table>
                    <div style={{padding:'6px',fontSize:9,fontFamily:mono,background:'#111',color:'#333',textAlign:'center',borderTop:'1px solid #222',letterSpacing:1}}>
                      БЮДЖЕТ: {r.budget_seats} · ДОГОВОР: {r.contract_seats} · ВСЕГО: {r.total_seats}
                    </div>
                  </div>
                )}
              </div>)
          })}
          <div style={{textAlign:'center',fontSize:9,color:'#333',fontFamily:mono,marginTop:16,letterSpacing:1}}>
            {ts&&`SYNC: ${ts}`}
          </div>
        </div>
      )}
      <footer style={{textAlign:'center',padding:'20px 16px 40px',fontSize:9,color:'#333',fontFamily:mono,borderTop:'1px solid #1a1a1a',marginTop:20,letterSpacing:2}}>
        ТИУ://ТРЕКЕР · incoming.tyuiu.ru
      </footer>
      </div>
    </div>)
}

const mono="'JetBrains Mono','SF Mono','Fira Code',monospace"

const globalCSS=`
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  @keyframes glitchAnim{0%{clip-path:inset(40% 0 61% 0)}20%{clip-path:inset(92% 0 1% 0)}40%{clip-path:inset(43% 0 1% 0)}60%{clip-path:inset(25% 0 58% 0)}80%{clip-path:inset(54% 0 7% 0)}100%{clip-path:inset(58% 0 43% 0)}}
  @keyframes glow{0%,100%{text-shadow:0 0 5px rgba(255,255,255,0.1)}50%{text-shadow:0 0 20px rgba(255,255,255,0.15),0 0 40px rgba(255,255,255,0.05)}}
  .blink{animation:blink 1s infinite}
  .glitch{position:relative;animation:glow 4s ease-in-out infinite}
  .glitch::before,.glitch::after{content:attr(data-text);position:absolute;top:0;left:0;width:100%;height:100%}
  .glitch::before{animation:glitchAnim 3s infinite linear alternate-reverse;color:rgba(255,255,255,0.03);left:2px}
  .glitch::after{animation:glitchAnim 2s infinite linear alternate;color:rgba(255,255,255,0.03);left:-2px}
  .card-hover{transition:border-color 0.3s,background 0.2s}
  .card-hover:hover{border-color:#444!important}
  .row-hover:hover{background:rgba(255,255,255,0.03)!important}
  ::selection{background:rgba(255,255,255,0.15);color:#fff}
  input::placeholder{color:#333}
`

const styles:Record<string,React.CSSProperties>={
  root:{fontFamily:"'Inter',-apple-system,sans-serif",background:'#0a0a0a',color:'#f5f5f5',minHeight:'100vh',position:'relative',overflow:'hidden'},
  scanlines:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:1,pointerEvents:'none',background:'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)'},
  matrixWrap:{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:0,overflow:'hidden',pointerEvents:'none'},
  content:{position:'relative',zIndex:2,maxWidth:640,margin:'0 auto'},
  loadWrap:{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'#0a0a0a'},
  loadText:{fontFamily:mono,fontSize:14,color:'#555',letterSpacing:3},
  header:{padding:'32px 20px 0',textAlign:'center'},
  logo:{fontFamily:mono,fontWeight:800,fontSize:26,letterSpacing:3,color:'#fff'},
  headerSub:{color:'#333',fontSize:9,fontFamily:mono,marginTop:8,letterSpacing:3},
  headerTime:{display:'flex',justifyContent:'center',alignItems:'center',gap:6,marginTop:10,fontSize:11,color:'#444',fontFamily:mono},
  dot:{width:5,height:5,borderRadius:'50%',background:'#4ade80',display:'inline-block',boxShadow:'0 0 8px #4ade80'},
  searchWrap:{padding:'24px 16px 8px'},
  searchBox:{display:'flex',alignItems:'stretch',border:'1px solid #333',borderRadius:4,background:'#111',transition:'border-color 0.3s',overflow:'hidden'},
  searchPrefix:{padding:'14px 0 14px 14px',color:'#555',fontFamily:mono,fontSize:14,fontWeight:700,display:'flex',alignItems:'center'},
  searchInput:{flex:1,padding:'14px 10px',background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:18,fontFamily:mono,letterSpacing:3,minWidth:0},
  searchBtn:{padding:'0 24px',background:'#fff',border:'none',color:'#000',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:mono,letterSpacing:2,display:'flex',alignItems:'center'},
  searchBtnText:{},
  landing:{padding:'24px 20px',textAlign:'center'},
  ascii:{fontFamily:mono,fontSize:11,color:'#333',lineHeight:1.4,margin:'0 auto 0',textAlign:'left',display:'inline-block'},
  sectionLabel:{fontSize:10,color:'#555',fontFamily:mono,letterSpacing:2,marginBottom:10,textAlign:'left'},
  savedCard:{display:'flex',alignItems:'center',gap:8,background:'#111',border:'1px solid #222',borderRadius:0,padding:'10px 14px',marginBottom:2,cursor:'pointer'},
  savedId:{fontFamily:mono,fontSize:14,fontWeight:700,color:'#fff',letterSpacing:2},
  savedLabel:{fontSize:12,color:'#666',cursor:'pointer'},
  addLabel:{fontSize:11,color:'#333',cursor:'pointer',fontFamily:mono},
  labelInput:{padding:'4px 8px',background:'#1a1a1a',border:'1px solid #333',borderRadius:0,color:'#fff',fontSize:12,fontFamily:mono,outline:'none'},
  removeBtn:{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:13,padding:'0 4px'},
  notFound:{padding:'40px 20px',textAlign:'center',fontFamily:mono},
  backBtn:{marginTop:16,padding:'8px 20px',background:'#111',border:'1px solid #222',borderRadius:0,color:'#666',cursor:'pointer',fontSize:11,fontFamily:mono,letterSpacing:1},
  idCard:{background:'#111',border:'1px solid #222',borderRadius:0,padding:'18px',marginBottom:14},
  idLabel:{fontSize:9,color:'#444',fontFamily:mono,letterSpacing:3},
  idValue:{fontSize:28,fontWeight:800,fontFamily:mono,letterSpacing:4,color:'#fff',marginTop:2},
  idBadge:{padding:'5px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid #222',color:'#666',fontSize:12,fontWeight:700,fontFamily:mono},
  tag:{fontSize:10,fontWeight:700,padding:'3px 10px',border:'1px solid',fontFamily:mono,letterSpacing:1},
  linkBtn:{background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:11,fontFamily:mono,padding:0,letterSpacing:1},
  dirCard:{background:'#111',border:'1px solid #222',borderLeft:'3px solid #444',marginBottom:8,overflow:'hidden'},
  prioLabel:{fontSize:9,fontFamily:mono,color:'#444',letterSpacing:2},
  statusTag:{fontSize:9,fontWeight:700,fontFamily:mono,padding:'3px 10px',letterSpacing:1},
  specName:{fontSize:13,fontWeight:700,lineHeight:1.35,marginBottom:4},
  instName:{fontSize:11,color:'#555',marginBottom:14},
  statsGrid:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:'#222',overflow:'hidden'},
  statCell:{background:'#0e0e0e',padding:'12px 8px',textAlign:'center'},
  statLabel:{fontSize:8,color:'#444',letterSpacing:2,fontFamily:mono,marginBottom:4},
  statValue:{fontSize:22,fontWeight:800,color:'#fff',fontFamily:mono},
  statSub:{fontSize:9,color:'#333',fontFamily:mono,marginTop:2},
  dotLabel:{display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:600},
  dotSmall:{width:6,height:6,borderRadius:'50%',display:'inline-block'},
  expandBtn:{marginTop:12,width:'100%',padding:'8px',background:'#0e0e0e',border:'1px solid #222',color:'#555',cursor:'pointer',fontSize:10,fontFamily:mono,letterSpacing:2},
}

const matrixCols=(()=>{
  const c='0123456789:.*=#@$!+'.split('')
  return Array.from({length:40}).map((_,i)=>{
    const half=Array.from({length:60}).map(()=>c[Math.floor(Math.random()*c.length)]).join('\n')
    return {
      text:half+'\n'+half,
      left:(i/40)*100,
      dur:25+Math.random()*20,
      delay:Math.random()*45,
      isFlash:i%3===0,
      flashDur:4+Math.random()*8,
      flashDelay:Math.random()*10,
    }
  })
})()

function MatrixBg(){
  return<div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',zIndex:0,overflow:'hidden',pointerEvents:'none'}}>
    <style>{`
      @keyframes rain{0%{transform:translateY(-50%)}100%{transform:translateY(0)};}
      @keyframes flash{0%,100%{opacity:0.06}50%{opacity:0.3}}
    `}</style>
    {matrixCols.map((m,i)=>
      <pre key={i} style={{
        position:'absolute',
        left:`${m.left}%`,
        top:0,
        margin:0,
        fontFamily:mono,
        fontSize:11,
        lineHeight:'1.6em',
        color:'#fff',
        opacity:m.isFlash?undefined:0.06,
        animation:m.isFlash
          ?`rain ${m.dur}s linear -${m.delay}s infinite, flash ${m.flashDur}s ease-in-out -${m.flashDelay}s infinite`
          :`rain ${m.dur}s linear -${m.delay}s infinite`,
        pointerEvents:'none',
        userSelect:'none',
        width:'1ch',
        overflow:'hidden',
        height:'200vh',
      }}>{m.text}</pre>
    )}
  </div>
}
