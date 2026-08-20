'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'

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

const t={bg:'#09090b',s1:'#111113',s2:'#18181b',bdr:'#27272a',bdrH:'#3f3f46',
  txt:'#fafafa',sub:'#a1a1aa',dim:'#52525b',dimmer:'#3f3f46',
  acc:'#a78bfa',accSoft:'rgba(167,139,250,0.1)',accBdr:'rgba(167,139,250,0.3)',
  grn:'#34d399',grnBg:'rgba(52,211,153,0.08)',grnBdr:'rgba(52,211,153,0.25)',
  red:'#f87171',redBg:'rgba(248,113,113,0.08)',
  amb:'#fbbf24',ambBg:'rgba(251,191,36,0.08)',
  cyn:'#22d3ee',blue:'#60a5fa'}
const mono="'JetBrains Mono','SF Mono','Fira Code',monospace"
const sans="'Inter',-apple-system,sans-serif"

function BgAnim(){
  return <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:0,overflow:'hidden',pointerEvents:'none'}}>
    <style>{`
      @keyframes drift{0%{opacity:0.03}50%{opacity:0.06}100%{opacity:0.03}}
      .ascii-bg{position:absolute;font-family:${mono};font-size:10px;color:#a78bfa;white-space:pre;line-height:1.6;animation:drift 8s ease-in-out infinite}
    `}</style>
    {Array.from({length:12}).map((_,i)=>{
      const chars='01░▒▓█╔╗╚╝═║'.split('')
      const col=Array.from({length:40}).map(()=>chars[Math.floor(Math.random()*chars.length)]).join('\n')
      const left=(i/12)*100
      const delay=i*0.7
      return <div key={i} className="ascii-bg" style={{left:`${left}%`,top:0,bottom:0,animationDelay:`${delay}s`,opacity:0.04}}>{col}</div>
    })}
  </div>
}

export default function Page(){
  const [data,setData]=useState<Data|null>(null)
  const [loading,setLoading]=useState(true)
  const [query,setQuery]=useState('')
  const [activeId,setActiveId]=useState('')
  const [expandedIdx,setExpandedIdx]=useState<number|null>(null)
  const [listMode,setListMode]=useState<'consent'|'full'>('consent')
  const [savedIds,setSavedIds]=useState<string[]>([])

  useEffect(()=>{
    fetch('/data/latest.json').then(r=>r.json()).then(d=>{setData(d);setLoading(false)})
      .catch(()=>fetch('/api/data').then(r=>r.json()).then(d=>{setData(d);setLoading(false)}).catch(()=>setLoading(false)))
  },[])
  useEffect(()=>{try{const s=localStorage.getItem('tiu_ids');if(s)setSavedIds(JSON.parse(s))}catch{}},[])

  const toggleSave=useCallback((id:string)=>{
    setSavedIds(p=>{const n=p.includes(id)?p.filter(x=>x!==id):[...p,id];try{localStorage.setItem('tiu_ids',JSON.stringify(n))}catch{};return n})
  },[])
  const doSearch=useCallback((id:string)=>{if(id.trim().length>=3){setActiveId(id.trim());setExpandedIdx(null);setListMode('consent')}},[])

  const results=useMemo<Found[]|null>(()=>{
    if(!activeId||!data)return null
    const found:Found[]=[]
    for(const lst of data.lists){
      for(const a of lst.applicants){
        if(a.uid===activeId){
          // Consent list directly from TIU API — no filtering
          const consentList=lst.consent_applicants||[]
          const cp=consentList.findIndex(x=>x.uid===activeId)
          found.push({...a,institute:lst.institute,specialty:lst.specialty,
            budget_seats:lst.budget_seats,total_seats:lst.total_seats,contract_seats:lst.contract_seats,
            full_count:lst.applicants.length,consent_count:consentList.length,
            consent_pos:cp>=0?cp+1:0,full:lst.applicants,consent:consentList})
          break
        }
      }
      if(!found.find(f=>f.specialty===lst.specialty)){
        const consentList=lst.consent_applicants||[]
        for(const a of consentList){
          if(a.uid===activeId){
            const cp=consentList.findIndex(x=>x.uid===activeId)
            found.push({...a,institute:lst.institute,specialty:lst.specialty,
              budget_seats:lst.budget_seats,total_seats:lst.total_seats,contract_seats:lst.contract_seats,
              full_count:lst.applicants.length,consent_count:consentList.length,
              consent_pos:cp>=0?cp+1:0,full:lst.applicants,consent:consentList})
            break
          }
        }
      }
    }
    found.sort((a,b)=>a.priority-b.priority)
    return found
  },[activeId,data])

  if(loading)return<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',fontFamily:mono,color:t.dim}}>
    <BgAnim/><span style={{position:'relative',zIndex:1}}>Загрузка...</span></div>

  const ts=data?.scraped_at?new Date(data.scraped_at).toLocaleString('ru-RU'):null

  return(
    <div style={{fontFamily:sans,background:t.bg,color:t.txt,minHeight:'100vh',position:'relative'}}>
      <BgAnim/>
      <div style={{position:'relative',zIndex:1,maxWidth:640,margin:'0 auto'}}>

      {/* Header */}
      <header style={{padding:'28px 20px 0',textAlign:'center'}}>
        <div style={{fontFamily:mono,fontWeight:800,fontSize:30,letterSpacing:4}}>
          <span style={{color:t.acc}}>TIU</span><span style={{color:t.dimmer}}> // </span><span style={{color:t.sub}}>TRACKER</span>
        </div>
        <p style={{color:t.dimmer,fontSize:10,fontFamily:mono,marginTop:6,letterSpacing:2}}>MONITORING SYSTEM v2.0</p>
        {ts&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:6,marginTop:10,fontSize:11,color:t.dim}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:t.grn,display:'inline-block',boxShadow:'0 0 6px '+t.grn}}/>
          {ts}
        </div>}
      </header>

      {/* Search */}
      <div style={{padding:'24px 16px 8px'}}>
        <div style={{display:'flex',border:`1px solid ${activeId&&results?.length?t.grnBdr:t.bdr}`,borderRadius:8,overflow:'hidden',background:t.s1,transition:'border-color 0.3s'}}>
          <input type="text" inputMode="numeric" value={query} maxLength={7}
            onChange={e=>{const v=e.target.value.replace(/\D/g,'').slice(0,7);setQuery(v)}}
            onKeyDown={e=>e.key==='Enter'&&doSearch(query)}
            placeholder="0000000"
            style={{flex:1,padding:'16px',background:'transparent',border:'none',outline:'none',color:t.txt,fontSize:20,fontFamily:mono,letterSpacing:4,minWidth:0,textAlign:'center',width:'100%'}}
          />
          <button onClick={()=>doSearch(query)}
            style={{padding:'16px 24px',background:t.acc,border:'none',color:'#000',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:mono,letterSpacing:1}}>
            FIND
          </button>
        </div>
      </div>

      {/* Landing */}
      {!activeId&&(
        <div style={{padding:'30px 20px',textAlign:'center'}}>
          <pre style={{fontFamily:mono,fontSize:11,color:t.dimmer,lineHeight:1.5,margin:'0 auto 20px'}}>{`
  ╔══════════════════════════╗
  ║   ENTER YOUR ID ABOVE   ║
  ║   TO CHECK ALL ENTRIES   ║
  ╚══════════════════════════╝`}</pre>
          <p style={{color:t.dim,fontSize:13,lineHeight:1.7,maxWidth:340,margin:'0 auto'}}>
            Уникальный идентификатор из Сервиса Приёма
          </p>
          {savedIds.length>0&&(
            <div style={{marginTop:24,textAlign:'left'}}>
              <div style={{fontSize:10,color:t.dimmer,fontFamily:mono,letterSpacing:2,marginBottom:8}}>SAVED IDS</div>
              {savedIds.map(id=>(
                <div key={id} onClick={()=>{setQuery(id);doSearch(id)}}
                  style={{display:'flex',alignItems:'center',gap:8,background:t.s1,border:`1px solid ${t.bdr}`,borderRadius:6,padding:'10px 14px',marginBottom:4,cursor:'pointer',transition:'border-color 0.2s'}}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor=t.acc)}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor=t.bdr)}>
                  <span style={{fontFamily:mono,fontSize:15,fontWeight:700,color:t.acc,letterSpacing:2,flex:1}}>{id}</span>
                  <button onClick={e=>{e.stopPropagation();toggleSave(id)}}
                    style={{background:'none',border:'none',color:t.dim,cursor:'pointer',fontSize:13}}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Not found */}
      {activeId&&results?.length===0&&(
        <div style={{padding:'40px 20px',textAlign:'center'}}>
          <pre style={{fontFamily:mono,fontSize:11,color:t.dim}}>{`[ERR] ID ${activeId} NOT FOUND`}</pre>
          <button onClick={()=>{setActiveId('');setQuery('')}}
            style={{marginTop:16,padding:'8px 20px',background:t.s1,border:`1px solid ${t.bdr}`,borderRadius:6,color:t.sub,cursor:'pointer',fontSize:12,fontFamily:mono}}>← BACK</button>
        </div>
      )}

      {/* Results */}
      {results&&results.length>0&&(
        <div style={{padding:'4px 16px 32px'}}>

          {/* ID card */}
          <div style={{background:t.s1,border:`1px solid ${t.bdr}`,borderRadius:10,padding:'18px',marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:9,color:t.dimmer,fontFamily:mono,letterSpacing:2}}>IDENTIFIER</div>
                <div style={{fontSize:26,fontWeight:800,fontFamily:mono,letterSpacing:3,color:t.acc,marginTop:2}}>{activeId}</div>
              </div>
              <div style={{padding:'5px 12px',borderRadius:6,background:t.accSoft,border:`1px solid ${t.accBdr}`,color:t.acc,fontSize:13,fontWeight:700,fontFamily:mono}}>
                {results.length} напр.
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
              {(()=>{
                const pass=results.filter(r=>r.consent_pos>0&&r.consent_pos<=r.budget_seats).length
                const edge=results.filter(r=>r.consent_pos>0&&r.consent_pos>r.budget_seats&&r.consent_pos<=r.budget_seats+3).length
                const no=results.filter(r=>r.consent_pos===0).length
                return<>
                  {pass>0&&<Tag bg={t.grnBg} c={t.grn} b={t.grnBdr}>PASS: {pass}</Tag>}
                  {edge>0&&<Tag bg={t.ambBg} c={t.amb} b="rgba(251,191,36,0.25)">EDGE: {edge}</Tag>}
                  {no>0&&<Tag bg={t.redBg} c={t.red} b="rgba(248,113,113,0.25)">NO CONSENT: {no}</Tag>}
                </>
              })()}
            </div>
            <div style={{display:'flex',gap:12,marginTop:14}}>
              <button onClick={()=>{setActiveId('');setQuery('')}} style={{background:'none',border:'none',color:t.acc,cursor:'pointer',fontSize:11,fontFamily:mono,padding:0}}>← BACK</button>
              <button onClick={()=>toggleSave(activeId)} style={{background:'none',border:'none',color:savedIds.includes(activeId)?t.amb:t.dim,cursor:'pointer',fontSize:11,fontFamily:mono,padding:0}}>
                {savedIds.includes(activeId)?'★ SAVED':'☆ SAVE'}
              </button>
            </div>
          </div>

          {/* Cards */}
          {results.map((r,i)=>{
            const pass=r.consent_pos>0&&r.consent_pos<=r.budget_seats
            const edge=r.consent_pos>0&&r.consent_pos>r.budget_seats&&r.consent_pos<=r.budget_seats+3
            const accent=pass?t.grn:edge?t.amb:r.consent_pos===0?t.dim:t.red
            const status=pass?'PASS':edge?'EDGE':r.consent_pos===0?'NO CONSENT':'FAIL'
            const expanded=expandedIdx===i

            return(
              <div key={i} style={{background:t.s1,border:`1px solid ${pass?t.grnBdr:edge?'rgba(251,191,36,0.25)':t.bdr}`,borderLeft:`3px solid ${accent}`,borderRadius:8,marginBottom:10,overflow:'hidden',transition:'border-color 0.3s'}}>
                <div style={{padding:'16px 18px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{fontSize:9,fontFamily:mono,color:t.dimmer,letterSpacing:2}}>PRIORITY {r.priority}</div>
                    <div style={{fontSize:9,fontWeight:700,fontFamily:mono,padding:'3px 10px',borderRadius:3,background:pass?t.grnBg:edge?t.ambBg:t.redBg,color:accent,letterSpacing:1}}>{status}</div>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,lineHeight:1.35,marginBottom:4}}>{r.specialty}</div>
                  <div style={{fontSize:11,color:t.dim,marginBottom:14}}>{r.institute}</div>

                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:t.bdr,borderRadius:6,overflow:'hidden'}}>
                    <S label="ПОЗИЦИЯ" value={r.consent_pos||'—'} sub={`из ${r.consent_count}`} color={accent} />
                    <S label="БАЛЛЫ" value={r.total_score} sub={`${r.vi_score}+${r.id_score}`} color={t.cyn} />
                    <S label="БЮДЖЕТ" value={r.budget_seats} sub={`всего ${r.total_seats}`} color={t.sub} />
                  </div>

                  <div style={{display:'flex',justifyContent:'space-between',marginTop:12}}>
                    <div style={{display:'flex',gap:12}}>
                      <Dot on={r.has_consent} label="Согласие"/>
                      <Dot on={r.vi_score>0} label="ВИ"/>
                    </div>
                    <span style={{fontSize:10,color:t.dimmer,fontFamily:mono}}>общ. #{r.position}/{r.full_count}</span>
                  </div>

                  <button onClick={()=>{setExpandedIdx(expanded?null:i);setListMode('consent')}}
                    style={{marginTop:12,width:'100%',padding:'8px',background:t.s2,border:`1px solid ${t.bdr}`,borderRadius:5,color:t.sub,cursor:'pointer',fontSize:10,fontFamily:mono,letterSpacing:1,transition:'border-color 0.2s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=t.acc}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=t.bdr}>
                    {expanded?'HIDE ▲':'SHOW LIST ▼'}
                  </button>
                </div>

                {expanded&&(
                  <div style={{borderTop:`1px solid ${t.bdr}`,overflowX:'auto'}}>
                    <div style={{display:'flex',borderBottom:`1px solid ${t.bdr}`}}>
                      {([{k:'consent' as const,l:`С согласием (${r.consent.length})`},{k:'full' as const,l:`Полный (${r.full.length})`}]).map(tab=>(
                        <button key={tab.k} onClick={()=>setListMode(tab.k)}
                          style={{flex:1,padding:'8px',fontSize:10,fontFamily:mono,border:'none',cursor:'pointer',letterSpacing:1,
                            background:listMode===tab.k?t.s2:t.s1,
                            color:listMode===tab.k?(tab.k==='consent'?t.grn:t.acc):t.dim,
                            borderBottom:listMode===tab.k?`2px solid ${tab.k==='consent'?t.grn:t.acc}`:'2px solid transparent'}}>
                          {tab.l}
                        </button>
                      ))}
                    </div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,fontFamily:mono}}>
                      <thead><tr style={{background:t.s2}}>
                        {['№','ID','ВИ','ИД','Σ','ПР.',listMode==='full'?'СОГЛ.':null].filter(Boolean).map((h,j)=>(
                          <th key={j} style={{padding:'8px 6px',textAlign:j===1?'left':'center',color:t.dimmer,fontSize:8,fontWeight:600,letterSpacing:1,borderBottom:`1px solid ${t.bdr}`}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {(listMode==='consent'?r.consent:r.full).map((a,j)=>{
                          const isMe=a.uid===activeId
                          const pos=listMode==='consent'?j+1:a.position
                          const rp=r.budget_seats>0&&pos<=r.budget_seats
                          return(
                            <tr key={j} style={{background:isMe?t.accSoft:rp?'rgba(52,211,153,0.03)':'transparent',borderBottom:`1px solid ${t.bdr}`,transition:'background 0.15s'}}>
                              <td style={{padding:'6px',textAlign:'center',fontWeight:700,color:isMe?t.acc:rp?t.grn:t.dim}}>{pos}</td>
                              <td style={{padding:'6px',fontWeight:isMe?800:400,color:isMe?t.cyn:t.txt}}>
                                {a.uid}{isMe&&<span style={{color:t.acc,fontSize:8,marginLeft:6}}>← YOU</span>}
                              </td>
                              <td style={{padding:'6px',textAlign:'center',color:a.vi_score>0?t.sub:t.dimmer}}>{a.vi_score||'—'}</td>
                              <td style={{padding:'6px',textAlign:'center',color:t.sub}}>{a.id_score}</td>
                              <td style={{padding:'6px',textAlign:'center',fontWeight:700,color:t.cyn}}>{a.total_score}</td>
                              <td style={{padding:'6px',textAlign:'center',color:t.sub}}>{a.priority}</td>
                              {listMode==='full'&&<td style={{padding:'6px',textAlign:'center',color:a.has_consent?t.grn:t.dimmer}}>{a.has_consent?'✓':'—'}</td>}
                            </tr>)
                        })}
                      </tbody>
                    </table>
                    <div style={{padding:'6px',fontSize:9,fontFamily:mono,background:t.s2,color:t.dimmer,textAlign:'center',borderTop:`1px solid ${t.bdr}`,letterSpacing:1}}>
                      BUDGET: {r.budget_seats} · CONTRACT: {r.contract_seats} · TOTAL: {r.total_seats}
                    </div>
                  </div>
                )}
              </div>)
          })}
          <div style={{textAlign:'center',fontSize:9,color:t.dimmer,fontFamily:mono,marginTop:16,letterSpacing:1}}>
            {ts&&`DATA: ${ts}`}
          </div>
        </div>
      )}
      <footer style={{textAlign:'center',padding:'20px 16px 32px',fontSize:9,color:t.dimmer,fontFamily:mono,borderTop:`1px solid ${t.bdr}`,marginTop:20,letterSpacing:2}}>
        TIU TRACKER // incoming.tyuiu.ru
      </footer>
      </div>
    </div>)
}

function Tag({children,bg,c,b}:{children:React.ReactNode;bg:string;c:string;b:string}){
  return<span style={{fontSize:10,fontWeight:700,padding:'3px 10px',borderRadius:4,background:bg,color:c,border:`1px solid ${b}`,fontFamily:"'JetBrains Mono',monospace",letterSpacing:1}}>{children}</span>
}
function S({label,value,sub,color}:{label:string;value:number|string;sub?:string;color?:string}){
  return<div style={{background:'#111113',padding:'12px 8px',textAlign:'center'}}>
    <div style={{fontSize:8,color:'#3f3f46',letterSpacing:2,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>{label}</div>
    <div style={{fontSize:22,fontWeight:800,color:color||'#fafafa',fontFamily:"'JetBrains Mono',monospace"}}>{value}</div>
    {sub&&<div style={{fontSize:9,color:'#3f3f46',fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>{sub}</div>}
  </div>
}
function Dot({on,label}:{on:boolean;label:string}){
  return<div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:on?'#34d399':'#3f3f46',fontWeight:on?600:400}}>
    <span style={{width:6,height:6,borderRadius:'50%',background:on?'#34d399':'#3f3f46',opacity:on?1:0.4,boxShadow:on?'0 0 6px #34d399':'none'}}/>
    {label}
  </div>
}
