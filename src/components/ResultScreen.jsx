import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';

// ── CSS 주입 ──────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('rbb-anim-style')) {
  const style = document.createElement('style');
  style.id = 'rbb-anim-style';
  style.textContent = `
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes fadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes spin { to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(style);
}

// ── ImageViewer ───────────────────────────────────────────
function ImageViewer({ src, title, onClose }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return createPortal(
    <div style={vs.overlay} onClick={onClose}>
      <div style={vs.modal} onClick={e => e.stopPropagation()}>
        <div style={vs.bar}>
          <span style={vs.barTitle}>{title}</span>
          <div style={vs.barBtns}>
            <button style={vs.dlBtn} onClick={() => { const a=document.createElement('a'); a.href=src; a.download=`${(title||'image').replace(/\s/g,'_')}.png`; a.click(); }}>⬇ 다운로드</button>
            <button style={vs.closeBtn} onClick={onClose}>✕ 닫기</button>
          </div>
        </div>
        <img src={src} alt={title} style={vs.img} />
      </div>
    </div>, document.body
  );
}
const vs = {
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
  modal:    { background:'#111827', borderRadius:16, overflow:'hidden', maxWidth:'94vw', maxHeight:'94vh', display:'flex', flexDirection:'column' },
  bar:      { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', background:'#1f2937', borderBottom:'1px solid #374151', flexShrink:0 },
  barTitle: { fontSize:14, fontWeight:700, color:'#f9fafb' },
  barBtns:  { display:'flex', gap:8 },
  dlBtn:    { padding:'7px 18px', borderRadius:8, border:'none', background:'#6366f1', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' },
  closeBtn: { padding:'7px 14px', borderRadius:8, border:'none', background:'#374151', color:'#d1d5db', fontSize:13, fontWeight:700, cursor:'pointer' },
  img:      { maxWidth:'100%', maxHeight:'calc(94vh - 52px)', objectFit:'contain', display:'block' },
};

// ── Toast ─────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return createPortal(
    <div style={{ position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'12px 22px', borderRadius:40, fontSize:13, fontWeight:600, zIndex:99999, display:'flex', alignItems:'center', gap:8, boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>
      <span style={{ fontSize:16 }}>✨</span>{msg}
    </div>, document.body
  );
}

// ── 타이핑 훅 ─────────────────────────────────────────────
function useTypingEffect(text, speed = 80) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayed;
}

// ── 로딩 화면 ─────────────────────────────────────────────
const LOADING_MSGS = [
  '매장 사진을 분석하고 있어요...','현재 브랜드 문제를 진단하고 있어요...',
  '리브랜딩 방향을 설계하고 있어요...','예산별 실행 계획을 수립하고 있어요...',
  '새 브랜드명을 구상하고 있어요...','인테리어 방향을 완성하고 있어요...',
];
function RebrandLoadingScreen() {
  const [idx, setIdx] = useState(0);
  useEffect(() => { const t = setInterval(() => setIdx(i => (i+1) % LOADING_MSGS.length), 2500); return () => clearInterval(t); }, []);
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', gap:24, minHeight:400 }}>
      <div style={{ width:56, height:56, border:'3px solid var(--border)', borderTopColor:'var(--purple-600)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--purple-600)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }}>REBRANDBOSS AI</div>
        <p style={{ fontSize:16, color:'var(--text-primary)', fontWeight:600, margin:0 }}>{LOADING_MSGS[idx]}</p>
        <p style={{ fontSize:13, color:'var(--text-tertiary)', margin:'8px 0 0' }}>보통 30~50초 정도 걸려요 (사진 분석 포함)</p>
      </div>
    </div>
  );
}

// ── ImgPlaceholder ────────────────────────────────────────
function ImgPlaceholderEmpty({ label, onGenerate, errMsg }) {
  return (
    <div style={{ height:140, border:'1.5px dashed #C4B5FD', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background:'linear-gradient(135deg,#faf8ff 0%,#f3f0ff 100%)', cursor:'pointer' }} onClick={onGenerate}>
      <div style={{ fontSize:24, opacity:0.35 }}>🖼</div>
      <div style={{ fontSize:12, color:'#7C3AED', fontWeight:600 }}>{label} 이미지 생성하기</div>
      {errMsg && <div style={{ fontSize:11, color:'#c0392b', marginTop:2 }}>⚠ {errMsg} — 탭해서 재시도</div>}
    </div>
  );
}

// ── Flux 폴링 공통 ────────────────────────────────────────
async function pollFlux(pollingUrl) {
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await fetch('/.netlify/functions/flux-poll', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pollingUrl }) });
    const result = await poll.json();
    if (result.status === 'Ready' && result.imageUrl) return result.imageUrl;
    if (result.status === 'Error') throw new Error('이미지 생성 실패');
  }
  throw new Error('타임아웃');
}

// ── 단일 이미지 블록 (가이드라인용) ──────────────────────
function SingleImgBlock({ label, promptText, inputImage, rebrandContext, imageType, useCredit, onCreditInsufficient, aspectRatio='16/9' }) {
  const [loading, setLoading] = useState(false);
  const [imgUrl,  setImgUrl]  = useState('');
  const [errMsg,  setErrMsg]  = useState('');
  const [toast,   setToast]   = useState(false);
  const [viewer,  setViewer]  = useState(false);

  const handleGenerate = async () => {
    if (useCredit) { const r = await useCredit('image'); if (!r?.ok) { if (onCreditInsufficient) onCreditInsufficient(); return; } }
    setLoading(true); setErrMsg('');
    try {
      const body = { directPrompt: promptText };
      if (inputImage) { body.inputImage = inputImage; body.rebrandContext = rebrandContext; body.imageType = imageType || 'interior'; }
      const res  = await fetch('/.netlify/functions/generate-interior', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await res.json();
      if (data.pollingUrl) { const url = await pollFlux(data.pollingUrl); setImgUrl(url); setToast(true); return; }
      throw new Error(data.error || '이미지 생성 실패');
    } catch (e) { setErrMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {toast && <Toast msg={`${label} 완성됐어요!`} onDone={() => setToast(false)} />}
      {viewer && imgUrl && <ImageViewer src={imgUrl} title={label} onClose={() => setViewer(false)} />}
      <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'0.08em', textTransform:'uppercase' }}>{label}</div>
      {imgUrl ? (
        <img src={imgUrl} alt={label} style={{ width:'100%', borderRadius:8, objectFit:'cover', aspectRatio, display:'block', cursor:'zoom-in' }} onClick={() => setViewer(true)} title="클릭 → 전체화면" />
      ) : loading ? (
        <div style={{ height:140, border:'1.5px dashed #C4B5FD', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, background:'linear-gradient(135deg,#faf8ff,#f3f0ff)' }}>
          <span style={{ display:'inline-block', width:18, height:18, border:'2.5px solid #e5e5e5', borderTopColor:'#6D28D9', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
          <span style={{ fontSize:12, color:'#7C3AED' }}>생성 중... (20~30초)</span>
        </div>
      ) : <ImgPlaceholderEmpty label={label} onGenerate={handleGenerate} errMsg={errMsg} />}
    </div>
  );
}

// ── 브랜드명 재제안 패널 ──────────────────────────────────
function BrandNamePanel({ resultData, onApply }) {
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [names,    setNames]    = useState([]);
  const [feedback, setFeedback] = useState('');
  const [errMsg,   setErrMsg]   = useState('');
  const [selected, setSelected] = useState(null);
  const rd = resultData?.rebrandDecision || {};

  const handleGenerate = async () => {
    setLoading(true); setNames([]); setErrMsg(''); setSelected(null);
    try {
      const res  = await fetch('/.netlify/functions/bb-brandname', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ brandDecision: { brandName: rd.newBrandName, storeConcept: rd.newConcept, overallMood: rd.overallMood, coreCustomers: rd.targetCustomers, menuDirection: rd.menuDirection }, formData: resultData?.formData || {}, feedback }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '생성 실패');
      setNames(data.names || []);
    } catch (e) { setErrMsg(e.message); } finally { setLoading(false); }
  };

  const handleApply = (nameObj) => {
    setSelected(nameObj.name); onApply(nameObj);
    setTimeout(() => { setOpen(false); setSelected(null); setNames([]); setFeedback(''); }, 800);
  };

  return (
    <div style={{ marginTop:12 }}>
      {!open ? (
        <button style={bn.triggerBtn} onClick={() => setOpen(true)}>🔄 브랜드명 다시 제안받기</button>
      ) : (
        <div style={bn.panel}>
          <div style={bn.panelHeader}><span style={bn.panelTitle}>브랜드명 재제안</span><button style={bn.closeBtn} onClick={() => { setOpen(false); setNames([]); setFeedback(''); }}>✕</button></div>
          <textarea style={bn.textarea} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="피드백 (선택): 더 한국적으로, 영어 포함, 지역명 넣어줘..." rows={2}/>
          <button style={{...bn.genBtn, opacity:loading?0.6:1}} onClick={handleGenerate} disabled={loading}>{loading?'⏳ 생성 중...':'✦ 새 이름 3개 생성'}</button>
          {errMsg && <p style={bn.err}>⚠ {errMsg}</p>}
          {names.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {names.map((n,i) => (
                <div key={i} style={{...bn.nameCard,...(selected===n.name?bn.nameCardSelected:{})}} onClick={() => handleApply(n)}>
                  <div style={bn.nameText}>{n.name}</div>
                  <div style={bn.nameTagline}>{n.tagline}</div>
                  <div style={bn.nameReason}>{n.reason}</div>
                  {selected===n.name && <div style={{ fontSize:12, color:'#059669', fontWeight:700, marginTop:6 }}>✓ 적용됨</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
const bn = {
  triggerBtn:       { width:'100%', padding:'10px 0', borderRadius:'var(--radius-full)', border:'1.5px solid #6D28D9', background:'var(--purple-50)', color:'#6D28D9', fontSize:13, fontWeight:700, cursor:'pointer' },
  panel:            { background:'var(--white)', border:'1.5px solid var(--border-soft)', borderRadius:'var(--radius-lg)', padding:'16px', display:'flex', flexDirection:'column', gap:10 },
  panelHeader:      { display:'flex', justifyContent:'space-between', alignItems:'center' },
  panelTitle:       { fontSize:14, fontWeight:800, color:'var(--text-primary)' },
  closeBtn:         { border:'none', background:'transparent', color:'var(--text-tertiary)', fontSize:16, cursor:'pointer', padding:'0 4px' },
  textarea:         { width:'100%', padding:'10px 12px', borderRadius:'var(--radius-md)', border:'1.5px solid var(--border)', background:'#fafafa', fontSize:13, color:'var(--text-primary)', resize:'none', outline:'none', fontFamily:'inherit', lineHeight:1.55, boxSizing:'border-box' },
  genBtn:           { width:'100%', padding:'11px 0', borderRadius:'var(--radius-full)', border:'none', background:'#6D28D9', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' },
  err:              { margin:0, fontSize:12, color:'#9F1239', background:'#FFF1F2', padding:'8px 10px', borderRadius:8 },
  nameCard:         { padding:'14px 16px', border:'1.5px solid var(--border)', borderRadius:'var(--radius-md)', cursor:'pointer', transition:'all 0.15s' },
  nameCardSelected: { border:'1.5px solid #6D28D9', background:'var(--purple-50)' },
  nameText:         { fontSize:18, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.03em', marginBottom:3 },
  nameTagline:      { fontSize:12, color:'#6D28D9', fontWeight:600, marginBottom:5 },
  nameReason:       { fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 },
};

// ── 방향 카드 (업로드 사진 기반 img2img) ─────────────────
function DirectionCard({ title, label, text, sectionKey, resultData, fullWidth, useCredit, onCreditInsufficient, inputPhotos = [] }) {
  const [imgState,  setImgState]  = useState('idle');
  const [imgUrls,   setImgUrls]   = useState([]);
  const [errMsg,    setErrMsg]    = useState('');
  const [viewIdx,   setViewIdx]   = useState(null);
  const [toast,     setToast]     = useState(false);
  const isSpace = sectionKey === 'space';
  const isMenu  = sectionKey === 'menu';
  const rd  = resultData?.rebrandDecision      || {};
  const pkg = resultData?.interiorImagePackage || {};

  // 리브랜딩 컨텍스트 (img2img에 전달)
  const rebrandCtx = {
    newBrandName: rd.newBrandName || '',
    newConcept:   rd.newConcept   || '',
    overallMood:  rd.overallMood  || pkg.moodTone || '',
    materials:    pkg.materialKeywords || [],
    colors:       pkg.colorKeywords    || [],
    signatureSpot:pkg.signatureSpot    || '',
  };

  const buildPrompt = (idx = 0) => {
    const brand     = rd.newBrandName || '';
    const concept   = rd.newConcept   || '';
    const mood      = pkg.moodTone    || rd.overallMood || '';
    const materials = (pkg.materialKeywords || []).slice(0,3).join(', ');
    const colors    = (pkg.colorKeywords    || []).slice(0,2).join(', ');
    const base = `Photorealistic ${concept} restaurant. Brand: ${brand}. Mood: ${mood}. Materials: ${materials}. Colors: ${colors}. No people. No text. 4K quality.`;

    if (isMenu)               return `Improve plating and presentation based on input photo. ${base} Overhead bird's eye view. Michelin-star plating. Menu: ${rd.menuDirection || ''}.`;
    if (sectionKey==='prop')  return `Close-up interior props detail. ${base} 3-5 thematic decorative pieces.`;
    if (sectionKey==='service') return `Restaurant staff uniform editorial photography. ${base} 2-3 staff in themed uniform.`;

    // space
    const angles = [
      `Transform this interior space: keep same layout but apply new brand style. Wide establishing shot. ${base}`,
      `Same space from opposite angle: apply new brand design. ${base}`,
      `Signature zone: ${pkg.signatureSpot || 'most distinctive area'}. ${base}`,
    ];
    return angles[idx] || angles[0];
  };

  const handleGenerate = async () => {
    if (useCredit) {
      const creditType = isSpace ? 'space' : 'image';
      const r = await useCredit(creditType);
      if (!r?.ok) { if (onCreditInsufficient) onCreditInsufficient(); return; }
    }
    setImgState('loading'); setErrMsg(''); setImgUrls([]);

    try {
      if (isSpace && inputPhotos.length > 0) {
        // ★ 매장 사진 기반 img2img — 사진 수만큼 생성 (최대 5장)
        const photosToUse = inputPhotos.slice(0, 5);
        const urls = [];
        for (let i = 0; i < photosToUse.length; i++) {
          const res = await fetch('/.netlify/functions/generate-interior', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              directPrompt:   buildPrompt(Math.min(i, 2)),
              inputImage:     photosToUse[i].base64,
              rebrandContext: rebrandCtx,
              imageType:      'interior',
            })
          });
          const data = await res.json();
          if (data.pollingUrl) {
            const url = await pollFlux(data.pollingUrl);
            urls.push(url);
            setImgUrls([...urls]);
          }
        }
        setImgState('done'); setToast(true);

      } else if (isMenu && inputPhotos.length > 0) {
        // ★ 메뉴 사진 기반 img2img — 메뉴 사진 수만큼 생성 (최대 3장)
        const photosToUse = inputPhotos.slice(0, 3);
        const urls = [];
        for (let i = 0; i < photosToUse.length; i++) {
          const res = await fetch('/.netlify/functions/generate-interior', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              directPrompt:   buildPrompt(0),
              inputImage:     photosToUse[i].base64,
              rebrandContext: rebrandCtx,
              imageType:      'menu',
            })
          });
          const data = await res.json();
          if (data.pollingUrl) {
            const url = await pollFlux(data.pollingUrl);
            urls.push(url);
            setImgUrls([...urls]);
          }
        }
        setImgState('done'); setToast(true);

      } else {
        // 사진 없으면 txt2img (기존 방식)
        const count = isSpace ? 3 : 1;
        const urls = [];
        for (let i = 0; i < count; i++) {
          const res = await fetch('/.netlify/functions/generate-interior', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ directPrompt: buildPrompt(i) })
          });
          const data = await res.json();
          if (data.pollingUrl) {
            const url = await pollFlux(data.pollingUrl);
            urls.push(url);
            setImgUrls([...urls]);
          }
        }
        setImgState('done'); setToast(true);
      }
    } catch(e) { setErrMsg(e.message); setImgState('error'); }
  };

  const accentColor = isSpace ? '#9333EA' : '#6D28D9';
  const hasPhotos = inputPhotos.length > 0;

  return (
    <div style={{...dc.card,...(fullWidth?{maxWidth:'100%'}:{})}}>
      {toast && <Toast msg={`${title} 이미지 완성됐어요!`} onDone={() => setToast(false)} />}
      {viewIdx !== null && imgUrls[viewIdx] && <ImageViewer src={imgUrls[viewIdx]} title={`${title} ${viewIdx+1}`} onClose={() => setViewIdx(null)} />}
      <div style={{...dc.cardBar, background:accentColor}} />
      <div style={dc.cardInner}>
        <div style={dc.cardLabel}>{label}</div>
        <div style={dc.cardTitle}>{title}</div>
        {hasPhotos && (
          <div style={{ fontSize:11, color:'#6D28D9', background:'#EEE8FF', padding:'4px 10px', borderRadius:999, display:'inline-block', marginBottom:4 }}>
            📸 업로드 사진 {inputPhotos.length}장 기반 변환
          </div>
        )}
        <div style={dc.cardDivider} />
        <p style={dc.cardText}>{text}</p>

        {imgUrls.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={imgUrls.length > 1 ? { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:8 } : {}}>
              {imgUrls.map((url,i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {hasPhotos && inputPhotos[i] && (
                    <div style={{ display:'flex', gap:4, marginBottom:2 }}>
                      <img src={inputPhotos[i].preview} alt="원본" style={{ width:40, height:40, borderRadius:4, objectFit:'cover', opacity:0.7 }} />
                      <span style={{ fontSize:10, color:'#aaa', alignSelf:'center' }}>→ 변환</span>
                    </div>
                  )}
                  <img src={url} alt={`${title} ${i+1}`}
                    style={{ width:'100%', borderRadius:8, objectFit:'cover', aspectRatio: isSpace ? '16/9' : isMenu ? '1/1' : '3/2', display:'block', cursor:'zoom-in' }}
                    onClick={() => setViewIdx(i)} title="클릭 → 전체화면" />
                </div>
              ))}
            </div>
            {imgState === 'loading' && (
              <div style={dc.loadingBox}><span style={dc.spinner}/><span style={{ fontSize:12, color:'#7C3AED' }}>추가 이미지 생성 중... ({imgUrls.length}/{inputPhotos.length || 3})</span></div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 2px 0' }}>
              <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>🔍 클릭 → 전체화면</span>
              <button style={dc.regenBtn} onClick={handleGenerate} disabled={imgState==='loading'}>↺ 재생성</button>
            </div>
          </div>
        ) : imgState === 'loading' ? (
          <div style={dc.loadingBox}>
            <span style={dc.spinner}/>
            <span style={{ fontSize:12, color:'#7C3AED' }}>
              {hasPhotos ? `사진 기반 변환 중... (20~40초/장)` : '생성 중... (20~30초)'}
            </span>
          </div>
        ) : imgState === 'error' ? (
          <div style={{ padding:'12px', background:'#FFF1F2', borderRadius:8, fontSize:12, color:'#9F1239' }}>
            ⚠ {errMsg}<br/>
            <button style={{...dc.regenBtn, marginTop:8}} onClick={handleGenerate}>다시 시도</button>
          </div>
        ) : (
          <ImgPlaceholderEmpty label={title} onGenerate={handleGenerate} errMsg="" />
        )}
      </div>
    </div>
  );
}
const dc = {
  card:       { background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)', display:'flex', flexDirection:'column' },
  cardBar:    { height:4, width:'100%', borderRadius:'14px 14px 0 0' },
  cardInner:  { padding:'18px 18px 20px', display:'flex', flexDirection:'column', gap:10, flex:1 },
  cardLabel:  { fontSize:11, fontWeight:700, color:'var(--text-tertiary)', letterSpacing:'0.08em', textTransform:'uppercase' },
  cardTitle:  { fontSize:16, fontWeight:800, color:'var(--text-primary)' },
  cardDivider:{ height:1, background:'var(--border)' },
  cardText:   { margin:0, fontSize:13, color:'var(--text-secondary)', lineHeight:1.65, wordBreak:'keep-all', flex:1 },
  loadingBox: { display:'flex', alignItems:'center', gap:8, padding:'12px', background:'var(--purple-50)', borderRadius:8 },
  spinner:    { display:'inline-block', width:16, height:16, border:'2.5px solid var(--border)', borderTopColor:'var(--purple-600)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 },
  regenBtn:   { padding:'7px 14px', borderRadius:'var(--radius-full)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-tertiary)', fontSize:12, fontWeight:600, cursor:'pointer' },
};

// ── 사진 분석 섹션 ────────────────────────────────────────
function PhotoAnalysisSection({ photoAnalysis }) {
  if (!photoAnalysis?.currentState && !photoAnalysis?.problems?.length) return null;
  const { currentState, problems, opportunities, menuVisualAnalysis } = photoAnalysis;
  return (
    <section style={s.sectionCard}>
      <div style={s.sectionBadge}>📸 PHOTO ANALYSIS</div>
      <h3 style={s.sectionTitle}>매장 사진 분석 결과</h3>
      {currentState && <div style={s.analysisBox}><div style={s.analysisLabel}>현재 상태</div><p style={s.analysisText}>{currentState}</p></div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
        {problems?.length > 0 && (
          <div style={{...s.analysisBox, background:'#FFF1F2', border:'1px solid #FECDD3'}}>
            <div style={{...s.analysisLabel, color:'#9F1239'}}>문제점</div>
            {problems.map((p,i) => <div key={i} style={{ fontSize:13, color:'#111', lineHeight:1.7 }}>· {p}</div>)}
          </div>
        )}
        {opportunities?.length > 0 && (
          <div style={{...s.analysisBox, background:'#F0FDF4', border:'1px solid #BBF7D0'}}>
            <div style={{...s.analysisLabel, color:'#166534'}}>기회 요소</div>
            {opportunities.map((o,i) => <div key={i} style={{ fontSize:13, color:'#111', lineHeight:1.7 }}>· {o}</div>)}
          </div>
        )}
      </div>
      {menuVisualAnalysis && <div style={{...s.analysisBox, marginTop:12, background:'#F5F3FF'}}><div style={s.analysisLabel}>메뉴 사진 분석</div><p style={s.analysisText}>{menuVisualAnalysis}</p></div>}
    </section>
  );
}

// ── 예산 시나리오 섹션 ────────────────────────────────────
function BudgetScenariosSection({ rebrandDecision, formData }) {
  const { budgetScenarios, priorityActions } = rebrandDecision || {};
  const scopeLabel = { sign:'간판만 교체', partial:'부분 리뉴얼', full:'전면 리모델링' };
  return (
    <section style={s.sectionCard}>
      <div style={s.sectionBadge}>💰 BUDGET SCENARIOS</div>
      <h3 style={s.sectionTitle}>예산별 실행 계획</h3>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {formData?.budget     && <span style={s.budgetTag}>예산: {formData.budget}</span>}
        {formData?.changeScope && <span style={s.budgetTag}>범위: {scopeLabel[formData.changeScope] || formData.changeScope}</span>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {budgetScenarios?.minimum     && <div style={{...s.scenarioCard, borderColor:'#D1D5DB'}}><div style={{...s.scenarioLabel, color:'#6B7280'}}>최소 실행</div><p style={s.scenarioText}>{budgetScenarios.minimum}</p></div>}
        {budgetScenarios?.recommended && (
          <div style={{...s.scenarioCard, borderColor:'#6D28D9', background:'#F5F3FF'}}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <div style={{...s.scenarioLabel, color:'#6D28D9'}}>권장 실행</div>
              <span style={{ fontSize:10, background:'#6D28D9', color:'#fff', padding:'2px 8px', borderRadius:999, fontWeight:700 }}>추천</span>
            </div>
            <p style={s.scenarioText}>{budgetScenarios.recommended}</p>
          </div>
        )}
        {budgetScenarios?.full && <div style={{...s.scenarioCard, borderColor:'#111', background:'#111'}}><div style={{...s.scenarioLabel, color:'#fff'}}>풀 실행</div><p style={{...s.scenarioText, color:'#D1D5DB'}}>{budgetScenarios.full}</p></div>}
      </div>
      {priorityActions?.length > 0 && (
        <div style={{ marginTop:20 }}>
          <div style={s.analysisLabel}>🎯 지금 당장 해야 할 것 (우선순위 순)</div>
          {priorityActions.map((action,i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:i<priorityActions.length-1?'1px solid #f0f0f0':'none' }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:i===0?'#6D28D9':'#E5E7EB', color:i===0?'#fff':'#6B7280', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</div>
              <span style={{ fontSize:14, color:'#111', lineHeight:1.6 }}>{action}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── 브랜드 가이드라인 모달 ────────────────────────────────
function BrandGuidelineModal({ resultData, onClose, useCredit, onCreditInsufficient, storePhotos, menuPhotos }) {
  const rd  = resultData?.rebrandDecision      || {};
  const pkg = resultData?.interiorImagePackage || {};
  const fd  = resultData?.formData             || {};
  const bg  = rd.brandGuideline               || {};
  const today = new Date().toLocaleDateString('ko-KR');

  const rebrandCtx = {
    newBrandName: rd.newBrandName || '',
    newConcept:   rd.newConcept   || '',
    overallMood:  rd.overallMood  || pkg.moodTone || '',
    materials:    pkg.materialKeywords || [],
    colors:       pkg.colorKeywords    || [],
    signatureSpot:pkg.signatureSpot    || '',
  };

  const dot = { width:5, height:5, borderRadius:'50%', background:'#7F77DD', flexShrink:0, marginTop:6 };
  const row = { display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'#111', lineHeight:1.65, marginBottom:6 };

  return createPortal(
    <div style={gm.overlay}>
      <div style={gm.modal}>
        <div style={gm.header}>
          <div><div style={gm.headerTitle}>📋 리브랜딩 가이드라인</div><div style={gm.headerSub}>{rd.newBrandName} · {today}</div></div>
          <div style={{ display:'flex', gap:10 }}>
            <button style={gm.printBtn} onClick={() => window.print()}>🖨 인쇄 / PDF</button>
            <button style={gm.closeBtn} onClick={onClose}>✕ 닫기</button>
          </div>
        </div>
        <div style={gm.body}>
          <div style={gm.cover}>
            <div style={gm.coverBadge}>REBRAND GUIDELINES · REBRANDBOSS</div>
            <div style={gm.coverName}>{rd.newBrandName || ''}</div>
            {rd.tagline && <div style={gm.coverTagline}>{rd.tagline}</div>}
            <div style={gm.coverMeta}>
              {fd.category    && <span><strong>업종</strong> {fd.category}</span>}
              {fd.storeAddress && <span><strong>주소</strong> {fd.storeAddress}</span>}
              {fd.budget      && <span><strong>예산</strong> {fd.budget}</span>}
              <span><strong>작성일</strong> {today}</span>
            </div>
          </div>

          <div style={gm.section}>
            <div style={gm.sectionLabel}>01 · Rebrand Core</div>
            <div style={gm.sectionTitle}>리브랜딩 핵심 정의</div>
            <div style={gm.coreGrid}>
              {rd.newConcept      && <div style={gm.coreItem}><div style={gm.coreLabel}>새 컨셉</div><div style={gm.coreValue}>{rd.newConcept}</div></div>}
              {rd.targetCustomers && <div style={gm.coreItem}><div style={gm.coreLabel}>핵심 고객</div><div style={gm.coreValue}>{rd.targetCustomers}</div></div>}
              {rd.newVisitReason  && <div style={gm.coreItem}><div style={gm.coreLabel}>새로운 방문 이유</div><div style={gm.coreValue}>{rd.newVisitReason}</div></div>}
              {rd.menuDirection   && <div style={gm.coreItem}><div style={gm.coreLabel}>메뉴 방향</div><div style={gm.coreValue}>{rd.menuDirection}</div></div>}
            </div>
          </div>

          {(bg.mainColor || bg.subColor) && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>02 · Color Palette</div>
              <div style={gm.sectionTitle}>브랜드 컬러</div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {[bg.mainColor, bg.subColor, ...(pkg.colorKeywords||[])].filter(Boolean).map((c,i) => {
                  const hex = c.match(/#[0-9A-Fa-f]{3,6}/)?.[0];
                  if (!hex) return null;
                  return (
                    <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                      <div style={{ width:60, height:60, borderRadius:8, background:hex, border:'1px solid rgba(0,0,0,0.08)' }} />
                      <div style={{ fontSize:10, color:'#555', textAlign:'center' }}>{i===0?'메인':i===1?'보조':c.replace(/#[0-9A-Fa-f]{3,6}/,'').trim()}</div>
                      <div style={{ fontSize:10, color:'#888', fontFamily:'monospace' }}>{hex}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(bg.logoDirection || bg.fontDirection || bg.signageDirection) && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>03 · Identity</div>
              <div style={gm.sectionTitle}>로고 · 폰트 · 간판</div>
              <div style={gm.coreGrid}>
                {bg.logoDirection    && <div style={gm.coreItem}><div style={gm.coreLabel}>로고 방향</div><div style={gm.coreValue}>{bg.logoDirection}</div></div>}
                {bg.fontDirection    && <div style={gm.coreItem}><div style={gm.coreLabel}>폰트 방향</div><div style={gm.coreValue}>{bg.fontDirection}</div></div>}
                {bg.signageDirection && <div style={{...gm.coreItem, gridColumn:'1/-1'}}><div style={gm.coreLabel}>간판 방향</div><div style={gm.coreValue}>{bg.signageDirection}</div></div>}
              </div>
            </div>
          )}

          <div style={gm.section}>
            <div style={gm.sectionLabel}>04 · Interior Visualization</div>
            <div style={gm.sectionTitle}>리브랜딩 후 공간 이미지</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
              {['메인 홀','시그니처 공간','외관'].map((label,i) => {
                const prompts = [
                  `Transform interior: keep layout, apply new brand "${rd.newBrandName}". Concept: ${rd.newConcept}. Mood: ${rd.overallMood||pkg.moodTone}. No people. No text.`,
                  `Signature zone: ${pkg.signatureSpot||'distinctive area'}. Brand: ${rd.newBrandName}. No people. No text.`,
                  `Exterior facade: new signage "${rd.newBrandName}". ${rd.overallMood||pkg.moodTone}. No people. No text.`,
                ];
                const photo = i < 2 ? (storePhotos?.[i]?.base64 || null) : null;
                const iType = i === 2 ? 'exterior' : 'interior';
                return <SingleImgBlock key={i} label={label} promptText={prompts[i]} inputImage={photo} rebrandContext={rebrandCtx} imageType={iType} useCredit={useCredit} onCreditInsufficient={onCreditInsufficient} />;
              })}
            </div>
          </div>

          <div style={gm.section}>
            <div style={gm.sectionLabel}>05 · Interior Execution Guide</div>
            <div style={gm.sectionTitle}>인테리어 실행 가이드</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:10 }}>👥 업체 미팅 전 준비할 것</div>
              {['도면 또는 평면도 준비 (없으면 줄자로 실측 스케치)', '이 가이드라인 PDF + 공간 이미지 출력해서 지참', '예산 상한선 미리 정해두기 (업체에는 10% 낮게)', '희망 공사 기간 및 오픈 목표일 결정', '포트폴리오 사진 속 실제 매장 방문 요청'].map((p,i) => <div key={i} style={row}><div style={dot}/><span>{p}</span></div>)}
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:10 }}>❓ 미팅 때 반드시 물어볼 것</div>
              {['하자 보증 기간은 어떻게 되나요? (최소 1년)', '직영 공사인가요, 하청 주나요?', '중도금/잔금 비율은 어떻게 되나요?', '폐기물 처리 비용이 견적에 포함되어 있나요?'].map((q,i) => <div key={i} style={{ fontSize:12, color:'#111', background:'#F5F3FF', padding:'8px 12px', borderRadius:6, marginBottom:6 }}>"{q}"</div>)}
            </div>
            <div style={{ background:'#FAEEDA', borderRadius:8, padding:'12px 16px', fontSize:12, color:'#633806', lineHeight:1.7 }}>
              ⚠ 공사 시작 후에도 최소 주 2회 현장 방문해서 자재가 계약서대로 들어오는지, 시공 방향이 이 가이드라인과 맞는지 직접 확인하세요.
            </div>
          </div>

          {rd.launchChecklist?.length > 0 && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>06 · Launch Checklist</div>
              <div style={gm.sectionTitle}>리브랜딩 실행 체크리스트</div>
              {rd.launchChecklist.map((item,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f0f0f0' }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', border:'1.5px solid #ddd', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:11, fontWeight:700, color:'#aaa' }}>{i+1}</div>
                  <span style={{ fontSize:14, color:'#111', lineHeight:1.6 }}>{item}</span>
                </div>
              ))}
            </div>
          )}

          <div style={gm.footer}><span style={{ fontWeight:700 }}>✦ RebrandBoss</span><span style={{ color:'#888', fontSize:12 }}>Generated {today} · rebrandboss.kr</span></div>
        </div>
      </div>
    </div>, document.body
  );
}
const gm = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:99999, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 16px', overflowY:'auto' },
  modal:       { background:'#fff', borderRadius:16, width:'100%', maxWidth:860, display:'flex', flexDirection:'column', boxShadow:'0 40px 100px rgba(0,0,0,0.4)', marginBottom:40 },
  header:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 28px', borderBottom:'1px solid #e5e5e5', position:'sticky', top:0, background:'#fff', borderRadius:'16px 16px 0 0', zIndex:10 },
  headerTitle: { fontSize:16, fontWeight:800, color:'#111' },
  headerSub:   { fontSize:12, color:'#888', marginTop:2 },
  printBtn:    { padding:'8px 18px', borderRadius:8, border:'none', background:'#111', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' },
  closeBtn:    { padding:'8px 14px', borderRadius:8, border:'1px solid #ddd', background:'#fff', color:'#555', fontSize:13, cursor:'pointer' },
  body:        { padding:'40px 48px 60px', overflowY:'auto' },
  cover:       { marginBottom:48, paddingBottom:40, borderBottom:'2px solid #111' },
  coverBadge:  { fontSize:10, fontWeight:600, letterSpacing:'0.18em', color:'#888', marginBottom:20 },
  coverName:   { fontSize:48, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1.1, marginBottom:10 },
  coverTagline:{ fontSize:15, fontWeight:300, color:'#555', marginBottom:24 },
  coverMeta:   { display:'flex', gap:28, fontSize:12, color:'#888', flexWrap:'wrap' },
  section:     { marginBottom:44, paddingBottom:44, borderBottom:'1px solid #e5e5e5' },
  sectionLabel:{ fontSize:9, fontWeight:700, letterSpacing:'0.2em', color:'#888', textTransform:'uppercase', marginBottom:14 },
  sectionTitle:{ fontSize:20, fontWeight:700, letterSpacing:'-0.02em', marginBottom:20 },
  coreGrid:    { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  coreItem:    { background:'#f8f8f8', borderRadius:8, padding:'16px 18px' },
  coreLabel:   { fontSize:10, fontWeight:600, letterSpacing:'0.1em', color:'#888', textTransform:'uppercase', marginBottom:8 },
  coreValue:   { fontSize:13, color:'#111', lineHeight:1.65, wordBreak:'keep-all' },
  footer:      { marginTop:40, paddingTop:20, borderTop:'1px solid #e5e5e5', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 },
};

// ── 체크리스트 ────────────────────────────────────────────
function LaunchChecklist({ checklist }) {
  const [doneState, setDoneState] = useState(() => checklist.map(() => false));
  const doneCount = doneState.filter(Boolean).length;
  const pct = Math.round(doneCount / checklist.length * 100);
  return (
    <section style={s.sectionCard}>
      <div style={s.sectionBadge}>✅ LAUNCH CHECKLIST</div>
      <h3 style={s.sectionTitle}>리브랜딩 실행 체크리스트</h3>
      <div style={{ background:'#F5F3FF', borderRadius:10, padding:'14px 18px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
          <span style={{ fontSize:12, color:'#6D28D9' }}>완료율</span>
          <span style={{ fontSize:22, fontWeight:900, color:'#3C3489' }}>{pct}%</span>
        </div>
        <div style={{ height:6, background:'#DDD6FE', borderRadius:999, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:999, background:'#7F77DD', width:`${pct}%`, transition:'width 0.4s ease' }} />
        </div>
        <div style={{ fontSize:12, color:'#6D28D9', marginTop:8 }}><strong>{doneCount}</strong>/{checklist.length} 완료</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {checklist.map((item,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', border:'1px solid #e5e5e5', borderRadius:10, background:'#fff', opacity:doneState[i]?0.6:1, cursor:'pointer' }}
            onClick={() => setDoneState(p => p.map((d,idx) => idx===i?!d:d))}>
            <div style={{ width:22, height:22, borderRadius:'50%', border:doneState[i]?'none':'1.5px solid #ddd', background:doneState[i]?'#7F77DD':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {doneState[i] && <span style={{ color:'#fff', fontSize:13 }}>✓</span>}
            </div>
            <span style={{ fontSize:14, fontWeight:600, color:doneState[i]?'#aaa':'#111', textDecoration:doneState[i]?'line-through':'none', wordBreak:'keep-all' }}>{item}</span>
          </div>
        ))}
      </div>
      {pct===100 && <div style={{ marginTop:16, padding:16, background:'#e8f5e9', borderRadius:10, textAlign:'center' }}><div style={{ fontSize:22, marginBottom:6 }}>🎉</div><div style={{ fontSize:15, fontWeight:700, color:'#2e7d32' }}>리브랜딩 준비 완료!</div></div>}
    </section>
  );
}

// ── PDF ───────────────────────────────────────────────────
async function downloadRebrandPDF(resultRef, brandName) {
  const el = resultRef.current; if (!el) return;
  try {
    const canvas = await html2canvas(el, { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pdfW = pdf.internal.pageSize.getWidth(), pdfH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pdfW) / canvas.width;
    let yOffset = 0, remaining = imgH;
    while (remaining > 0) { if (yOffset > 0) pdf.addPage(); pdf.addImage(imgData,'PNG',0,-yOffset,pdfW,imgH); yOffset += pdfH; remaining -= pdfH; }
    pdf.save(`${(brandName||'리브랜딩').replace(/\s/g,'_')}_리브랜드보스.pdf`);
  } catch(e) { throw e; }
}

// ── ResultScreen (메인 export) ────────────────────────────
export default function ResultScreen({
  resultData, error, warning, loading,
  onRegenerate, onBackToForm, onRestart,
  useCredit, checkLimit, onCreditInsufficient,
  storePhotos = [],   // ← App.jsx에서 전달받은 매장 사진
  menuPhotos  = [],   // ← App.jsx에서 전달받은 메뉴 사진
}) {
  const rd  = resultData?.rebrandDecision      || {};
  const pa  = resultData?.photoAnalysis        || {};
  const pkg = resultData?.interiorImagePackage || {};
  const resultRef = useRef(null);
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [showGuideline, setShowGuideline] = useState(false);
  const [displayName,   setDisplayName]   = useState('');
  const [displayTagline,setDisplayTagline]= useState('');

  const typedName    = useTypingEffect(rd.newBrandName || '', 75);
  const typedTagline = useTypingEffect(rd.tagline      || '', 40);
  useEffect(() => { setDisplayName(''); setDisplayTagline(''); }, [rd.newBrandName]);

  if (loading)              return <RebrandLoadingScreen />;
  if (error && !resultData) return (
    <div style={{ textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontSize:22, fontWeight:900, color:'#111827', marginBottom:12 }}>오류가 발생했어요</div>
      <p style={{ fontSize:14, color:'#64748b', marginBottom:24 }}>{error}</p>
      <button style={s.btnSecondary} onClick={onBackToForm}>← 입력으로 돌아가기</button>
    </div>
  );
  if (!resultData) return null;

  const handlePdfDownload = async () => {
    setPdfLoading(true);
    try { await downloadRebrandPDF(resultRef, rd.newBrandName); }
    catch(e) { alert(`PDF 생성 실패: ${e.message}`); }
    finally { setPdfLoading(false); }
  };

  const sections = [
    { key:'space',   title:'공간 연출',     label:'SPACE DIRECTION',   text: pkg.improvementDirection || '' },
    { key:'menu',    title:'메뉴 플레이팅', label:'MENU DIRECTION',    text: rd.menuDirection   || '' },
    { key:'prop',    title:'소품 디테일',   label:'PROP DIRECTION',    text: pkg.stylingNotes   || '' },
    { key:'service', title:'유니폼 외',     label:'SERVICE DIRECTION', text: rd.serviceDirection || '' },
  ];

  return (
    <div ref={resultRef} style={s.wrap}>
      {showGuideline && (
        <BrandGuidelineModal
          resultData={resultData}
          onClose={() => setShowGuideline(false)}
          useCredit={useCredit}
          onCreditInsufficient={onCreditInsufficient}
          storePhotos={storePhotos}
          menuPhotos={menuPhotos}
        />
      )}

      {/* ── 진단 결과 ── */}
      <section style={{...s.sectionCard, animation:'fadeInUp 0.5s ease both'}}>
        <div style={s.sectionBadge}>🔍 DIAGNOSIS</div>
        <h2 style={s.diagnosisText}>{rd.diagnosis || ''}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
          {rd.keepStrengths?.length > 0 && (
            <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#166534', letterSpacing:'0.06em', marginBottom:8 }}>지킬 강점</div>
              {rd.keepStrengths.map((item,i) => <div key={i} style={{ fontSize:13, color:'#111', lineHeight:1.7 }}>✓ {item}</div>)}
            </div>
          )}
          {rd.changePoints?.length > 0 && (
            <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#9F1239', letterSpacing:'0.06em', marginBottom:8 }}>바꿀 것</div>
              {rd.changePoints.map((item,i) => <div key={i} style={{ fontSize:13, color:'#111', lineHeight:1.7 }}>→ {item}</div>)}
            </div>
          )}
        </div>
      </section>

      {/* ── 사진 분석 ── */}
      <PhotoAnalysisSection photoAnalysis={pa} />

      {/* ── 새 브랜드명 ── */}
      <section style={{...s.nameBox, animation:'fadeInUp 0.5s ease both', animationDelay:'0.15s'}}>
        <div style={s.nameLabel}>NEW BRAND NAME</div>
        <h1 style={s.brandName}>
          {displayName || typedName || ''}
          <span style={{ opacity:typedName.length < (rd.newBrandName||'').length && !displayName ? 1 : 0, borderRight:'3px solid currentColor', marginLeft:2, animation:'blink 0.8s step-end infinite' }} />
        </h1>
        <p style={s.tagline}>{displayTagline || typedTagline || ''}</p>
        {rd.newConcept && <div style={{ marginTop:12, padding:'10px 16px', background:'rgba(255,255,255,0.6)', borderRadius:8, fontSize:14, color:'#6D28D9', fontWeight:600 }}>{rd.newConcept}</div>}
        <BrandNamePanel resultData={resultData} onApply={nameObj => { setDisplayName(nameObj.name); setDisplayTagline(nameObj.tagline); }} />
      </section>

      {/* ── 핵심 정보 그리드 ── */}
      <section style={s.infoGrid}>
        {[
          { label:'핵심 고객',       value:rd.targetCustomers },
          { label:'새로운 방문 이유', value:rd.newVisitReason  },
          { label:'메뉴 방향',       value:rd.menuDirection   },
          { label:'서비스 방향',     value:rd.serviceDirection },
        ].filter(item => item.value).map(({ label, value }) => (
          <div key={label} style={s.infoCard}>
            <div style={s.infoLabel}>{label}</div>
            <p style={s.infoValue}>{value}</p>
          </div>
        ))}
      </section>

      {/* ── 예산 시나리오 ── */}
      <BudgetScenariosSection rebrandDecision={rd} formData={resultData?.formData} />

      {/* ── 4방향 카드 (업로드 사진 기반) ── */}
      <section style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <h3 style={{ margin:'8px 0 4px', fontSize:'clamp(20px,3vw,26px)', fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
          리브랜딩의 <span style={{ color:'#7c3aed' }}>네 가지 방향.</span>
        </h3>
        {storePhotos.length > 0 && (
          <div style={{ padding:'10px 14px', background:'#EEE8FF', borderRadius:10, fontSize:13, color:'#6D28D9', fontWeight:600 }}>
            📸 업로드하신 매장 사진 {storePhotos.length}장을 기반으로 리브랜딩 이미지를 생성합니다
          </div>
        )}
        {/* 공간 — 풀 와이드, 매장 사진 기반 */}
        <DirectionCard
          key="space" title="공간 연출" label="SPACE DIRECTION"
          text={sections[0].text} sectionKey="space" resultData={resultData} fullWidth
          useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
          inputPhotos={storePhotos}
        />
        {/* 나머지 3개 그리드 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
          {/* 메뉴 — 메뉴 사진 기반 */}
          <DirectionCard
            key="menu" title="메뉴 플레이팅" label="MENU DIRECTION"
            text={sections[1].text} sectionKey="menu" resultData={resultData}
            useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
            inputPhotos={menuPhotos}
          />
          {/* 소품/서비스 — 매장 사진 첫 번째 참고 */}
          <DirectionCard
            key="prop" title="소품 디테일" label="PROP DIRECTION"
            text={sections[2].text} sectionKey="prop" resultData={resultData}
            useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
            inputPhotos={[]}
          />
          <DirectionCard
            key="service" title="유니폼 외" label="SERVICE DIRECTION"
            text={sections[3].text} sectionKey="service" resultData={resultData}
            useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
            inputPhotos={[]}
          />
        </div>
      </section>

      {/* ── 소재/컬러 스펙 ── */}
      {(pkg.materialKeywords?.length > 0 || pkg.mustHaveElements?.length > 0) && (
        <section style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
            {pkg.materialKeywords?.length > 0 && <div style={s.specCard}><div style={s.specLabel}>소재 키워드</div>{pkg.materialKeywords.map((k,i) => <div key={i} style={s.specTag}>· {k}</div>)}</div>}
            {pkg.furnitureKeywords?.length > 0 && <div style={s.specCard}><div style={s.specLabel}>가구 키워드</div>{pkg.furnitureKeywords.map((k,i) => <div key={i} style={s.specTag}>· {k}</div>)}</div>}
            {pkg.mustHaveElements?.length > 0   && <div style={s.specCard}><div style={s.specLabel}>반드시 있어야 할 것</div>{pkg.mustHaveElements.map((k,i) => <div key={i} style={s.specTag}>· {k}</div>)}</div>}
          </div>
          {pkg.signatureSpot && <div style={{ background:'var(--purple-50)', border:'1px solid var(--border-soft)', borderRadius:'var(--radius-md)', padding:'16px 18px' }}><div style={s.specLabel}>SIGNATURE SPOT</div><p style={{ margin:0, fontSize:15, fontWeight:800, color:'#111827', wordBreak:'keep-all' }}>{pkg.signatureSpot}</p></div>}
        </section>
      )}

      {/* ── 체크리스트 ── */}
      {rd.launchChecklist?.length > 0 && <LaunchChecklist checklist={rd.launchChecklist} />}

      {warning && <div style={{ padding:'12px 16px', background:'#fefce8', border:'1px solid #fde047', borderRadius:14, fontSize:13, color:'#854d0e' }}>⚠ {warning}</div>}

      {/* ── 액션 버튼 ── */}
      <div style={s.actions}>
        <button style={s.btnPrimary} onClick={onRegenerate}>↺ 다른 방향으로 재제안</button>
        <button style={s.btnSecondary} onClick={onBackToForm}>← 입력 수정하기</button>
        <button style={{...s.btnSecondary, borderColor:'#6D28D9', color:'#6D28D9', opacity:pdfLoading?0.6:1}} onClick={handlePdfDownload} disabled={pdfLoading}>
          {pdfLoading ? '⏳ PDF 생성 중...' : '📄 PDF 다운로드'}
        </button>
        <button style={{...s.btnSecondary, borderColor:'#059669', color:'#059669'}} onClick={() => setShowGuideline(true)}>📋 리브랜딩 가이드라인</button>
        <button style={s.btnGhost} onClick={onRestart}>처음부터 다시</button>
      </div>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────
const s = {
  wrap:          { width:'100%', maxWidth:1060, margin:'0 auto', display:'flex', flexDirection:'column', gap:16, paddingTop:32, animation:'fadeIn 0.3s ease' },
  sectionCard:   { background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-xl)', padding:'28px 28px 24px', boxShadow:'var(--shadow-sm)' },
  sectionBadge:  { display:'inline-block', padding:'5px 14px', borderRadius:'var(--radius-full)', background:'var(--purple-50)', color:'var(--purple-600)', fontSize:12, fontWeight:700, letterSpacing:'0.04em', marginBottom:12 },
  sectionTitle:  { margin:'0 0 16px', fontSize:'clamp(18px,2.5vw,22px)', fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  diagnosisText: { margin:0, fontSize:'clamp(16px,2vw,20px)', fontWeight:700, color:'var(--text-primary)', lineHeight:1.5, wordBreak:'keep-all' },
  nameBox:       { background:'var(--purple-50)', border:'1px solid var(--border-soft)', borderRadius:'var(--radius-xl)', padding:'36px 32px', textAlign:'center' },
  nameLabel:     { fontSize:11, fontWeight:700, color:'var(--purple-600)', letterSpacing:'0.1em', marginBottom:12, textTransform:'uppercase' },
  brandName:     { margin:'0 0 10px', fontSize:'clamp(36px,6vw,68px)', fontWeight:900, color:'#6D28D9', letterSpacing:'-0.04em' },
  tagline:       { margin:0, fontSize:16, color:'var(--text-secondary)', lineHeight:1.6 },
  infoGrid:      { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 },
  infoCard:      { background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'20px 18px', boxShadow:'var(--shadow-sm)' },
  infoLabel:     { fontSize:11, fontWeight:700, color:'var(--purple-600)', letterSpacing:'0.06em', marginBottom:8, textTransform:'uppercase' },
  infoValue:     { margin:0, fontSize:14, color:'var(--text-primary)', lineHeight:1.65, wordBreak:'keep-all' },
  analysisBox:   { background:'#F8F8FC', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' },
  analysisLabel: { fontSize:11, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.06em', marginBottom:8, textTransform:'uppercase' },
  analysisText:  { margin:0, fontSize:13, color:'#111', lineHeight:1.7, wordBreak:'keep-all' },
  budgetTag:     { padding:'5px 12px', background:'#EEE8FF', color:'#6D28D9', borderRadius:999, fontSize:12, fontWeight:700 },
  scenarioCard:  { border:'1.5px solid', borderRadius:12, padding:'16px 18px' },
  scenarioLabel: { fontSize:11, fontWeight:700, letterSpacing:'0.06em', marginBottom:6, textTransform:'uppercase' },
  scenarioText:  { margin:0, fontSize:14, color:'#111', lineHeight:1.65, wordBreak:'keep-all' },
  specCard:      { background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'14px 14px' },
  specLabel:     { fontSize:11, fontWeight:700, color:'var(--purple-600)', letterSpacing:'0.06em', marginBottom:8, textTransform:'uppercase' },
  specTag:       { fontSize:13, color:'var(--text-primary)', lineHeight:1.8, fontWeight:600 },
  actions:       { display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', paddingTop:8 },
  btnPrimary:    { padding:'14px 32px', borderRadius:'var(--radius-full)', border:'none', background:'#6D28D9', color:'#FFFFFF', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(109,40,217,0.35)' },
  btnSecondary:  { padding:'14px 24px', borderRadius:'var(--radius-full)', border:'1.5px solid #D4D4D8', background:'#FFFFFF', color:'#3F3F46', fontSize:14, fontWeight:600, cursor:'pointer' },
  btnGhost:      { padding:'14px 20px', borderRadius:'var(--radius-full)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-tertiary)', fontSize:13, fontWeight:600, cursor:'pointer' },
};
