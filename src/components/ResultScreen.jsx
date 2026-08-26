import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';

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

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return createPortal(
    <div style={{ position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)', background:'#1a1a1a', color:'#fff', padding:'12px 22px', borderRadius:40, fontSize:13, fontWeight:600, zIndex:99999, display:'flex', alignItems:'center', gap:8, boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>
      <span style={{ fontSize:16 }}>✨</span>{msg}
    </div>, document.body
  );
}

function useTypingEffect(text, speed = 80) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed(''); let i = 0;
    const timer = setInterval(() => { i++; setDisplayed(text.slice(0, i)); if (i >= text.length) clearInterval(timer); }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return displayed;
}

const LOADING_MSGS = [
  '매장 사진을 분석하고 있어요...','현재 브랜드 문제를 진단하고 있어요...',
  '리브랜딩 방향을 설계하고 있어요...','새 브랜드명을 구상하고 있어요...',
  '인테리어 방향을 완성하고 있어요...',
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

function ImgPlaceholderEmpty({ label, onGenerate, errMsg }) {
  return (
    <div style={{ height:140, border:'1.5px dashed #C4B5FD', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background:'linear-gradient(135deg,#faf8ff 0%,#f3f0ff 100%)', cursor:'pointer' }} onClick={onGenerate}>
      <div style={{ fontSize:24, opacity:0.35 }}>🖼</div>
      <div style={{ fontSize:12, color:'#7C3AED', fontWeight:600 }}>{label} 이미지 생성하기</div>
      {errMsg && <div style={{ fontSize:11, color:'#c0392b', marginTop:2 }}>⚠ {errMsg} — 탭해서 재시도</div>}
    </div>
  );
}

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

// ★ (2026-08-11) generate-interior의 응답이 엔진에 따라 세 형태로 온다.
//   · Stability Structure Control(공간 사진) → 동기 호출. 보통 imageUrl(Blobs에 저장된 짧은 URL),
//     Blobs 저장이 실패했을 때만 dataUrl로 폴백
//   · Flux 2 Pro(메뉴/정밀수정/사진없음)     → pollingUrl을 받아 flux-poll로 폴링
//   실패는 ok:false + fallbackResult 형태라 여기서 에러로 변환한다(호출부가 차감을 건너뛰도록).
async function resolveGeneratedImage(data) {
  if (data?.ok === false) throw new Error(data.error || '이미지 생성 실패');
  if (data?.imageUrl)   return data.imageUrl;
  if (data?.dataUrl)    return data.dataUrl;
  if (data?.pollingUrl) return await pollFlux(data.pollingUrl);
  throw new Error(data?.error || '이미지 생성 실패');
}

// ── ★ NEW: 이미지 수정 패널 — 기존 이미지는 유지하고, 텍스트로 요청한 부분만 반영 ──
// 브랜드보스의 EditRequestPanel과 동일한 UX. generate-interior.js의 "정밀 수정 모드"를 호출한다.
function EditRequestPanel({ currentUrl, imageType, onUpdated, useCredit, onCreditInsufficient }) {
  const [open, setOpen]       = useState(false);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg]   = useState('');

  const handleSubmit = async () => {
    if (!editText.trim()) return;
    if (useCredit) { const r = await useCredit('regen'); if (!r?.ok) { if (onCreditInsufficient) onCreditInsufficient(); return; } }
    setLoading(true); setErrMsg('');
    try {
      // 이전 결과가 data: URI(Stability 응답)면 URL로 못 받아오므로 inputImage로 직접 넘긴다.
      const isDataUri = typeof currentUrl === 'string' && currentUrl.startsWith('data:');
      const res = await fetch('/.netlify/functions/generate-interior', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editRequest: editText.trim(),
          ...(isDataUri ? { inputImage: currentUrl } : { editBaseImageUrl: currentUrl }),
          imageType: imageType || 'interior',
        }),
      });
      const newUrl = await resolveGeneratedImage(await res.json());
      onUpdated(newUrl);
      setOpen(false); setEditText('');
    } catch (e) { setErrMsg(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ marginTop: 6 }}>
      {!open ? (
        <button style={ep.editBtn} onClick={() => setOpen(true)}>✏️ 이미지 수정</button>
      ) : (
        <div style={ep.panel}>
          <div style={ep.panelTitle}>이 이미지에서 뭘 바꿀까요?</div>
          <div style={ep.hint}>예: 테이블을 밝은 우드로 / 조명 더 따뜻하게 / 간판 글자 크기 키워줘 — 나머지는 그대로 유지돼요.</div>
          <textarea style={ep.textarea} value={editText} onChange={e => setEditText(e.target.value)} placeholder="수정하고 싶은 부분만 자유롭게 적어주세요" rows={2} autoFocus />
          {errMsg && <p style={ep.err}>⚠ {errMsg}</p>}
          <div style={ep.panelBtns}>
            <button style={ep.cancelBtn} onClick={() => { setOpen(false); setEditText(''); setErrMsg(''); }} disabled={loading}>취소</button>
            <button style={{ ...ep.submitBtn, opacity: loading || !editText.trim() ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading || !editText.trim()}>
              {loading ? '수정 중...' : '✓ 이 부분만 수정'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
const ep = {
  editBtn:    { width:'100%', padding:'8px 0', borderRadius:'var(--radius-full)', border:'1.5px solid #D4D4D8', background:'#FAFAFA', color:'#3F3F46', fontSize:12, fontWeight:700, cursor:'pointer', marginTop:2 },
  panel:      { background:'var(--purple-50)', border:'1.5px solid var(--border-soft)', borderRadius:'var(--radius-md)', padding:'14px 14px 12px', display:'flex', flexDirection:'column', gap:8, marginTop:4 },
  panelTitle: { fontSize:13, fontWeight:800, color:'var(--text-primary)' },
  hint:       { fontSize:11, color:'var(--text-tertiary)', lineHeight:1.6, wordBreak:'keep-all' },
  textarea:   { width:'100%', padding:'10px 12px', borderRadius:'var(--radius-md)', border:'1.5px solid var(--border)', background:'var(--white)', fontSize:13, color:'var(--text-primary)', resize:'vertical', outline:'none', fontFamily:'inherit', lineHeight:1.55, boxSizing:'border-box' },
  err:        { margin:0, fontSize:12, color:'#9F1239', background:'#FFF1F2', padding:'6px 10px', borderRadius:8 },
  panelBtns:  { display:'flex', gap:8, justifyContent:'flex-end' },
  cancelBtn:  { padding:'7px 16px', borderRadius:'var(--radius-full)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-tertiary)', fontSize:12, fontWeight:600, cursor:'pointer' },
  submitBtn:  { padding:'7px 18px', borderRadius:'var(--radius-full)', border:'none', background:'#6D28D9', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' },
};

// ★ 2026-08-27: 생성 결과를 자기 안에 들고 있던 것을 부모 state로 올렸다(controlled).
//
//   왜. 이 블록들은 가이드라인 모달 안에 있었다. 모달을 닫으면 언마운트되고,
//   다시 열면 만들어 둔 이미지가 전부 사라져 크레딧을 또 써야 했다. 게다가
//   그렇게 만든 이미지는 결과 화면을 캡처하는 PDF에도 실릴 수 없었다.
//   이제 결과 화면이 imageUrl을 들고 있고, 이 블록은 보여주고 만들 뿐이다.
function SingleImgBlock({ label, promptText, inputImage, rebrandContext, imageType, useCredit, onCreditInsufficient, aspectRatio='16/9', imageUrl='', onGenerated }) {
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState('');
  const [toast,   setToast]   = useState(false);
  const [viewer,  setViewer]  = useState(false);
  const imgUrl = imageUrl;
  const setImgUrl = (url) => { if (onGenerated) onGenerated(url); };

  const handleGenerate = async () => {
    if (useCredit) { const r = await useCredit('image'); if (!r?.ok) { if (onCreditInsufficient) onCreditInsufficient(); return; } }
    setLoading(true); setErrMsg('');
    try {
      const body = { directPrompt: promptText };
      if (inputImage) { body.inputImage = inputImage; body.rebrandContext = rebrandContext; body.imageType = imageType||'interior'; body.photoIndex = 0; }
      const res  = await fetch('/.netlify/functions/generate-interior', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const url  = await resolveGeneratedImage(await res.json());
      setImgUrl(url); setToast(true);
    } catch (e) { setErrMsg(e.message); } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {toast && <Toast msg={`${label} 완성됐어요!`} onDone={() => setToast(false)} />}
      {viewer && imgUrl && <ImageViewer src={imgUrl} title={label} onClose={() => setViewer(false)} />}
      <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'0.08em', textTransform:'uppercase' }}>{label}</div>
      {imgUrl ? (
        <>
          <img src={imgUrl} alt={label} style={{ width:'100%', borderRadius:8, objectFit:'cover', aspectRatio, display:'block', cursor:'zoom-in' }} onClick={() => setViewer(true)} title="클릭 → 전체화면" />
          <EditRequestPanel currentUrl={imgUrl} imageType={imageType||'interior'} useCredit={useCredit} onCreditInsufficient={onCreditInsufficient} onUpdated={(newUrl) => setImgUrl(newUrl)} />
        </>
      ) : loading ? (
        <div style={{ height:140, border:'1.5px dashed #C4B5FD', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, background:'linear-gradient(135deg,#faf8ff,#f3f0ff)' }}>
          <span style={{ display:'inline-block', width:18, height:18, border:'2.5px solid #e5e5e5', borderTopColor:'#6D28D9', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
          <span style={{ fontSize:12, color:'#7C3AED' }}>생성 중... (20~30초)</span>
        </div>
      ) : <ImgPlaceholderEmpty label={label} onGenerate={handleGenerate} errMsg={errMsg} />}
    </div>
  );
}

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
      const res  = await fetch('/.netlify/functions/bb-brandname', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ brandDecision:{ brandName:rd.newBrandName, storeConcept:rd.newConcept, overallMood:rd.overallMood, coreCustomers:rd.targetCustomers, menuDirection:rd.menuDirection }, formData:resultData?.formData||{}, feedback }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error||'생성 실패');
      setNames(data.names||[]);
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
  triggerBtn:{ width:'100%', padding:'10px 0', borderRadius:'var(--radius-full)', border:'1.5px solid #6D28D9', background:'var(--purple-50)', color:'#6D28D9', fontSize:13, fontWeight:700, cursor:'pointer' },
  panel:{ background:'var(--white)', border:'1.5px solid var(--border-soft)', borderRadius:'var(--radius-lg)', padding:'16px', display:'flex', flexDirection:'column', gap:10 },
  panelHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center' },
  panelTitle:{ fontSize:14, fontWeight:800, color:'var(--text-primary)' },
  closeBtn:{ border:'none', background:'transparent', color:'var(--text-tertiary)', fontSize:16, cursor:'pointer', padding:'0 4px' },
  textarea:{ width:'100%', padding:'10px 12px', borderRadius:'var(--radius-md)', border:'1.5px solid var(--border)', background:'#fafafa', fontSize:13, color:'var(--text-primary)', resize:'none', outline:'none', fontFamily:'inherit', lineHeight:1.55, boxSizing:'border-box' },
  genBtn:{ width:'100%', padding:'11px 0', borderRadius:'var(--radius-full)', border:'none', background:'#6D28D9', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' },
  err:{ margin:0, fontSize:12, color:'#9F1239', background:'#FFF1F2', padding:'8px 10px', borderRadius:8 },
  nameCard:{ padding:'14px 16px', border:'1.5px solid var(--border)', borderRadius:'var(--radius-md)', cursor:'pointer', transition:'all 0.15s' },
  nameCardSelected:{ border:'1.5px solid #6D28D9', background:'var(--purple-50)' },
  nameText:{ fontSize:18, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.03em', marginBottom:3 },
  nameTagline:{ fontSize:12, color:'#6D28D9', fontWeight:600, marginBottom:5 },
  nameReason:{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 },
};

// ★ 핵심: 사진 타입 자동 판별 함수
function detectPhotoType(photo) {
  if (photo?.type) return photo.type; // 'exterior' | 'interior' | 'menu'
  return 'interior';
}

// ── 부각시킬 소품 입력 ────────────────────────────────────
//
// ★ 2026-08-27: 소품 사진에서 무엇을 앞세울지 사용자가 직접 적는다.
//
//   왜 자유 입력인가. 소품은 매장마다 완전히 달라서(놋그릇·유리 저그·빈티지 촛대·
//   전통 소반·화병...) 목록으로 고르게 만들면 반드시 "내 것이 없는" 사람이 생긴다.
//   비워두면 종전대로 컨셉에 맞게 알아서 고른다 — 선택 입력이다.
//
//   적은 값은 서버(generate-interior.js)가 영문으로 옮겨 프롬프트에 싣는다.
//   한국어를 그대로 실으면 FLUX에 도달하지 못한다.
function PropFocusField({ value, onChange, dirty }) {
  return (
    <div style={pf.wrap}>
      <div style={pf.label}>부각시킬 소품 <span style={pf.optional}>선택</span></div>
      <input
        style={pf.input} value={value} onChange={e => onChange(e.target.value)}
        placeholder="예: 놋그릇, 빈티지 촛대, 나무 트레이"
        maxLength={60}
      />
      <div style={pf.hint}>
        {dirty
          ? '바꾼 뒤 ↺ 전체 재생성을 눌러야 반영돼요.'
          : '적은 소품이 화면 앞쪽에 선명하게 옵니다. 비워두면 컨셉에 맞게 알아서 고릅니다.'}
      </div>
    </div>
  );
}
const pf = {
  wrap:     { display:'flex', flexDirection:'column', gap:6, padding:'12px 14px', background:'var(--purple-50)', border:'1px solid var(--border-soft)', borderRadius:'var(--radius-md)' },
  label:    { fontSize:11, fontWeight:800, color:'#6D28D9', letterSpacing:'0.04em' },
  optional: { fontSize:10, fontWeight:600, color:'var(--text-tertiary)', marginLeft:4 },
  input:    { width:'100%', padding:'9px 12px', borderRadius:'var(--radius-md)', border:'1.5px solid var(--border)', background:'var(--white)', fontSize:13, color:'var(--text-primary)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  hint:     { fontSize:11, color:'var(--text-tertiary)', lineHeight:1.6, wordBreak:'keep-all' },
};

// ── 방향 카드 ─────────────────────────────────────────────
function DirectionCard({ title, label, text, sectionKey, resultData, fullWidth, useCredit, checkLimit, onCreditInsufficient, inputPhotos = [], onSaveImages }) {
  const [imgState, setImgState] = useState('idle');
  const [imgUrls,  setImgUrls]  = useState([]);
  const [errMsg,   setErrMsg]   = useState('');
  const [viewIdx,  setViewIdx]  = useState(null);
  const [toast,    setToast]    = useState(false);
  // ★ 2026-08-27: 소품 카드에서만 쓰는 "부각시킬 소품". 서버가 영문으로 옮겨 프롬프트에 싣는다.
  const [propFocus, setPropFocus] = useState('');
  const isSpace = sectionKey === 'space';
  const isMenu  = sectionKey === 'menu';
  const rd  = resultData?.rebrandDecision      || {};
  const pkg = resultData?.interiorImagePackage || {};
  const fd  = resultData?.formData             || {};

  const rebrandCtx = {
    newBrandName:  rd.newBrandName  || '',
    newConcept:    rd.newConcept    || '',
    overallMood:   rd.overallMood   || pkg.moodTone || '',
    materials:     pkg.materialKeywords || [],
    colors:        pkg.colorKeywords    || [],
    signatureSpot: pkg.signatureSpot    || '',
    changeScope:   fd.changeScope   || '',
    budget:        fd.budget        || '',
    budgetMemo:    fd.budgetMemo    || fd.budgetNote || '',
    rawMenu:       fd.menu          || '',
  };

  const buildPrompt = (idx = 0) => {
    const brand     = rd.newBrandName || '';
    const concept   = rd.newConcept   || '';
    const mood      = pkg.moodTone    || rd.overallMood || '';
    const materials = (pkg.materialKeywords||[]).slice(0,3).join(', ');
    const colors    = (pkg.colorKeywords||[]).slice(0,2).join(', ');
    const base = `Photorealistic ${concept} restaurant. Brand: ${brand}. Mood: ${mood}. Materials: ${materials}. Colors: ${colors}. No people. No text.`;
    if (isMenu)                 return `Food plating photography. ${base} Overhead view. Michelin-star plating.`;
    // ★ 2026-08-27: 종전 프롬프트는 base("Photorealistic ... restaurant")를 그대로 써서
    //   매장이 주인공이고 소품은 배경에 흩어진 사진이 나왔다. 소품 카드인데 소품이
    //   안 보이는 셈이다. 그래서 이 카드만 base를 쓰지 않고 소품을 피사체로 못박는다.
    if (sectionKey==='prop')    return [
      'PROPS ARE THE SUBJECT of this photograph.',
      'Close-up styled photography of decorative interior props. No people. No text. Ultra-detailed textures.',
      'The props fill 70-80% of the frame, sit in the immediate foreground, and are TACK SHARP.',
      'Shallow depth of field with the focus plane ON THE PROPS — only what is BEHIND them falls into soft bokeh.',
      concept   ? `Restaurant concept: ${concept}.` : '',
      mood      ? `Mood: ${mood}.` : '',
      materials ? `Materials: ${materials}.` : '',
      colors    ? `Colors: ${colors}.` : '',
      '3-5 thematic decorative pieces matching the concept. Do NOT mix themes.',
    ].filter(Boolean).join(' ');
    if (sectionKey==='service') return `Restaurant staff uniform. ${base} 2-3 staff in themed uniform.`;
    const angles = [`Wide establishing shot from entrance. ${base}`, `Same space from back toward entrance. ${base}`, `Signature zone: ${pkg.signatureSpot||'distinctive area'}. ${base}`];
    return angles[idx] || angles[0];
  };

  const handleGenerate = async () => {
    // ★ 수정 (2026-07-27): space는 첨부 사진 1장당 이미지 1장을 실제로 생성하므로(최대 5장),
    //   생성될 이미지 수(imageCount)를 서버에 함께 보내 "장수 × 단가"로 차감하게 한다.
    //   이전에는 사진 1장을 올리든 5장을 올리든 항상 고정 30크레딧이 차감됐다.
    // ★ 수정 (2026-08-11): 차감 시점을 "생성 전 일괄"에서 "장당 생성 성공 후"로 옮겼다.
    //   전에는 5장분을 미리 빼놓고 3장째에서 실패하면 못 받은 2장 값까지 날아갔다.
    //   이제는 checkLimit으로 먼저 잔액만 확인하고, 실제로 나온 이미지에 대해서만 차감한다.
    //   (space 단가 = image 단가 × 장수이므로 총액은 종전과 동일하다.)
    const imageCount = Math.max(1, Math.min(inputPhotos.length || 1, 5));
    if (checkLimit) {
      const c = checkLimit(isSpace ? 'space' : 'image', isSpace ? { imageCount } : undefined);
      if (!c?.allowed) { if (onCreditInsufficient) onCreditInsufficient(); return; }
    }
    // 장당 성공 직후 차감. 잔액이 도중에 바닥나면 거기서 멈춘다.
    const chargeOne = async () => {
      if (!useCredit) return true;
      const r = await useCredit('image');
      if (!r?.ok) { if (onCreditInsufficient) onCreditInsufficient(); return false; }
      return true;
    };

    setImgState('loading'); setErrMsg(''); setImgUrls([]);

    try {
      if ((isSpace || isMenu) && inputPhotos.length > 0) {
        const photosToUse = inputPhotos.slice(0, 5);
        const urls = [];
        let lastErr = '';
        for (let i = 0; i < photosToUse.length; i++) {
          const photo = photosToUse[i];
          const photoType = isMenu ? 'menu' : detectPhotoType(photo);

          // 한 장이 실패해도 나머지는 계속 만든다(실패한 장은 차감도 안 된다).
          let url;
          try {
            const res = await fetch('/.netlify/functions/generate-interior', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({
                directPrompt:   buildPrompt(Math.min(i, 2)),
                inputImage:     photo.base64,
                rebrandContext: rebrandCtx,
                imageType:      photoType,
                photoIndex:     i,
              })
            });
            url = await resolveGeneratedImage(await res.json());
          } catch (e) { lastErr = e.message; continue; }

          if (!(await chargeOne())) break;
          urls.push({ url, photoType });
          setImgUrls([...urls]);
        }
        if (urls.length === 0) throw new Error(lastErr || '이미지 생성 실패');
        if (lastErr) setErrMsg(`일부 사진은 실패했어요: ${lastErr}`);
        setImgState('done'); setToast(true);
        // ★ NEW: 생성 완료되면 프로젝트에 자동저장 (space는 배열, 그 외는 단일 URL)
        if (onSaveImages) onSaveImages(sectionKey, isSpace ? urls.map(u => u.url) : (urls[0]?.url || ''));

      } else {
        const count = isSpace ? 3 : 1;
        const urls = [];
        for (let i = 0; i < count; i++) {
          const res = await fetch('/.netlify/functions/generate-interior', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              directPrompt: buildPrompt(i),
              // 소품 카드에서 지정한 것만 싣는다. 다른 카드에는 의미가 없다.
              ...(sectionKey === 'prop' && propFocus.trim() ? { propFocus: propFocus.trim() } : {}),
            })
          });
          const url = await resolveGeneratedImage(await res.json());
          if (!(await chargeOne())) break;
          urls.push({ url, photoType:'interior' });
          setImgUrls([...urls]);
        }
        setImgState('done'); setToast(true);
        // ★ NEW: 생성 완료되면 프로젝트에 자동저장
        if (onSaveImages) onSaveImages(sectionKey, isSpace ? urls.map(u => u.url) : (urls[0]?.url || ''));
      }
    } catch(e) { setErrMsg(e.message); setImgState('error'); }
  };

  // ★ 특정 인덱스의 이미지만 새 URL로 교체 (정밀 수정 결과 반영용) + 저장소도 갱신
  const handleImageUpdated = (idx, newUrl) => {
    setImgUrls(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], url: newUrl };
      if (onSaveImages) onSaveImages(sectionKey, isSpace ? n.map(u => u.url) : (n[0]?.url || ''));
      return n;
    });
  };

  const accentColor = isSpace ? '#9333EA' : '#6D28D9';
  const hasPhotos   = inputPhotos.length > 0;
  const totalCount  = Math.min(inputPhotos.length, 5);

  const typeLabel = (type) => {
    if (type === 'exterior') return '🏪 외관';
    if (type === 'menu')     return '🍽 메뉴';
    return '🏠 내부';
  };

  return (
    <div style={{...dc.card,...(fullWidth?{maxWidth:'100%'}:{})}}>
      {toast && <Toast msg={`${title} 이미지 완성됐어요!`} onDone={() => setToast(false)} />}
      {viewIdx !== null && imgUrls[viewIdx] && <ImageViewer src={imgUrls[viewIdx].url} title={`${title} ${viewIdx+1}`} onClose={() => setViewIdx(null)} />}
      <div style={{...dc.cardBar, background:accentColor}} />
      <div style={dc.cardInner}>
        <div style={dc.cardLabel}>{label}</div>
        <div style={dc.cardTitle}>{title}</div>
        {hasPhotos && (isSpace || isMenu) && (
          <div style={{ fontSize:11, color:'#6D28D9', background:'#EEE8FF', padding:'4px 10px', borderRadius:999, display:'inline-flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
            📸 사진 {inputPhotos.length}장 변환
            {isSpace && (
              <span style={{ fontSize:10, color:'#888' }}>
                ({inputPhotos.map(p => typeLabel(detectPhotoType(p))).join(' · ')})
              </span>
            )}
            {isMenu && ' · 각 사진 다른 플레이팅'}
          </div>
        )}
        <div style={dc.cardDivider} />
        <p style={dc.cardText}>{text}</p>
        {sectionKey === 'prop' && <PropFocusField value={propFocus} onChange={setPropFocus} dirty={imgUrls.length > 0} />}

        {imgUrls.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={imgUrls.length > 1 ? { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:8 } : {}}>
              {imgUrls.map((item, i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {hasPhotos && inputPhotos[i] && (
                    <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:2 }}>
                      <img src={inputPhotos[i].preview} alt="원본" style={{ width:36, height:36, borderRadius:4, objectFit:'cover', opacity:0.7 }} />
                      <span style={{ fontSize:10, color:'#aaa' }}>→</span>
                      <span style={{ fontSize:10, color:'#6D28D9', background:'#EEE8FF', padding:'2px 6px', borderRadius:4 }}>
                        {typeLabel(item.photoType)} 변환
                        {isMenu && ` · 플레이팅 ${i+1}`}
                      </span>
                    </div>
                  )}
                  <img src={item.url} alt={`${title} ${i+1}`}
                    style={{ width:'100%', borderRadius:8, objectFit:'cover', aspectRatio:isSpace?'16/9':isMenu?'1/1':'3/2', display:'block', cursor:'zoom-in' }}
                    onClick={() => setViewIdx(i)} title="클릭 → 전체화면" />
                  {/* ★ NEW: 이미지 수정 버튼 — 이 이미지는 유지하고 텍스트 요청만 반영 */}
                  <EditRequestPanel
                    currentUrl={item.url}
                    imageType={item.photoType}
                    useCredit={useCredit}
                    onCreditInsufficient={onCreditInsufficient}
                    onUpdated={(newUrl) => handleImageUpdated(i, newUrl)}
                  />
                </div>
              ))}
            </div>
            {imgState === 'loading' && (
              <div style={dc.loadingBox}>
                <span style={dc.spinner}/>
                <span style={{ fontSize:12, color:'#7C3AED' }}>추가 생성 중... ({imgUrls.length}/{totalCount || 3})</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 2px 0' }}>
              <span style={{ fontSize:11, color:'var(--text-tertiary)' }}>🔍 클릭 → 전체화면</span>
              <button style={dc.regenBtn} onClick={handleGenerate} disabled={imgState==='loading'}>↺ 전체 재생성</button>
            </div>
          </div>
        ) : imgState === 'loading' ? (
          <div style={dc.loadingBox}>
            <span style={dc.spinner}/>
            <span style={{ fontSize:12, color:'#7C3AED' }}>
              {hasPhotos
                ? `${totalCount}장 변환 중... (장당 20~40초)`
                : '생성 중... (20~30초)'}
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
  card:{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'var(--shadow-sm)', display:'flex', flexDirection:'column' },
  cardBar:{ height:4, width:'100%', borderRadius:'14px 14px 0 0' },
  cardInner:{ padding:'18px 18px 20px', display:'flex', flexDirection:'column', gap:10, flex:1 },
  cardLabel:{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', letterSpacing:'0.08em', textTransform:'uppercase' },
  cardTitle:{ fontSize:16, fontWeight:800, color:'var(--text-primary)' },
  cardDivider:{ height:1, background:'var(--border)' },
  cardText:{ margin:0, fontSize:13, color:'var(--text-secondary)', lineHeight:1.65, wordBreak:'keep-all', flex:1 },
  loadingBox:{ display:'flex', alignItems:'center', gap:8, padding:'12px', background:'var(--purple-50)', borderRadius:8 },
  spinner:{ display:'inline-block', width:16, height:16, border:'2.5px solid var(--border)', borderTopColor:'var(--purple-600)', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 },
  regenBtn:{ padding:'7px 14px', borderRadius:'var(--radius-full)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-tertiary)', fontSize:12, fontWeight:600, cursor:'pointer' },
};

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

// ★ BudgetScenariosSection 완전 삭제됨 (예산/범위 스텝을 프론트에서 없앴으므로)

// ★ NEW: 체크리스트 항목별 상세 가이드 (브랜드보스의 buildGuide 패턴을 리브랜딩 맥락에 맞게 이식)
function buildRebrandChecklistGuide(item, category) {
  const isLegal     = /사업자|허가|위생|신고|등록|면허|소방|영업/i.test(item);
  const isMenu      = /메뉴|레시피|식자재|원가|공급|납품|리뉴얼/i.test(item);
  const isSignage   = /간판|로고|사인|외관/i.test(item);
  const isSns       = /sns|인스타|홍보|마케팅|채널/i.test(item);
  const isCustomer  = /단골|안내|공지|고객/i.test(item);

  if (isSignage) return {
    steps: ['새 로고 파일(AI/PDF/투명PNG) 확보 — 간판업체 필수 제출용', '기존 간판 철거 여부 및 건물주 승인 확인', '간판업체 2~3곳 견적 비교 (LED/아크릴/채널간판 등 종류별 단가 확인)', '설치 전 야간 조명 시안 확인 (밝기·색온도가 실제 브랜드 톤과 맞는지)'],
    cautions: ['간판 크기·위치는 건축법·옥외광고물법 규제 확인 필요 (구청 문의)', '설치 후 A/S 기간과 파손 시 재제작 비용 사전 확인'],
  };
  if (isLegal) return {
    steps: ['사업자 정보 변경(상호명) — 홈택스에서 온라인 정정 신고', '기존 영업신고증의 상호 변경 — 관할 구청 위생과 방문', '간판/포스터 등에 표기되는 사업자등록번호 최신 상태 확인'],
    cautions: ['상호 변경은 세금계산서·카드단말기 등록정보에도 함께 반영해야 함', '변경 누락 시 세무 신고 시 혼선 발생 가능'],
  };
  if (isMenu) return {
    steps: ['기존 인기 메뉴는 유지하되 플레이팅/이름만 리뉴얼', '신메뉴는 최소 2주 시식 테스트 후 확정', '메뉴판 디자인 확정 후 인쇄 전 오탈자·가격 최종 검수', '기존 단골에게 "맛은 그대로, 모습만 새롭게" 임을 명확히 안내'],
    cautions: ['가격을 동시에 인상하면 리브랜딩에 대한 반감 생길 수 있음 — 시점 분리 고려', '레시피 표준화 문서 없이 담당자 교체 시 맛이 흔들릴 위험'],
  };
  if (isSns) return {
    steps: ['기존 SNS 계정의 이름·프로필·커버 이미지를 새 브랜드로 변경', '"우리 이렇게 달라졌어요" 비포/애프터 콘텐츠 최소 3개 준비', '오픈 기념 이벤트(할인/사은품) 기획 및 일정 확정', '네이버 플레이스 등 지도 서비스 정보도 함께 업데이트'],
    cautions: ['기존 팔로워에게 급격한 변화로 비치지 않도록 사전 예고 게시물 필요', '리뷰/후기 페이지의 구 상호명도 함께 확인 (혼선 방지)'],
  };
  if (isCustomer) return {
    steps: ['단골 고객 대상 문자/카카오톡 채널로 사전 공지', '"이름만 바뀌었어요, 사장님은 그대로예요" 메시지로 신뢰 유지', '변경 기간 중 방문 고객에게 소소한 웰컴 혜택 제공'],
    cautions: ['공지 없이 갑자기 바뀌면 폐업으로 오해하는 경우 많음 — 사전 안내 필수'],
  };
  return { steps: [`${item} — 오픈 전 담당자를 정하고 완료 기한을 설정하세요.`], cautions: [] };
}

// ★ NEW: 체크리스트 상세 (클릭하면 펼쳐지며 진행순서/주의사항 표시, 완료 체크는 세션 내에서만 유지)
function RebrandChecklistDetail({ checklist, category }) {
  const [doneState, setDoneState] = useState(() => checklist.map(() => false));
  const [expanded,  setExpanded]  = useState(() => checklist.map((_, i) => i === 0));
  const doneCount = doneState.filter(Boolean).length;
  const pct = Math.round((doneCount / checklist.length) * 100);
  const dot = { width:5, height:5, borderRadius:'50%', background:'#7F77DD', flexShrink:0, marginTop:6 };
  const row = { display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'#111', lineHeight:1.6, marginBottom:5 };
  const tl  = { fontSize:11, fontWeight:700, color:'#888', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8, marginTop:12 };

  const toggleDone   = (i) => setDoneState(p => p.map((d, idx) => idx === i ? !d : d));
  const toggleExpand = (i) => setExpanded(p => p.map((e, idx) => idx === i ? !e : e));

  return (
    <div>
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
        {checklist.map((item, i) => {
          const isDone = doneState[i];
          const isOpen = expanded[i];
          const guide  = buildRebrandChecklistGuide(item, category);
          return (
            <div key={i} style={{ border:'1px solid #e5e5e5', borderRadius:10, overflow:'hidden', background:'#fff', opacity: isDone ? 0.6 : 1 }}>
              <div onClick={() => toggleExpand(i)} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', cursor:'pointer' }}>
                <div onClick={e => { e.stopPropagation(); toggleDone(i); }} style={{ width:22, height:22, borderRadius:'50%', border: isDone ? 'none' : '1.5px solid #ddd', background: isDone ? '#7F77DD' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer' }}>
                  {isDone && <span style={{ color:'#fff', fontSize:13 }}>✓</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:'#aaa', marginBottom:2 }}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{ fontSize:14, fontWeight:600, color: isDone ? '#aaa' : '#111', textDecoration: isDone ? 'line-through' : 'none', wordBreak:'keep-all' }}>{item}</div>
                </div>
                <span style={{ fontSize:14, color:'#aaa', transform: isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▾</span>
              </div>
              {isOpen && (
                <div style={{ borderTop:'1px solid #f0f0f0', padding:'14px 16px', background:'#fafafa' }}>
                  {guide.steps.length > 0 && (<><div style={tl}>📋 진행 순서</div>{guide.steps.map((s, si) => <div key={si} style={row}><div style={dot} /><span>{s}</span></div>)}</>)}
                  {guide.cautions.length > 0 && (<><div style={tl}>⚠ 주의사항</div>{guide.cautions.map((c, ci) => <div key={ci} style={row}><div style={dot} /><span>{c}</span></div>)}</>)}
                  <button onClick={() => toggleDone(i)} style={{ width:'100%', padding:9, marginTop:10, borderRadius:8, border: isDone ? '1px solid #ddd' : 'none', background: isDone ? '#fff' : '#7F77DD', color: isDone ? '#888' : '#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                    {isDone ? '완료 취소' : '✓ 완료로 표시하기'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {pct === 100 && (
        <div style={{ marginTop:16, padding:16, background:'#e8f5e9', borderRadius:10, textAlign:'center' }}>
          <div style={{ fontSize:22, marginBottom:6 }}>🎉</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#2e7d32' }}>리브랜딩 준비 완료!</div>
        </div>
      )}
    </div>
  );
}

// ── 가이드라인 자산 이미지 정의 ────────────────────────────
//
// ★ 2026-08-27: 가이드라인 모달 안에 흩어져 있던 이미지 생성기(SingleImgBlock 5개
//   섹션)를 결과 화면으로 옮기면서, "무엇을 만들 수 있는가"의 정의를 여기 한 곳에 모았다.
//
//   왜 옮겼나. 세 가지가 동시에 걸렸다.
//     ① 모달을 닫으면 생성 결과가 통째로 사라졌다(컴포넌트 언마운트). 다시 보려면
//        크레딧을 또 써야 했다 — 1장당 10크레딧이다.
//     ② 그렇게 만든 이미지는 결과 화면을 캡처하는 PDF에 실릴 수 없었다.
//        "가이드라인에 들어갈 이미지"인데 정작 가이드에 안 실리는 상태였다.
//     ③ 이미지를 만들려면 먼저 모달을 열어야 한다는 것을 아는 사용자가 거의 없었다.
//
//   이제 결과 화면이 만들고 들고 있으며, 모달과 PDF는 그것을 읽기만 한다.
//   프롬프트가 두 화면에서 갈라지는 일도 이 함수 하나로 막힌다.
//   ★ 2026-08-27 (2차): 여기 있던 "공간 3컷"은 뺐다.
//     결과 화면의 "공간 연출" 방향 카드가 이미 같은 일을, 더 낫게 하고 있었다.
//     그 카드는 올린 매장 사진 전부(최대 5장)를 buildStructurePrompt(rebrandContext
//     전체 + tier 로직)로 변환하는데, 여기 있던 3컷은 같은 사진 앞 2장을 한 줄짜리
//     directPrompt로 다시 변환하는 것이었다. 남겨두면 같은 사진 변환에 사용자가
//     두 번 낸다(각 10크레딧). 게다가 방향 카드 결과만 onSaveImages로 프로젝트에
//     저장되고, 여기 것은 새로고침하면 사라졌다.
//     가이드라인 모달의 "리브랜딩 후 공간"은 이제 방향 카드 결과를 읽는다.
function buildGuidelineAssets(resultData) {
  const rd  = resultData?.rebrandDecision      || {};
  const pkg = resultData?.interiorImagePackage || {};
  const mood   = rd.overallMood || pkg.moodTone || '';
  const colors = (pkg.colorKeywords || []).slice(0, 2).join(', ');

  const groups = [];

  // 01 · 소재
  if (pkg.materialKeywords?.length > 0) {
    groups.push({
      key: 'material', title: '소재',
      items: pkg.materialKeywords.map((m, i) => ({
        id: `material-${i}`, label: m, aspectRatio: '4/3',
        prompt: `MACRO CLOSE-UP material texture photography. Subject: "${m}". Color palette: ${colors}. Brand mood: ${mood}. 4K ultra-detailed texture. No people. No text.`,
      })),
    });
  }

  // 02 · 가구
  if (pkg.furnitureKeywords?.length > 0) {
    groups.push({
      key: 'furniture', title: '가구',
      items: pkg.furnitureKeywords.map((f, i) => {
        const isSeating = /의자|소파|체어|좌석|벤치|stool|chair|bench|sofa/i.test(f);
        return {
          id: `furniture-${i}`, label: f, aspectRatio: '4/3',
          prompt: `Product photography of furniture: "${f}". ${isSeating ? 'Upholstery and cushion details visible' : 'Form and material clearly visible'}. Clean studio background. ${rd.newConcept || ''} restaurant style. Studio lighting. No people. No text.`,
        };
      }),
    });
  }

  // 03 · 반드시 있어야 할 요소
  if (pkg.mustHaveElements?.length > 0) {
    const shots = ['wide establishing shot showing full context', 'medium shot at eye level', 'close-up detail shot highlighting texture and materials'];
    groups.push({
      key: 'musthave', title: '반드시 있어야 할 요소',
      items: pkg.mustHaveElements.map((item, i) => ({
        id: `musthave-${i}`, label: item, aspectRatio: '16/9',
        prompt: `Restaurant interior showcasing: "${item}". ${shots[i % shots.length]}. ${rd.newConcept || ''}. ${mood}. No people. No text. Photorealistic.`,
      })),
    });
  }

  // 04 · 시그니처 공간 / 브랜드 스토리
  const extras = [];
  if (pkg.signatureSpot) extras.push({
    id: 'signature', label: '시그니처 공간', aspectRatio: '16/9',
    prompt: `Restaurant interior focusing on signature spot: "${pkg.signatureSpot}". Brand: ${rd.newBrandName}. ${mood}. Dramatic lighting. Wide-angle. No people. No text.`,
  });
  if (pkg.narrative) extras.push({
    id: 'narrative', label: '브랜드 스토리 포스터', aspectRatio: '16/9',
    prompt: `Editorial brand poster photography for a restaurant called "${rd.newBrandName}". Tagline: "${rd.tagline || ''}". Concept: ${rd.newConcept}. ${mood}. Cinematic wide shot. Moody atmospheric lighting. No readable text. No people. No logo. Photorealistic.`,
  });
  if (extras.length) groups.push({ key: 'extra', title: '시그니처 · 브랜드 스토리', items: extras });

  return groups;
}

// ── 자산 이미지 섹션 (결과 화면) ───────────────────────────
function BrandAssetsSection({ resultData, assetImages, onAssetGenerated, useCredit, onCreditInsufficient }) {
  const groups = buildGuidelineAssets(resultData);
  if (!groups.length) return null;

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const done  = groups.reduce((n, g) => n + g.items.filter(it => assetImages[it.id]).length, 0);

  return (
    <section style={ba.wrap}>
      <div style={ba.header}>
        <div style={ba.label}>BRAND ASSETS</div>
        <h3 style={ba.title}>가이드에 들어갈 <span style={{ color:'#7c3aed' }}>자산 이미지</span></h3>
        <p style={ba.desc}>
          소재·가구·필수 요소·시그니처 이미지를 여기서 만듭니다. 만든 이미지는 가이드 PDF에 함께 실립니다.
          공간 이미지는 위의 <strong>공간 연출</strong> 카드에서 만들면 가이드에 자동으로 실립니다.
          <strong> 1장당 10크레딧</strong>이며, 필요한 것만 골라 만들면 됩니다.
        </p>
        <div style={ba.progress}>{done} / {total} 생성됨</div>
      </div>
      {groups.map(g => (
        <div key={g.key} style={ba.group}>
          <div style={ba.groupTitle}>{g.title}</div>
          <div style={ba.grid}>
            {g.items.map(item => (
              <SingleImgBlock
                key={item.id} label={item.label} promptText={item.prompt}
                inputImage={item.inputImage} rebrandContext={item.rebrandContext}
                imageType={item.imageType} aspectRatio={item.aspectRatio}
                imageUrl={assetImages[item.id] || ''}
                onGenerated={(url) => onAssetGenerated(item.id, url)}
                useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
const ba = {
  wrap:       { background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-xl)', padding:'28px 28px 24px', boxShadow:'var(--shadow-sm)', display:'flex', flexDirection:'column', gap:18 },
  header:     { display:'flex', flexDirection:'column', gap:8 },
  label:      { fontSize:11, fontWeight:700, color:'var(--purple-600)', letterSpacing:'0.1em' },
  title:      { margin:0, fontSize:'clamp(18px,2.5vw,22px)', fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  desc:       { margin:0, fontSize:13, color:'var(--text-secondary)', lineHeight:1.65, wordBreak:'keep-all' },
  progress:   { alignSelf:'flex-start', padding:'4px 12px', borderRadius:999, background:'var(--purple-50)', color:'#6D28D9', fontSize:12, fontWeight:700 },
  group:      { display:'flex', flexDirection:'column', gap:10 },
  groupTitle: { fontSize:13, fontWeight:800, color:'var(--text-primary)' },
  grid:       { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 },
};

// ── 가이드라인 모달 안의 읽기 전용 이미지 ──────────────────
// 생성은 결과 화면에서만 한다. 여기서 또 만들 수 있게 두면 어디서 만든 것이
// 어디에 남는지가 다시 갈라진다.
function GuidelineImage({ label, url, aspectRatio = '16/9' }) {
  const [viewer, setViewer] = useState(false);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {viewer && url && <ImageViewer src={url} title={label} onClose={() => setViewer(false)} />}
      <div style={{ fontSize:10, fontWeight:700, color:'#555', letterSpacing:'0.08em', textTransform:'uppercase' }}>{label}</div>
      {url ? (
        <img src={url} alt={label} style={{ width:'100%', borderRadius:8, objectFit:'cover', aspectRatio, display:'block', cursor:'zoom-in' }}
          onClick={() => setViewer(true)} title="클릭 → 전체화면" />
      ) : (
        <div style={{ aspectRatio, border:'1.5px dashed #ddd', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 12px', textAlign:'center', fontSize:11, color:'#999', lineHeight:1.6, wordBreak:'keep-all' }}>
          아직 만들지 않았어요 · 결과 화면의 &quot;자산 이미지&quot;에서 생성
        </div>
      )}
    </div>
  );
}

// ── 브랜드 가이드라인 모달 ─────────────────────────────────
//
// ★ 2026-08-27: 두 가지가 바뀌었다.
//   ① 이미지 생성기(SingleImgBlock)를 전부 결과 화면으로 내보냈다. 여기서는 읽기만 한다.
//      이유는 buildGuidelineAssets 머리말 참고.
//   ② "인테리어 실행 가이드"와 "실행 체크리스트"(구 09·10 섹션)를 떼어내
//      별도 모달(InteriorGuideModal)로 옮겼다.
//      두 문서는 용도가 다르다 — 가이드라인은 업체에 넘기는 브랜드 자료이고,
//      실행 가이드·체크리스트는 사장님이 며칠씩 들고 다니며 체크하는 작업 문서다.
//      한 모달에 붙여두면 브랜드 자료를 보려 열 때마다 그 뒤로 스크롤이 이어졌고,
//      PDF로 넘기면 업체에게 줄 자료에 "계약 전 주의사항"까지 딸려 나갔다.
function BrandGuidelineModal({ resultData, assetImages = {}, spaceImages = [], onClose, onDownloadPdf, pdfLoading }) {
  const rd  = resultData?.rebrandDecision      || {};
  const pkg = resultData?.interiorImagePackage || {};
  const fd  = resultData?.formData             || {};
  const bg  = rd.brandGuideline               || {};
  const today = new Date().toLocaleDateString('ko-KR');
  const bodyRef = useRef(null);
  const img = (id) => assetImages[id] || '';

  return createPortal(
    <div style={gm.overlay}>
      <div style={gm.modal}>
        <div style={gm.header}>
          <div><div style={gm.headerTitle}>📋 리브랜딩 가이드라인</div><div style={gm.headerSub}>{rd.newBrandName} · {today}</div></div>
          <div style={{ display:'flex', gap:10 }}>
            {/* ★ 2026-08-27: 결과 화면의 "PDF 다운로드" 버튼을 여기로 합쳤다.
                열어서 확인하고 그 자리에서 받는다. 받기만 하려는 사람을 위해 기본 강조로 둔다. */}
            <button style={{ ...gm.printBtn, opacity: pdfLoading ? 0.6 : 1 }} onClick={() => onDownloadPdf(bodyRef)} disabled={pdfLoading}>
              {pdfLoading ? '⏳ 생성 중...' : '⬇ PDF 다운로드'}
            </button>
            <button style={gm.closeBtn} onClick={onClose}>✕ 닫기</button>
          </div>
        </div>
        <div style={gm.body} ref={bodyRef}>
          <div style={gm.cover}>
            <div style={gm.coverBadge}>REBRAND GUIDELINES · REBRANDBOSS</div>
            <div style={gm.coverName}>{rd.newBrandName||''}</div>
            {rd.tagline && <div style={gm.coverTagline}>{rd.tagline}</div>}
            <div style={gm.coverMeta}>
              {fd.category     && <span><strong>업종</strong> {fd.category}</span>}
              {fd.storeAddress && <span><strong>주소</strong> {fd.storeAddress}</span>}
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
          {(bg.mainColor||bg.subColor) && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>02 · Color Palette</div>
              <div style={gm.sectionTitle}>브랜드 컬러</div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {[bg.mainColor,bg.subColor,...(pkg.colorKeywords||[])].filter(Boolean).map((c,i) => {
                  const hex=c.match(/#[0-9A-Fa-f]{3,6}/)?.[0]; if (!hex) return null;
                  return (<div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}><div style={{ width:60, height:60, borderRadius:8, background:hex, border:'1px solid rgba(0,0,0,0.08)' }}/><div style={{ fontSize:10, color:'#555', textAlign:'center' }}>{i===0?'메인':i===1?'보조':c.replace(/#[0-9A-Fa-f]{3,6}/,'').trim()}</div><div style={{ fontSize:10, color:'#888', fontFamily:'monospace' }}>{hex}</div></div>);
                })}
              </div>
            </div>
          )}
          {(bg.logoDirection||bg.fontDirection||bg.signageDirection) && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>03 · Identity</div>
              <div style={gm.sectionTitle}>로고 · 폰트 · 간판</div>
              <div style={gm.coreGrid}>
                {bg.logoDirection    && <div style={gm.coreItem}><div style={gm.coreLabel}>로고 방향</div><div style={gm.coreValue}>{bg.logoDirection}</div></div>}
                {bg.fontDirection    && <div style={gm.coreItem}><div style={gm.coreLabel}>폰트 방향</div><div style={gm.coreValue}>{bg.fontDirection}</div></div>}
                {bg.signageDirection && <div style={{...gm.coreItem,gridColumn:'1/-1'}}><div style={gm.coreLabel}>간판 방향</div><div style={gm.coreValue}>{bg.signageDirection}</div></div>}
              </div>
            </div>
          )}
          <div style={gm.section}>
            <div style={gm.sectionLabel}>04 · Interior Visualization</div>
            <div style={gm.sectionTitle}>리브랜딩 후 공간 이미지</div>
            {/* ★ 2026-08-27 (2차): 여기서 따로 만들지 않는다. 결과 화면의 "공간 연출"
                카드가 만든 것을 그대로 싣는다 — 같은 사진을 두 번 변환하지 않기 위해서다. */}
            {spaceImages.length > 0 ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
                {spaceImages.map((it,i) => <GuidelineImage key={i} label={it.label} url={it.url} />)}
              </div>
            ) : (
              <div style={gm.missing}>아직 공간 이미지가 없어요<br/>결과 화면의 &quot;공간 연출&quot; 카드에서 만들면 여기에 실립니다</div>
            )}
          </div>

          {(pkg.materialKeywords?.length > 0 || pkg.furnitureKeywords?.length > 0) && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>05 · Materials &amp; Furniture</div>
              <div style={gm.sectionTitle}>소재 &amp; 가구 방향</div>
              {pkg.materialKeywords?.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ ...gm.coreLabel, marginBottom:12 }}>소재</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
                    {pkg.materialKeywords.map((m,i) => <GuidelineImage key={i} label={m} url={img(`material-${i}`)} aspectRatio="4/3" />)}
                  </div>
                </div>
              )}
              {pkg.furnitureKeywords?.length > 0 && (
                <div>
                  <div style={{ ...gm.coreLabel, marginBottom:12 }}>가구</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
                    {pkg.furnitureKeywords.map((f,i) => <GuidelineImage key={i} label={f} url={img(`furniture-${i}`)} aspectRatio="4/3" />)}
                  </div>
                </div>
              )}
              {pkg.materialKeywords?.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <div style={gm.coreLabel}>소재 키워드</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8 }}>
                    {pkg.materialKeywords.map((m,i) => <span key={i} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:20, fontSize:12, color:'#333' }}>{m}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {pkg.mustHaveElements?.length > 0 && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>06 · Must-Have Elements</div>
              <div style={gm.sectionTitle}>반드시 있어야 할 요소</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:16 }}>
                {pkg.mustHaveElements.map((item,i) => <GuidelineImage key={i} label={item} url={img(`musthave-${i}`)} />)}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {pkg.mustHaveElements.map((m,i) => <span key={i} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:20, fontSize:12, color:'#333' }}>✦ {m}</span>)}
              </div>
            </div>
          )}

          {pkg.signatureSpot && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>07 · Signature Spot</div>
              <div style={gm.sectionTitle}>시그니처 공간</div>
              <GuidelineImage label="시그니처 공간" url={img('signature')} />
              <div style={{ border:'2px solid #111', borderRadius:8, padding:'20px 24px', marginTop:16 }}>
                <div style={{ fontSize:15, fontWeight:700, lineHeight:1.5, wordBreak:'keep-all' }}>{pkg.signatureSpot}</div>
              </div>
            </div>
          )}

          {pkg.narrative && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>08 · Brand Story Poster</div>
              <div style={gm.sectionTitle}>브랜드 스토리</div>
              <GuidelineImage label="브랜드 스토리 포스터" url={img('narrative')} />
              <div style={{ background:'#111', borderRadius:8, padding:24, marginTop:16 }}>
                <div style={{ fontSize:14, fontWeight:300, color:'#fff', lineHeight:1.8, wordBreak:'keep-all' }}>&quot;{pkg.narrative}&quot;</div>
              </div>
            </div>
          )}

          <div style={gm.footer}><span style={{ fontWeight:700 }}>✦ RebrandBoss</span><span style={{ color:'#888', fontSize:12 }}>Generated {today} · rebrandboss.kr</span></div>
        </div>
      </div>
    </div>, document.body
  );
}

// ── 인테리어 실행가이드 모달 ───────────────────────────────
//
// ★ 2026-08-27: 가이드라인 모달의 09·10 섹션과 결과 화면의 실행 체크리스트를
//   여기로 모았다. 사장님이 오픈까지 들고 다니는 작업 문서라, 브랜드 자료와
//   섞어두면 둘 다 읽기 나빠진다(BrandGuidelineModal 머리말 참고).
function InteriorGuideModal({ resultData, onClose }) {
  const rd = resultData?.rebrandDecision || {};
  const fd = resultData?.formData        || {};
  const checklist = rd.launchChecklist   || [];
  const today = new Date().toLocaleDateString('ko-KR');
  const dot = { width:5, height:5, borderRadius:'50%', background:'#7F77DD', flexShrink:0, marginTop:6 };
  const row = { display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'#111', lineHeight:1.65, marginBottom:6 };

  return createPortal(
    <div style={gm.overlay}>
      <div style={gm.modal}>
        <div style={gm.header}>
          <div><div style={gm.headerTitle}>🔧 인테리어 실행가이드</div><div style={gm.headerSub}>{rd.newBrandName} · {today}</div></div>
          <div style={{ display:'flex', gap:10 }}>
            <button style={gm.printBtn} onClick={() => window.print()} title="브라우저 인쇄 대화상자를 엽니다">🖨 인쇄</button>
            <button style={gm.closeBtn} onClick={onClose}>✕ 닫기</button>
          </div>
        </div>
        <div style={gm.body}>
          <div style={gm.igIntro}>
            오픈까지 남은 일과, 인테리어 업체를 만나기 전에 알아야 할 것들입니다.
            체크 상태는 이 화면을 닫기 전까지 유지됩니다.
          </div>
          <div style={gm.section}>
            <div style={gm.sectionLabel}>01 · Launch Checklist</div>
            <div style={gm.sectionTitle}>리브랜딩 실행 체크리스트</div>
            {checklist.length > 0
              ? <>
                  <LaunchChecklist checklist={checklist} bare />
                  <div style={{ marginTop:24 }}><RebrandChecklistDetail checklist={checklist} category={fd.category} /></div>
                </>
              : <div style={gm.missing}>실행 체크리스트가 아직 없어요 · 브랜드를 다시 생성하면 만들어집니다</div>}
          </div>
          <div style={gm.section}>
            <div style={gm.sectionLabel}>02 · Interior Execution Guide</div>
            <div style={gm.sectionTitle}>인테리어 실행 가이드</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:10 }}>👥 업체 미팅 전 준비할 것</div>
              {['도면 또는 평면도 준비','이 가이드라인 PDF + 공간 이미지 출력해서 지참','예산 상한선 미리 정해두기 (업체에는 10% 낮게)','희망 공사 기간 및 오픈 목표일 결정','포트폴리오 사진 속 실제 매장 방문 요청'].map((p,i)=><div key={i} style={row}><div style={dot}/><span>{p}</span></div>)}
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:10 }}>❓ 미팅 때 반드시 물어볼 것</div>
              {['하자 보증 기간은 어떻게 되나요? (최소 1년)','직영 공사인가요, 하청 주나요?','중도금/잔금 비율은 어떻게 되나요?','폐기물 처리 비용이 견적에 포함되어 있나요?'].map((q,i)=><div key={i} style={{ fontSize:12, color:'#111', background:'#F5F3FF', padding:'8px 12px', borderRadius:6, marginBottom:6 }}>&quot;{q}&quot;</div>)}
            </div>
            <div style={{ background:'#FAEEDA', borderRadius:8, padding:'12px 16px', fontSize:12, color:'#633806', lineHeight:1.7 }}>⚠ 공사 시작 후에도 최소 주 2회 현장 방문해서 자재와 시공 방향이 이 가이드라인과 맞는지 직접 확인하세요.</div>
          </div>
          <div style={gm.footer}><span style={{ fontWeight:700 }}>✦ RebrandBoss</span><span style={{ color:'#888', fontSize:12 }}>Generated {today} · rebrandboss.kr</span></div>
        </div>
      </div>
    </div>, document.body
  );
}

const gm = {
  overlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:99999, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 16px', overflowY:'auto' },
  modal:{ background:'#fff', borderRadius:16, width:'100%', maxWidth:860, display:'flex', flexDirection:'column', boxShadow:'0 40px 100px rgba(0,0,0,0.4)', marginBottom:40 },
  header:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 28px', borderBottom:'1px solid #e5e5e5', position:'sticky', top:0, background:'#fff', borderRadius:'16px 16px 0 0', zIndex:10 },
  headerTitle:{ fontSize:16, fontWeight:800, color:'#111' }, headerSub:{ fontSize:12, color:'#888', marginTop:2 },
  printBtn:{ padding:'8px 18px', borderRadius:8, border:'none', background:'#111', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' },
  closeBtn:{ padding:'8px 14px', borderRadius:8, border:'1px solid #ddd', background:'#fff', color:'#555', fontSize:13, cursor:'pointer' },
  body:{ padding:'40px 48px 60px', overflowY:'auto' },
  cover:{ marginBottom:48, paddingBottom:40, borderBottom:'2px solid #111' },
  coverBadge:{ fontSize:10, fontWeight:600, letterSpacing:'0.18em', color:'#888', marginBottom:20 },
  coverName:{ fontSize:48, fontWeight:700, letterSpacing:'-0.03em', lineHeight:1.1, marginBottom:10 },
  coverTagline:{ fontSize:15, fontWeight:300, color:'#555', marginBottom:24 },
  coverMeta:{ display:'flex', gap:28, fontSize:12, color:'#888', flexWrap:'wrap' },
  section:{ marginBottom:44, paddingBottom:44, borderBottom:'1px solid #e5e5e5' },
  sectionLabel:{ fontSize:9, fontWeight:700, letterSpacing:'0.2em', color:'#888', textTransform:'uppercase', marginBottom:14 },
  sectionTitle:{ fontSize:20, fontWeight:700, letterSpacing:'-0.02em', marginBottom:20 },
  coreGrid:{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 },
  coreItem:{ background:'#f8f8f8', borderRadius:8, padding:'16px 18px' },
  coreLabel:{ fontSize:10, fontWeight:600, letterSpacing:'0.1em', color:'#888', textTransform:'uppercase', marginBottom:8 },
  coreValue:{ fontSize:13, color:'#111', lineHeight:1.65, wordBreak:'keep-all' },
  footer:{ marginTop:40, paddingTop:20, borderTop:'1px solid #e5e5e5', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 },
  igIntro:{ background:'#F5F3FF', borderRadius:10, padding:'14px 18px', fontSize:13, color:'#4C1D95', lineHeight:1.7, wordBreak:'keep-all', marginBottom:28 },
  missing:{ padding:'20px 18px', border:'1.5px dashed #ddd', borderRadius:10, fontSize:13, color:'#888', textAlign:'center', lineHeight:1.7 },
};

// ★ 2026-08-27: bare — 인테리어 실행가이드 모달 안에서 쓸 때는 섹션 카드와 제목을
//   두 번 두르지 않는다(모달이 이미 제목을 갖고 있다). 결과 화면에서는 쓰지 않게 됐지만
//   컴포넌트는 그대로 둔다.
function LaunchChecklist({ checklist, bare = false }) {
  const [doneState, setDoneState] = useState(() => checklist.map(() => false));
  const doneCount = doneState.filter(Boolean).length;
  const pct = Math.round(doneCount/checklist.length*100);
  return (
    <section style={bare ? undefined : s.sectionCard}>
      {!bare && <>
        <div style={s.sectionBadge}>✅ LAUNCH CHECKLIST</div>
        <h3 style={s.sectionTitle}>리브랜딩 실행 체크리스트</h3>
      </>}
      <div style={{ background:'#F5F3FF', borderRadius:10, padding:'14px 18px', marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
          <span style={{ fontSize:12, color:'#6D28D9' }}>완료율</span>
          <span style={{ fontSize:22, fontWeight:900, color:'#3C3489' }}>{pct}%</span>
        </div>
        <div style={{ height:6, background:'#DDD6FE', borderRadius:999, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:999, background:'#7F77DD', width:`${pct}%`, transition:'width 0.4s ease' }}/>
        </div>
        <div style={{ fontSize:12, color:'#6D28D9', marginTop:8 }}><strong>{doneCount}</strong>/{checklist.length} 완료</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {checklist.map((item,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', border:'1px solid #e5e5e5', borderRadius:10, background:'#fff', opacity:doneState[i]?0.6:1, cursor:'pointer' }}
            onClick={() => setDoneState(p=>p.map((d,idx)=>idx===i?!d:d))}>
            <div style={{ width:22, height:22, borderRadius:'50%', border:doneState[i]?'none':'1.5px solid #ddd', background:doneState[i]?'#7F77DD':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {doneState[i]&&<span style={{ color:'#fff', fontSize:13 }}>✓</span>}
            </div>
            <span style={{ fontSize:14, fontWeight:600, color:doneState[i]?'#aaa':'#111', textDecoration:doneState[i]?'line-through':'none', wordBreak:'keep-all' }}>{item}</span>
          </div>
        ))}
      </div>
      {pct===100&&<div style={{ marginTop:16, padding:16, background:'#e8f5e9', borderRadius:10, textAlign:'center' }}><div style={{ fontSize:22, marginBottom:6 }}>🎉</div><div style={{ fontSize:15, fontWeight:700, color:'#2e7d32' }}>리브랜딩 준비 완료!</div></div>}
    </section>
  );
}

// ★ 2026-08-27: 캡처 대상이 "결과 화면"에서 "가이드라인 모달 본문"으로 바뀌었다.
//   버튼을 하나로 합치면서(가이드 PDF 다운로드) 받는 문서도 가이드라인 자체가 된다.
//   ref만 받으므로 대상이 무엇이든 상관없다.
async function downloadRebrandPDF(targetRef, brandName) {
  const el = targetRef.current; if (!el) return;
  try {
    const canvas = await html2canvas(el, { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pdfW=pdf.internal.pageSize.getWidth(), pdfH=pdf.internal.pageSize.getHeight();
    const imgH=(canvas.height*pdfW)/canvas.width;
    let yOffset=0, remaining=imgH;
    while (remaining>0) { if (yOffset>0) pdf.addPage(); pdf.addImage(imgData,'PNG',0,-yOffset,pdfW,imgH); yOffset+=pdfH; remaining-=pdfH; }
    pdf.save(`${(brandName||'리브랜딩').replace(/\s/g,'_')}_리브랜드보스.pdf`);
  } catch(e) { throw e; }
}

export default function ResultScreen({
  resultData, error, warning, loading,
  onRegenerate, onBackToForm, onRestart,
  useCredit, checkLimit, onCreditInsufficient,
  storePhotos = [],
  menuPhotos  = [],
  onSaveImages,
}) {
  const rd  = resultData?.rebrandDecision      || {};
  const pa  = resultData?.photoAnalysis        || {};
  const pkg = resultData?.interiorImagePackage || {};
  const fd  = resultData?.formData             || {};
  const resultRef = useRef(null);
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [showGuideline, setShowGuideline] = useState(false);
  const [showInteriorGuide, setShowInteriorGuide] = useState(false);
  const [displayName,   setDisplayName]   = useState('');
  const [displayTagline,setDisplayTagline]= useState('');
  // ★ 2026-08-27: 가이드라인 자산 이미지. 모달이 아니라 여기가 들고 있어야
  //   모달을 닫아도 남고, PDF에도 실린다(buildGuidelineAssets 머리말 참고).
  const [assetImages,   setAssetImages]   = useState({});
  // "공간 연출" 카드가 만든 이미지. 가이드라인 모달의 04 섹션이 이걸 읽는다.
  const [spaceUrls,     setSpaceUrls]     = useState([]);

  const typedName    = useTypingEffect(rd.newBrandName||'', 75);
  const typedTagline = useTypingEffect(rd.tagline||'', 40);
  useEffect(() => { setDisplayName(''); setDisplayTagline(''); setAssetImages({}); setSpaceUrls([]); }, [rd.newBrandName]);

  if (loading) return <RebrandLoadingScreen />;
  if (error && !resultData) return (
    <div style={{ textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontSize:22, fontWeight:900, color:'#111827', marginBottom:12 }}>오류가 발생했어요</div>
      <p style={{ fontSize:14, color:'#64748b', marginBottom:24 }}>{error}</p>
      <button style={s.btnSecondary} onClick={onBackToForm}>← 입력으로 돌아가기</button>
    </div>
  );
  if (!resultData) return null;

  // ★ 2026-08-27 (2차): 방향 카드의 저장 훅을 한 번 거쳐 간다.
  //   프로젝트 저장(App.handleSaveImages)은 그대로 하되, 공간 카드 결과만
  //   여기에도 담아 가이드라인 모달·PDF가 읽을 수 있게 한다.
  const handleSectionImages = (sectionKey, urls) => {
    if (sectionKey === 'space') setSpaceUrls(Array.isArray(urls) ? urls : (urls ? [urls] : []));
    if (onSaveImages) onSaveImages(sectionKey, urls);
  };

  // 몇 번째 사진을 바꾼 것인지 알 수 있게 라벨을 붙인다.
  // 사진 없이 만든 경우(txt2img 3컷)는 붙일 원본이 없으므로 순번만 쓴다.
  const spaceImages = spaceUrls.filter(Boolean).map((url, i) => {
    const photo = storePhotos[i];
    const label = photo
      ? `${detectPhotoType(photo) === 'exterior' ? '외관' : '내부'} ${i + 1}`
      : `공간 ${i + 1}`;
    return { url, label };
  });

  const handlePdfDownload = async (targetRef) => {
    setPdfLoading(true);
    try { await downloadRebrandPDF(targetRef || resultRef, rd.newBrandName); }
    catch(e) { alert(`PDF 생성 실패: ${e.message}`); }
    finally { setPdfLoading(false); }
  };

  const sections = [
    { key:'space',   title:'공간 연출',     label:'SPACE DIRECTION',   text:pkg.improvementDirection||'' },
    { key:'menu',    title:'메뉴 플레이팅', label:'MENU DIRECTION',    text:rd.menuDirection||'' },
    { key:'prop',    title:'소품 디테일',   label:'PROP DIRECTION',    text:pkg.stylingNotes||'' },
    { key:'service', title:'유니폼 외',     label:'SERVICE DIRECTION', text:rd.serviceDirection||'' },
  ];

  const exteriorCount = storePhotos.filter(p => detectPhotoType(p) === 'exterior').length;
  const interiorCount = storePhotos.filter(p => detectPhotoType(p) === 'interior').length;

  return (
    <div ref={resultRef} style={s.wrap}>
      {showGuideline && (
        <BrandGuidelineModal
          resultData={resultData} assetImages={assetImages} spaceImages={spaceImages}
          onClose={() => setShowGuideline(false)}
          onDownloadPdf={handlePdfDownload} pdfLoading={pdfLoading}
        />
      )}
      {showInteriorGuide && (
        <InteriorGuideModal resultData={resultData} onClose={() => setShowInteriorGuide(false)} />
      )}

      <section style={{...s.sectionCard, animation:'fadeInUp 0.5s ease both'}}>
        <div style={s.sectionBadge}>🔍 DIAGNOSIS</div>
        <h2 style={s.diagnosisText}>{rd.diagnosis||''}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 }}>
          {rd.keepStrengths?.length > 0 && (
            <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#166534', letterSpacing:'0.06em', marginBottom:8 }}>지킬 강점</div>
              {rd.keepStrengths.map((item,i)=><div key={i} style={{ fontSize:13, color:'#111', lineHeight:1.7 }}>✓ {item}</div>)}
            </div>
          )}
          {rd.changePoints?.length > 0 && (
            <div style={{ background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#9F1239', letterSpacing:'0.06em', marginBottom:8 }}>바꿀 것</div>
              {rd.changePoints.map((item,i)=><div key={i} style={{ fontSize:13, color:'#111', lineHeight:1.7 }}>→ {item}</div>)}
            </div>
          )}
        </div>
      </section>

      <PhotoAnalysisSection photoAnalysis={pa} />

      <section style={{...s.nameBox, animation:'fadeInUp 0.5s ease both', animationDelay:'0.15s'}}>
        <div style={s.nameLabel}>NEW BRAND NAME</div>
        <h1 style={s.brandName}>
          {displayName||typedName||''}
          <span style={{ opacity:typedName.length<(rd.newBrandName||'').length&&!displayName?1:0, borderRight:'3px solid currentColor', marginLeft:2, animation:'blink 0.8s step-end infinite' }}/>
        </h1>
        <p style={s.tagline}>{displayTagline||typedTagline||''}</p>
        {rd.newConcept && <div style={{ marginTop:12, padding:'10px 16px', background:'rgba(255,255,255,0.6)', borderRadius:8, fontSize:14, color:'#6D28D9', fontWeight:600 }}>{rd.newConcept}</div>}
        <BrandNamePanel resultData={resultData} onApply={nameObj=>{setDisplayName(nameObj.name);setDisplayTagline(nameObj.tagline);}}/>
      </section>

      <section style={s.infoGrid}>
        {[{label:'핵심 고객',value:rd.targetCustomers},{label:'새로운 방문 이유',value:rd.newVisitReason},{label:'메뉴 방향',value:rd.menuDirection},{label:'서비스 방향',value:rd.serviceDirection}].filter(item=>item.value).map(({label,value})=>(
          <div key={label} style={s.infoCard}><div style={s.infoLabel}>{label}</div><p style={s.infoValue}>{value}</p></div>
        ))}
      </section>

      {/* ★ BudgetScenariosSection 제거됨 (예산/범위 스텝 폐지에 따라) */}

      <section style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <h3 style={{ margin:'8px 0 4px', fontSize:'clamp(20px,3vw,26px)', fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
          리브랜딩의 <span style={{ color:'#7c3aed' }}>네 가지 방향.</span>
        </h3>
        {(storePhotos.length > 0 || menuPhotos.length > 0) && (
          <div style={{ padding:'10px 14px', background:'#EEE8FF', borderRadius:10, fontSize:13, color:'#6D28D9', fontWeight:600 }}>
            📸 {storePhotos.length > 0 && `매장 사진 ${storePhotos.length}장 (외관 ${exteriorCount}장 · 내부 ${interiorCount}장)`}
            {menuPhotos.length > 0 && ` · 메뉴 사진 ${menuPhotos.length}장`}
          </div>
        )}
        <DirectionCard
          title="공간 연출" label="SPACE DIRECTION"
          text={sections[0].text} sectionKey="space" resultData={resultData} fullWidth
          useCredit={useCredit} checkLimit={checkLimit} onCreditInsufficient={onCreditInsufficient}
          inputPhotos={storePhotos}
          onSaveImages={handleSectionImages}
        />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
          <DirectionCard title="메뉴 플레이팅" label="MENU DIRECTION" text={sections[1].text} sectionKey="menu" resultData={resultData} useCredit={useCredit} checkLimit={checkLimit} onCreditInsufficient={onCreditInsufficient} inputPhotos={menuPhotos} onSaveImages={handleSectionImages}/>
          <DirectionCard title="소품 디테일"   label="PROP DIRECTION"    text={sections[2].text} sectionKey="prop"    resultData={resultData} useCredit={useCredit} checkLimit={checkLimit} onCreditInsufficient={onCreditInsufficient} inputPhotos={[]} onSaveImages={handleSectionImages}/>
          <DirectionCard title="유니폼 외"     label="SERVICE DIRECTION" text={sections[3].text} sectionKey="service" resultData={resultData} useCredit={useCredit} checkLimit={checkLimit} onCreditInsufficient={onCreditInsufficient} inputPhotos={[]} onSaveImages={handleSectionImages}/>
        </div>
      </section>

      {(pkg.materialKeywords?.length>0||pkg.mustHaveElements?.length>0) && (
        <section style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
            {pkg.materialKeywords?.length>0&&<div style={s.specCard}><div style={s.specLabel}>소재 키워드</div>{pkg.materialKeywords.map((k,i)=><div key={i} style={s.specTag}>· {k}</div>)}</div>}
            {pkg.furnitureKeywords?.length>0&&<div style={s.specCard}><div style={s.specLabel}>가구 키워드</div>{pkg.furnitureKeywords.map((k,i)=><div key={i} style={s.specTag}>· {k}</div>)}</div>}
            {pkg.mustHaveElements?.length>0&&<div style={s.specCard}><div style={s.specLabel}>반드시 있어야 할 것</div>{pkg.mustHaveElements.map((k,i)=><div key={i} style={s.specTag}>· {k}</div>)}</div>}
          </div>
          {pkg.signatureSpot&&<div style={{ background:'var(--purple-50)', border:'1px solid var(--border-soft)', borderRadius:'var(--radius-md)', padding:'16px 18px' }}><div style={s.specLabel}>SIGNATURE SPOT</div><p style={{ margin:0, fontSize:15, fontWeight:800, color:'#111827', wordBreak:'keep-all' }}>{pkg.signatureSpot}</p></div>}
        </section>
      )}

      {/* ★ 2026-08-27: 이 자리에 있던 실행 체크리스트는 인테리어 실행가이드 모달로 옮겼고,
          대신 가이드라인 모달 안에 있던 이미지 생성기를 여기로 가져왔다.
          결과 화면은 "브랜드가 어떻게 되는가"를 만들고 보여주는 자리이고,
          체크리스트는 오픈까지 며칠씩 들고 다니는 작업 문서라 성격이 다르다. */}
      <BrandAssetsSection
        resultData={resultData}
        assetImages={assetImages}
        onAssetGenerated={(id, url) => setAssetImages(prev => ({ ...prev, [id]: url }))}
        useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
      />

      {warning&&<div style={{ padding:'12px 16px', background:'#fefce8', border:'1px solid #fde047', borderRadius:14, fontSize:13, color:'#854d0e' }}>⚠ {warning}</div>}

      <div style={s.actions}>
        <button style={s.btnPrimary} onClick={onRegenerate}>↺ 다른 방향으로 재제안</button>
        <button style={s.btnSecondary} onClick={onBackToForm}>← 입력 수정하기</button>
        {/* ★ 2026-08-27: "리브랜딩 가이드라인"과 "PDF 다운로드"를 한 버튼으로 합쳤다.
            둘은 사실 같은 문서였다 — 하나는 화면으로 보고 하나는 파일로 받는 것뿐인데
            버튼이 둘이라 "무엇이 다른가"를 사용자가 매번 판단해야 했다.
            이제 열어서 확인하고 그 자리에서 받는다(모달 헤더의 다운로드 버튼). */}
        <button style={{...s.btnSecondary, borderColor:'#6D28D9', color:'#6D28D9'}} onClick={()=>setShowGuideline(true)}>
          📄 가이드 PDF 다운로드
        </button>
        {/* ★ 2026-08-27: 체크리스트 + 인테리어 실행 가이드는 별도 문서로 뺐다. */}
        <button style={{...s.btnSecondary, borderColor:'#059669', color:'#059669'}} onClick={()=>setShowInteriorGuide(true)}>
          🔧 인테리어 실행가이드
        </button>
        <button style={s.btnGhost} onClick={onRestart}>처음부터 다시</button>
      </div>
    </div>
  );
}

const s = {
  wrap:{ width:'100%', maxWidth:1060, margin:'0 auto', display:'flex', flexDirection:'column', gap:16, paddingTop:32, animation:'fadeIn 0.3s ease' },
  sectionCard:{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-xl)', padding:'28px 28px 24px', boxShadow:'var(--shadow-sm)' },
  sectionBadge:{ display:'inline-block', padding:'5px 14px', borderRadius:'var(--radius-full)', background:'var(--purple-50)', color:'var(--purple-600)', fontSize:12, fontWeight:700, letterSpacing:'0.04em', marginBottom:12 },
  sectionTitle:{ margin:'0 0 16px', fontSize:'clamp(18px,2.5vw,22px)', fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' },
  diagnosisText:{ margin:0, fontSize:'clamp(16px,2vw,20px)', fontWeight:700, color:'var(--text-primary)', lineHeight:1.5, wordBreak:'keep-all' },
  nameBox:{ background:'var(--purple-50)', border:'1px solid var(--border-soft)', borderRadius:'var(--radius-xl)', padding:'36px 32px', textAlign:'center' },
  nameLabel:{ fontSize:11, fontWeight:700, color:'var(--purple-600)', letterSpacing:'0.1em', marginBottom:12, textTransform:'uppercase' },
  brandName:{ margin:'0 0 10px', fontSize:'clamp(36px,6vw,68px)', fontWeight:900, color:'#6D28D9', letterSpacing:'-0.04em' },
  tagline:{ margin:0, fontSize:16, color:'var(--text-secondary)', lineHeight:1.6 },
  infoGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 },
  infoCard:{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'20px 18px', boxShadow:'var(--shadow-sm)' },
  infoLabel:{ fontSize:11, fontWeight:700, color:'var(--purple-600)', letterSpacing:'0.06em', marginBottom:8, textTransform:'uppercase' },
  infoValue:{ margin:0, fontSize:14, color:'var(--text-primary)', lineHeight:1.65, wordBreak:'keep-all' },
  analysisBox:{ background:'#F8F8FC', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' },
  analysisLabel:{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', letterSpacing:'0.06em', marginBottom:8, textTransform:'uppercase' },
  analysisText:{ margin:0, fontSize:13, color:'#111', lineHeight:1.7, wordBreak:'keep-all' },
  specCard:{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', padding:'14px 14px' },
  specLabel:{ fontSize:11, fontWeight:700, color:'var(--purple-600)', letterSpacing:'0.06em', marginBottom:8, textTransform:'uppercase' },
  specTag:{ fontSize:13, color:'var(--text-primary)', lineHeight:1.8, fontWeight:600 },
  actions:{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', paddingTop:8 },
  btnPrimary:{ padding:'14px 32px', borderRadius:'var(--radius-full)', border:'none', background:'#6D28D9', color:'#FFFFFF', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(109,40,217,0.35)' },
  btnSecondary:{ padding:'14px 24px', borderRadius:'var(--radius-full)', border:'1.5px solid #D4D4D8', background:'#FFFFFF', color:'#3F3F46', fontSize:14, fontWeight:600, cursor:'pointer' },
  btnGhost:{ padding:'14px 20px', borderRadius:'var(--radius-full)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-tertiary)', fontSize:13, fontWeight:600, cursor:'pointer' },
};
