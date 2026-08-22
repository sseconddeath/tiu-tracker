'use client'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'

const MONO="'JetBrains Mono','SF Mono','Fira Code',monospace"

interface Applicant { position:number;uid:string;vi_score:number;id_score:number;total_score:number;admission_type:string;priority:number;has_consent:boolean }
interface CompList { institute:string;education_form:string;category:string;specialty:string;total_seats:number;budget_seats:number;contract_seats:number;applicants:Applicant[];consent_applicants:Applicant[] }
interface Data { scraped_at:string|null;total_lists:number;total_applicants:number;lists:CompList[] }
interface Found extends Applicant { institute:string;specialty:string;budget_seats:number;total_seats:number;contract_seats:number;full_count:number;consent_count:number;consent_pos:number;full:Applicant[];consent:Applicant[] }
interface SavedId { id:string;label:string }

function MatrixBg(){
  const ref=useRef<HTMLCanvasElement>(null)
  useEffect(()=>{
    const c=ref.current;if(!c)return
    const ctx=c.getContext('2d');if(!ctx)return
    let W=window.innerWidth,H=window.innerHeight;c.width=W;c.height=H
    const fs=13,cw=12,cols=Math.ceil(W/cw),tl=12
    const chars='0123456789ABCDEF@#$%&*:;+=!'.split('')
    const drops=Array.from({length:cols},()=>Math.random()*(H/fs+tl)-tl)
    const trail:string[][]=Array.from({length:cols},()=>Array.from({length:tl},()=>chars[Math.floor(Math.random()*chars.length)]))
    let last=0,id=0
    const draw=(t:number)=>{
      if(t-last<33){id=requestAnimationFrame(draw);return}
      last=t;ctx.fillStyle='#0a0a0a';ctx.fillRect(0,0,W,H);ctx.font=fs+'px monospace'
      for(let i=0;i<cols;i++){
        const x=i*cw,hy=Math.floor(drops[i])
        for(let j=tl-1;j>=0;j--){const cy=(hy-j)*fs;if(cy<-fs||cy>H+fs)continue;const b=1-j/tl;const g=Math.floor(60+160*b);ctx.fillStyle=`rgba(${g},${g},${g},${(.06+.35*b).toFixed(2)})`;ctx.fillText(trail[i][j],x,cy)}
        const yy=hy*fs;if(yy>-fs&&yy<H+fs){ctx.fillStyle='rgba(255,255,255,0.9)';ctx.fillText(chars[Math.floor(Math.random()*chars.length)],x,yy)}
        drops[i]+=.12;if(hy*fs>H+tl*fs){drops[i]=Math.random()*-30;for(let j=0;j<tl;j++)trail[i][j]=chars[Math.floor(Math.random()*chars.length)]}
      }
      id=requestAnimationFrame(draw)
    }
    id=requestAnimationFrame(draw)
    const rs=()=>{W=innerWidth;H=innerHeight;c.width=W;c.height=H}
    window.addEventListener('resize',rs)
    return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',rs)}
  },[])
  return <canvas ref={ref} style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',zIndex:0,pointerEvents:'none',opacity:.4}}/>
}

const CSS=`
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes glow{0%,100%{text-shadow:0 0 5px rgba(255,255,255,0.1)}50%{text-shadow:0 0 20px rgba(255,255,255,0.15)}}
@keyframes glitch{0%{clip-path:inset(40% 0 61% 0)}20%{clip-path:inset(92% 0 1% 0)}40%{clip-path:inset(43% 0 1% 0)}60%{clip-path:inset(25% 0 58% 0)}80%{clip-path:inset(54% 0 7% 0)}100%{clip-path:inset(58% 0 43% 0)}}
.blink{animation:blink 1s infinite}
.glitch{position:relative;animation:glow 4s ease-in-out infinite}
.glitch::before,.glitch::after{content:attr(data-text);position:absolute;top:0;left:0;width:100%;height:100%}
.glitch::before{animation:glitch 3s infinite linear alternate-reverse;color:rgba(255,255,255,0.03);left:2px}
.glitch::after{animation:glitch 2s infinite linear alternate;color:rgba(255,255,255,0.03);left:-2px}
.chov{transition:border-color .3s}.chov:hover{border-color:#444!important}
.rhov:hover{background:rgba(255,255,255,0.03)!important}
::selection{background:rgba(255,255,255,0.15)}
input::placeholder{color:#333}
`

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

  useEffect(()=>{fetch('/data/latest.json').then(r=>r.json()).then(d=>{setData(d);setLoading(false)}).catch(()=>fetch('/api/data').then(r=>r.json()).then(d=>{setData(d);setLoading(false)}).catch(()=>setLoading(false)))},[])
  useEffect(()=>{try{const s=localStorage.getItem('tiu_ids2');if(s)setSavedIds(JSON.parse(s))}catch{}},[])
  useEffect(()=>{if(editingId&&editRef.current)editRef.current.focus()},[editingId])

  const persist=(n:SavedId[])=>{try{localStorage.setItem('tiu_ids2',JSON.stringify(n))}catch{}}
  const toggleSave=useCallback((id:string)=>setSavedIds(p=>{const n=p.find(x=>x.id===id)?p.filter(x=>x.id!==id):[...p,{id,label:''}];persist(n);return n}),[])
  const updateLabel=useCallback((id:string,l:string)=>setSavedIds(p=>{const n=p.map(x=>x.id===id?{...x,label:l}:x);persist(n);return n}),[])
  const doSearch=useCallback((id:string)=>{if(id.trim().length>=3){setActiveId(id.trim());setExpandedIdx(null);setListMode('consent')}},[])

  const results=useMemo<Found[]|null>(()=>{
    if(!activeId||!data)return null
    const f:Found[]=[]
    for(const l of data.lists){
      for(const a of l.applicants){
        if(a.uid===activeId){const cl=l.consent_applicants||[];const cp=cl.findIndex(x=>x.uid===activeId);f.push({...a,institute:l.institute,specialty:l.specialty,budget_seats:l.budget_seats,total_seats:l.total_seats,contract_seats:l.contract_seats,full_count:l.applicants.length,consent_count:cl.length,consent_pos:cp>=0?cp+1:0,full:l.applicants,consent:cl});break}
      }
      if(!f.find(x=>x.specialty===l.specialty)){const cl=l.consent_applicants||[];for(const a of cl){if(a.uid===activeId){const cp=cl.findIndex(x=>x.uid===activeId);f.push({...a,institute:l.institute,specialty:l.specialty,budget_seats:l.budget_seats,total_seats:l.total_seats,contract_seats:l.contract_seats,full_count:l.applicants.length,consent_count:cl.length,consent_pos:cp>=0?cp+1:0,full:l.applicants,consent:cl});break}}}
    }
    f.sort((a,b)=>a.priority-b.priority);return f
  },[activeId,data])

  const sLabel=savedIds.find(x=>x.id===activeId)?.label||''
  if(loading)return<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'#0a0a0a'}}><style>{CSS}</style><MatrixBg/><span style={{position:'relative',zIndex:1,fontFamily:MONO,fontSize:14,color:'#555',letterSpacing:3}}>INITIALIZING<span className="blink">_</span></span></div>
  const ts=data?.scraped_at?new Date(data.scraped_at).toLocaleString('ru-RU'):null

  return(
  <div style={{fontFamily:"'Inter',-apple-system,sans-serif",background:'#0a0a0a',color:'#f5f5f5',minHeight:'100vh',position:'relative'}}>
    <style>{CSS}</style>
    <MatrixBg/>
    <div style={{position:'relative',zIndex:2,maxWidth:640,margin:'0 auto'}}>

    {/* Header */}
    <header style={{padding:'28px 20px 0',textAlign:'center'}}>
      <div className="glitch" data-text="ТИУ://ТРЕКЕР" style={{fontFamily:MONO,fontWeight:800,fontSize:26,letterSpacing:3,color:'#fff'}}>ТИУ://ТРЕКЕР</div>
      <p style={{color:'#333',fontSize:9,fontFamily:MONO,marginTop:8,letterSpacing:3}}>СИСТЕМА МОНИТОРИНГА КОНКУРСНЫХ СПИСКОВ</p>
      {ts&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:6,marginTop:10,fontSize:11,color:'#444',fontFamily:MONO}}><span style={{width:5,height:5,borderRadius:'50%',background:'#4ade80',display:'inline-block',boxShadow:'0 0 8px #4ade80'}}/>SYNC: {ts} МСК</div>}
    </header>

    {/* Search */}
    <div style={{padding:'24px 16px 8px'}}>
      <div className="chov" style={{display:'flex',alignItems:'stretch',border:'1px solid '+(activeId&&results?.length?'rgba(74,222,128,0.3)':'#333'),borderRadius:4,overflow:'hidden',background:'#111'}}>
        <span style={{padding:'14px 0 14px 14px',color:'#555',fontFamily:MONO,fontSize:14,fontWeight:700,display:'flex',alignItems:'center'}}>&gt;_</span>
        <input type="text" inputMode="numeric" value={query} maxLength={7} onChange={e=>setQuery(e.target.value.replace(/\D/g,'').slice(0,7))} onKeyDown={e=>e.key==='Enter'&&doSearch(query)} placeholder="ВВЕДИТЕ ID"
          style={{flex:1,padding:'14px 10px',background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:18,fontFamily:MONO,letterSpacing:3,minWidth:0}}/>
        <button onClick={()=>doSearch(query)} style={{padding:'0 24px',background:'#fff',border:'none',color:'#000',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:MONO,letterSpacing:2,display:'flex',alignItems:'center'}}>ПОИСК</button>
      </div>
    </div>

    {/* Landing */}
    {!activeId&&<div style={{padding:'30px 20px',textAlign:'center'}}>
      <pre style={{fontFamily:MONO,fontSize:11,color:'#333',lineHeight:1.5,textAlign:'center',margin:'0 auto 16px',display:'inline-block'}}>{`╔══════════════════════════════╗
║  ВВЕДИТЕ 7-ЗНАЧНЫЙ          ║
║  ИДЕНТИФИКАТОР ИЗ            ║
║  СЕРВИСА ПРИЁМА              ║
╠══════════════════════════════╣
║  > ОТСЛЕЖИВАНИЕ НАПРАВЛЕНИЙ ║
║  > СПИСКИ С СОГЛАСИЯМИ      ║
║  > МОНИТОРИНГ МЕСТ          ║
╚══════════════════════════════╝`}</pre>
      {savedIds.length>0&&<div style={{marginTop:24,textAlign:'left'}}>
        <div style={{fontSize:10,color:'#444',fontFamily:MONO,letterSpacing:2,marginBottom:10}}>&gt; СОХРАНЁННЫЕ ЗАПИСИ</div>
        {savedIds.map(s=><div key={s.id} className="chov" onClick={()=>{if(editingId!==s.id){setQuery(s.id);doSearch(s.id)}}} style={{display:'flex',alignItems:'center',gap:8,background:'#111',border:'1px solid #222',padding:'10px 14px',marginBottom:2,cursor:'pointer'}}>
          <span style={{fontFamily:MONO,fontSize:14,fontWeight:700,color:'#fff',letterSpacing:2,flex:1}}>{s.id}</span>
          {editingId===s.id?<input ref={editRef} value={s.label} placeholder="Имя..." onClick={e=>e.stopPropagation()} onChange={e=>updateLabel(s.id,e.target.value)} onBlur={()=>setEditingId(null)} onKeyDown={e=>e.key==='Enter'&&setEditingId(null)} style={{padding:'4px 8px',background:'#1a1a1a',border:'1px solid #333',color:'#fff',fontSize:12,fontFamily:MONO,outline:'none'}}/>
          :s.label?<span style={{fontSize:12,color:'#666',cursor:'pointer'}} onClick={e=>{e.stopPropagation();setEditingId(s.id)}}>{s.label}</span>
          :<span style={{fontSize:11,color:'#333',fontFamily:MONO,cursor:'pointer'}} onClick={e=>{e.stopPropagation();setEditingId(s.id)}}>+ подпись</span>}
          <button onClick={e=>{e.stopPropagation();toggleSave(s.id)}} style={{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:13}}>✕</button>
        </div>)}
      </div>}
    </div>}

    {/* Not found */}
    {activeId&&results?.length===0&&<div style={{padding:'40px 20px',textAlign:'center',fontFamily:MONO}}>
      <pre style={{color:'#f87171',fontSize:12}}>[!] ID {activeId} НЕ НАЙДЕН</pre>
      <button onClick={()=>{setActiveId('');setQuery('')}} style={{marginTop:16,padding:'8px 20px',background:'#111',border:'1px solid #222',color:'#666',cursor:'pointer',fontSize:11,fontFamily:MONO}}>← НАЗАД</button>
    </div>}

    {/* Results */}
    {results&&results.length>0&&<div style={{padding:'4px 16px 32px'}}>
      {/* ID card */}
      <div style={{background:'#111',border:'1px solid #222',borderRadius:0,padding:'18px',marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:9,color:'#444',fontFamily:MONO,letterSpacing:3}}>ИДЕНТИФИКАТОР</div>
            <div className="glitch" data-text={activeId} style={{fontSize:28,fontWeight:800,fontFamily:MONO,letterSpacing:4,color:'#fff',marginTop:2}}>{activeId}</div>
            {sLabel&&<div style={{fontSize:12,color:'#888',marginTop:2}}>{sLabel}</div>}
          </div>
          <div style={{padding:'5px 12px',background:'rgba(255,255,255,0.04)',border:'1px solid #222',color:'#666',fontSize:12,fontWeight:700,fontFamily:MONO}}>{results.length} напр.</div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
          {(()=>{const p=results.filter(r=>r.consent_pos>0&&r.consent_pos<=r.budget_seats).length,e=results.filter(r=>r.consent_pos>0&&r.consent_pos>r.budget_seats&&r.consent_pos<=r.budget_seats+3).length,fl=results.filter(r=>r.consent_pos>0&&r.consent_pos>r.budget_seats+3).length,n=results.filter(r=>r.consent_pos===0).length;return<>
            {p>0&&<Tg c="#4ade80" bg="rgba(74,222,128,0.1)">ПРОХОДИТ: {p}</Tg>}
            {e>0&&<Tg c="#fbbf24" bg="rgba(251,191,36,0.1)">НА ГРАНИ: {e}</Tg>}
            {fl>0&&<Tg c="#f87171" bg="rgba(248,113,113,0.1)">НЕ ПРОХОДИТ: {fl}</Tg>}
            {n>0&&<Tg c="#666" bg="rgba(255,255,255,0.03)">НЕТ В СПИСКЕ: {n}</Tg>}
          </>})()}
        </div>
        <div style={{display:'flex',gap:12,marginTop:14}}>
          <button onClick={()=>{setActiveId('');setQuery('')}} style={{background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:11,fontFamily:MONO}}>← НАЗАД</button>
          <button onClick={()=>toggleSave(activeId)} style={{background:'none',border:'none',color:savedIds.find(x=>x.id===activeId)?'#fbbf24':'#555',cursor:'pointer',fontSize:11,fontFamily:MONO}}>{savedIds.find(x=>x.id===activeId)?'★ СОХРАНЁН':'☆ СОХРАНИТЬ'}</button>
          {savedIds.find(x=>x.id===activeId)&&!editingId&&<button onClick={()=>setEditingId(activeId)} style={{background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:11,fontFamily:MONO}}>✎ ПОДПИСЬ</button>}
        </div>
        {editingId===activeId&&<input ref={editRef} value={sLabel} placeholder="Имя или заметка..." onChange={e=>updateLabel(activeId,e.target.value)} onBlur={()=>setEditingId(null)} onKeyDown={e=>e.key==='Enter'&&setEditingId(null)} style={{marginTop:10,width:'100%',padding:'6px 10px',background:'#1a1a1a',border:'1px solid #333',color:'#fff',fontSize:12,fontFamily:MONO,outline:'none'}}/>}
      </div>

      {/* Cards */}
      {results.map((r,i)=>{
        const pass=r.consent_pos>0&&r.consent_pos<=r.budget_seats,edge=r.consent_pos>0&&r.consent_pos>r.budget_seats&&r.consent_pos<=r.budget_seats+3,fail=r.consent_pos>0&&r.consent_pos>r.budget_seats+3,accent=pass?'#4ade80':edge?'#fbbf24':fail?'#f87171':'#444',status=pass?'ПРОХОДИТ':edge?'НА ГРАНИ':fail?'НЕ ПРОХОДИТ':'НЕТ В СПИСКЕ',expanded=expandedIdx===i
        return<div key={i} className="chov" style={{background:'#111',border:'1px solid #222',borderLeft:'3px solid '+accent,marginBottom:8,overflow:'hidden'}}>
          <div style={{padding:'16px 18px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:9,fontFamily:MONO,color:'#444',letterSpacing:2}}>ПРИОРИТЕТ {r.priority}</div>
              <div style={{fontSize:9,fontWeight:700,fontFamily:MONO,padding:'3px 10px',background:pass?'rgba(74,222,128,0.1)':edge?'rgba(251,191,36,0.1)':fail?'rgba(248,113,113,0.1)':'rgba(255,255,255,0.03)',color:accent,letterSpacing:1}}>{status}</div>
            </div>
            <div style={{fontSize:13,fontWeight:700,lineHeight:1.35,marginBottom:4}}>{r.specialty}</div>
            <div style={{fontSize:11,color:'#555',marginBottom:14}}>{r.institute}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:1,background:'#222',overflow:'hidden'}}>
              <SC l="ПОЗИЦИЯ" v={r.consent_pos||'—'} s={'из '+r.consent_count} c={accent}/>
              <SC l="БАЛЛЫ" v={r.total_score} s={`ВИ ${r.vi_score} + ИД ${r.id_score}`} c="#fff"/>
              <SC l="БЮДЖЕТ" v={r.budget_seats} s={'всего '+r.total_seats} c="#888"/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:12}}>
              <div style={{display:'flex',gap:14}}>
                <Dt on={r.has_consent} t="Согласие"/><Dt on={r.vi_score>0} t="ВИ"/>
              </div>
              <span style={{fontSize:10,color:'#333',fontFamily:MONO}}>#{r.position}/{r.full_count}</span>
            </div>
            <button className="chov" onClick={()=>{setExpandedIdx(expanded?null:i);setListMode('consent')}} style={{marginTop:12,width:'100%',padding:'8px',background:'#0e0e0e',border:'1px solid #222',color:'#555',cursor:'pointer',fontSize:10,fontFamily:MONO,letterSpacing:2}}>{expanded?'СКРЫТЬ ▲':'СПИСОК ▼'}</button>
          </div>
          {expanded&&<div style={{borderTop:'1px solid #222',overflowX:'auto'}}>
            <div style={{display:'flex',borderBottom:'1px solid #222'}}>
              {[{k:'consent' as const,l:'С согласием ('+r.consent.length+')'},{k:'full' as const,l:'Полный ('+r.full.length+')'}].map(t=><button key={t.k} onClick={()=>setListMode(t.k)} style={{flex:1,padding:'8px',fontSize:10,fontFamily:MONO,border:'none',cursor:'pointer',letterSpacing:1,background:listMode===t.k?'#1a1a1a':'#111',color:listMode===t.k?'#fff':'#444',borderBottom:listMode===t.k?'1px solid #fff':'1px solid transparent'}}>{t.l}</button>)}
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,fontFamily:MONO}}>
              <thead><tr style={{background:'#141414'}}>{['№','ID','ВИ','ИД','Σ','ПР.',listMode==='full'?'СОГЛ.':null].filter(Boolean).map((h,j)=><th key={j} style={{padding:'8px 6px',textAlign:j===1?'left':'center',color:'#444',fontSize:8,fontWeight:600,letterSpacing:1,borderBottom:'1px solid #222'}}>{h}</th>)}</tr></thead>
              <tbody>{(listMode==='consent'?r.consent:r.full).map((a,j)=>{const me=a.uid===activeId,pos=listMode==='consent'?j+1:a.position,rp=r.budget_seats>0&&pos<=r.budget_seats
                return<tr key={j} className="rhov" style={{borderBottom:'1px solid #1a1a1a',background:me?'rgba(255,255,255,0.04)':rp?'rgba(74,222,128,0.02)':'transparent'}}>
                  <td style={{padding:'6px',textAlign:'center',fontWeight:700,color:me?'#fff':rp?'#4ade80':'#444'}}>{pos}</td>
                  <td style={{padding:'6px',fontWeight:me?800:400,color:me?'#fff':'#ccc'}}>{a.uid}{me&&<span style={{color:'#555',fontSize:8,marginLeft:6}}>← вы</span>}</td>
                  <td style={{padding:'6px',textAlign:'center',color:a.vi_score>0?'#999':'#333'}}>{a.vi_score||'—'}</td>
                  <td style={{padding:'6px',textAlign:'center',color:'#999'}}>{a.id_score}</td>
                  <td style={{padding:'6px',textAlign:'center',fontWeight:700,color:'#fff'}}>{a.total_score}</td>
                  <td style={{padding:'6px',textAlign:'center',color:'#999'}}>{a.priority}</td>
                  {listMode==='full'&&<td style={{padding:'6px',textAlign:'center',color:a.has_consent?'#4ade80':'#333'}}>{a.has_consent?'✓':'—'}</td>}
                </tr>})}</tbody>
            </table>
            <div style={{padding:'6px',fontSize:9,fontFamily:MONO,background:'#111',color:'#333',textAlign:'center',borderTop:'1px solid #222',letterSpacing:1}}>БЮДЖЕТ: {r.budget_seats} · ДОГОВОР: {r.contract_seats} · ВСЕГО: {r.total_seats}</div>
          </div>}
        </div>})}
      <div style={{textAlign:'center',fontSize:9,color:'#333',fontFamily:MONO,marginTop:16,letterSpacing:1}}>{ts&&'SYNC: '+ts+' МСК'}</div>
    </div>}

    <footer style={{textAlign:'center',padding:'20px 16px 40px',fontSize:9,color:'#333',fontFamily:MONO,borderTop:'1px solid #1a1a1a',marginTop:20,letterSpacing:2}}>ТИУ://ТРЕКЕР · incoming.tyuiu.ru</footer>
    </div>
  </div>)
}

function Tg({children,c,bg}:{children:React.ReactNode;c:string;bg:string}){return<span style={{fontSize:10,fontWeight:700,padding:'3px 10px',border:'1px solid '+c+'33',background:bg,color:c,fontFamily:MONO,letterSpacing:1}}>{children}</span>}
function SC({l,v,s,c}:{l:string;v:number|string;s:string;c:string}){return<div style={{background:'#0e0e0e',padding:'12px 8px',textAlign:'center'}}><div style={{fontSize:8,color:'#444',letterSpacing:2,fontFamily:MONO,marginBottom:4}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:c,fontFamily:MONO}}>{v}</div><div style={{fontSize:9,color:'#333',fontFamily:MONO,marginTop:2}}>{s}</div></div>}
function Dt({on,t}:{on:boolean;t:string}){return<div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:on?'#4ade80':'#444',fontWeight:on?600:400}}><span style={{width:6,height:6,borderRadius:'50%',background:on?'#4ade80':'#444',opacity:on?1:.4,boxShadow:on?'0 0 8px #4ade80':'none',display:'inline-block'}}/>{t}</div>}
