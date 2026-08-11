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

// ── 방향 카드 ─────────────────────────────────────────────
function DirectionCard({ title, label, text, sectionKey, resultData, fullWidth, useCredit, checkLimit, onCreditInsufficient, inputPhotos = [], onSaveImages }) {
  const [imgState, setImgState] = useState('idle');
  const [imgUrls,  setImgUrls]  = useState([]);
  const [errMsg,   setErrMsg]   = useState('');
  const [viewIdx,  setViewIdx]  = useState(null);
  const [toast,    setToast]    = useState(false);
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
    if (sectionKey==='prop')    return `Close-up interior props. ${base} 3-5 thematic pieces. Bokeh background.`;
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
            body: JSON.stringify({ directPrompt: buildPrompt(i) })
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

function BrandGuidelineModal({ resultData, onClose, useCredit, onCreditInsufficient, storePhotos, menuPhotos }) {
  const rd  = resultData?.rebrandDecision      || {};
  const pkg = resultData?.interiorImagePackage || {};
  const fd  = resultData?.formData             || {};
  const bg  = rd.brandGuideline               || {};
  const today = new Date().toLocaleDateString('ko-KR');
  const rebrandCtx = {
    newBrandName:rd.newBrandName||'', newConcept:rd.newConcept||'',
    overallMood:rd.overallMood||pkg.moodTone||'', materials:pkg.materialKeywords||[],
    colors:pkg.colorKeywords||[], signatureSpot:pkg.signatureSpot||'',
    changeScope:fd.changeScope||'', budget:fd.budget||'', budgetMemo:fd.budgetMemo||fd.budgetNote||'',
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
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14 }}>
              {['메인 홀','시그니처 공간','외관'].map((label,i) => {
                const prompts=[`Transform interior. Keep layout, apply new brand "${rd.newBrandName}". Concept: ${rd.newConcept}. Mood: ${rd.overallMood||pkg.moodTone}. No people. No text.`,`Signature zone: ${pkg.signatureSpot||'distinctive area'}. Brand: ${rd.newBrandName}. No people. No text.`,`Exterior facade: new signage "${rd.newBrandName}". ${rd.overallMood||pkg.moodTone}. No people. No text.`];
                const photo = i<2?(storePhotos?.[i]?.base64||null):null;
                const pType = i===2?'exterior':(i<storePhotos?.length?detectPhotoType(storePhotos[i]):'interior');
                return <SingleImgBlock key={i} label={label} promptText={prompts[i]} inputImage={photo} rebrandContext={rebrandCtx} imageType={pType} useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}/>;
              })}
            </div>
          </div>

          {/* ★ NEW: 소재 & 가구 */}
          {(pkg.materialKeywords?.length > 0 || pkg.furnitureKeywords?.length > 0) && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>05 · Materials & Furniture</div>
              <div style={gm.sectionTitle}>소재 & 가구 방향</div>
              {pkg.materialKeywords?.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ ...gm.coreLabel, marginBottom:12 }}>소재</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
                    {pkg.materialKeywords.map((m,i) => (
                      <SingleImgBlock key={i} label={m}
                        promptText={`MACRO CLOSE-UP material texture photography. Subject: "${m}". Color palette: ${(pkg.colorKeywords||[]).slice(0,2).join(', ')}. Brand mood: ${rd.overallMood||pkg.moodTone}. 4K ultra-detailed texture. No people. No text.`}
                        useCredit={useCredit} onCreditInsufficient={onCreditInsufficient} aspectRatio="4/3"
                      />
                    ))}
                  </div>
                </div>
              )}
              {pkg.furnitureKeywords?.length > 0 && (
                <div>
                  <div style={{ ...gm.coreLabel, marginBottom:12 }}>가구</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
                    {pkg.furnitureKeywords.map((f,i) => {
                      const isSeating = /의자|소파|체어|좌석|벤치|stool|chair|bench|sofa/i.test(f);
                      return (
                        <SingleImgBlock key={i} label={f}
                          promptText={`Product photography of furniture: "${f}". ${isSeating ? 'Upholstery and cushion details visible' : 'Form and material clearly visible'}. Clean studio background. ${rd.newConcept||''} restaurant style. Studio lighting. No people. No text.`}
                          useCredit={useCredit} onCreditInsufficient={onCreditInsufficient} aspectRatio="4/3"
                        />
                      );
                    })}
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

          {/* ★ NEW: 반드시 있어야 할 요소 */}
          {pkg.mustHaveElements?.length > 0 && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>06 · Must-Have Elements</div>
              <div style={gm.sectionTitle}>반드시 있어야 할 요소</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:16 }}>
                {pkg.mustHaveElements.map((item,i) => {
                  const shots = ['wide establishing shot showing full context','medium shot at eye level','close-up detail shot highlighting texture and materials'];
                  return (
                    <SingleImgBlock key={i} label={item}
                      promptText={`Restaurant interior showcasing: "${item}". ${shots[i % shots.length]}. ${rd.newConcept||''}. ${rd.overallMood||pkg.moodTone||''}. No people. No text. Photorealistic.`}
                      useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
                    />
                  );
                })}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {pkg.mustHaveElements.map((m,i) => <span key={i} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:20, fontSize:12, color:'#333' }}>✦ {m}</span>)}
              </div>
            </div>
          )}

          {/* ★ NEW: 시그니처 공간 */}
          {pkg.signatureSpot && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>07 · Signature Spot</div>
              <div style={gm.sectionTitle}>시그니처 공간</div>
              <SingleImgBlock label="시그니처 공간"
                promptText={`Restaurant interior focusing on signature spot: "${pkg.signatureSpot}". Brand: ${rd.newBrandName}. ${rd.overallMood||pkg.moodTone}. Dramatic lighting. Wide-angle. No people. No text.`}
                useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
              />
              <div style={{ border:'2px solid #111', borderRadius:8, padding:'20px 24px', marginTop:16 }}>
                <div style={{ fontSize:15, fontWeight:700, lineHeight:1.5, wordBreak:'keep-all' }}>{pkg.signatureSpot}</div>
              </div>
            </div>
          )}

          {/* ★ NEW: 브랜드 스토리 포스터 */}
          {pkg.narrative && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>08 · Brand Story Poster</div>
              <div style={gm.sectionTitle}>브랜드 스토리</div>
              <SingleImgBlock label="브랜드 스토리 포스터"
                promptText={`Editorial brand poster photography for a restaurant called "${rd.newBrandName}". Tagline: "${rd.tagline||''}". Concept: ${rd.newConcept}. ${rd.overallMood||pkg.moodTone}. Cinematic wide shot. Moody atmospheric lighting. No readable text. No people. No logo. Photorealistic.`}
                useCredit={useCredit} onCreditInsufficient={onCreditInsufficient} aspectRatio="16/9"
              />
              <div style={{ background:'#111', borderRadius:8, padding:24, marginTop:16 }}>
                <div style={{ fontSize:14, fontWeight:300, color:'#fff', lineHeight:1.8, wordBreak:'keep-all' }}>"{pkg.narrative}"</div>
              </div>
            </div>
          )}

          <div style={gm.section}>
            <div style={gm.sectionLabel}>09 · Interior Execution Guide</div>
            <div style={gm.sectionTitle}>인테리어 실행 가이드</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:10 }}>👥 업체 미팅 전 준비할 것</div>
              {['도면 또는 평면도 준비','이 가이드라인 PDF + 공간 이미지 출력해서 지참','예산 상한선 미리 정해두기 (업체에는 10% 낮게)','희망 공사 기간 및 오픈 목표일 결정','포트폴리오 사진 속 실제 매장 방문 요청'].map((p,i)=><div key={i} style={row}><div style={dot}/><span>{p}</span></div>)}
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#111', marginBottom:10 }}>❓ 미팅 때 반드시 물어볼 것</div>
              {['하자 보증 기간은 어떻게 되나요? (최소 1년)','직영 공사인가요, 하청 주나요?','중도금/잔금 비율은 어떻게 되나요?','폐기물 처리 비용이 견적에 포함되어 있나요?'].map((q,i)=><div key={i} style={{ fontSize:12, color:'#111', background:'#F5F3FF', padding:'8px 12px', borderRadius:6, marginBottom:6 }}>"{q}"</div>)}
            </div>
            <div style={{ background:'#FAEEDA', borderRadius:8, padding:'12px 16px', fontSize:12, color:'#633806', lineHeight:1.7 }}>⚠ 공사 시작 후에도 최소 주 2회 현장 방문해서 자재와 시공 방향이 이 가이드라인과 맞는지 직접 확인하세요.</div>
          </div>
          {rd.launchChecklist?.length > 0 && (
            <div style={gm.section}>
              <div style={gm.sectionLabel}>10 · Launch Checklist</div>
              <div style={gm.sectionTitle}>리브랜딩 실행 체크리스트</div>
              <RebrandChecklistDetail checklist={rd.launchChecklist} category={fd.category} />
            </div>
          )}
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
};

function LaunchChecklist({ checklist }) {
  const [doneState, setDoneState] = useState(() => checklist.map(() => false));
  const doneCount = doneState.filter(Boolean).length;
  const pct = Math.round(doneCount/checklist.length*100);
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

async function downloadRebrandPDF(resultRef, brandName) {
  const el = resultRef.current; if (!el) return;
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
  const [displayName,   setDisplayName]   = useState('');
  const [displayTagline,setDisplayTagline]= useState('');

  const typedName    = useTypingEffect(rd.newBrandName||'', 75);
  const typedTagline = useTypingEffect(rd.tagline||'', 40);
  useEffect(() => { setDisplayName(''); setDisplayTagline(''); }, [rd.newBrandName]);

  if (loading) return <RebrandLoadingScreen />;
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
          resultData={resultData} onClose={() => setShowGuideline(false)}
          useCredit={useCredit} onCreditInsufficient={onCreditInsufficient}
          storePhotos={storePhotos} menuPhotos={menuPhotos}
        />
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
          onSaveImages={onSaveImages}
        />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
          <DirectionCard title="메뉴 플레이팅" label="MENU DIRECTION" text={sections[1].text} sectionKey="menu" resultData={resultData} useCredit={useCredit} checkLimit={checkLimit} onCreditInsufficient={onCreditInsufficient} inputPhotos={menuPhotos} onSaveImages={onSaveImages}/>
          <DirectionCard title="소품 디테일"   label="PROP DIRECTION"    text={sections[2].text} sectionKey="prop"    resultData={resultData} useCredit={useCredit} checkLimit={checkLimit} onCreditInsufficient={onCreditInsufficient} inputPhotos={[]} onSaveImages={onSaveImages}/>
          <DirectionCard title="유니폼 외"     label="SERVICE DIRECTION" text={sections[3].text} sectionKey="service" resultData={resultData} useCredit={useCredit} checkLimit={checkLimit} onCreditInsufficient={onCreditInsufficient} inputPhotos={[]} onSaveImages={onSaveImages}/>
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

      {rd.launchChecklist?.length>0 && <LaunchChecklist checklist={rd.launchChecklist}/>}

      {warning&&<div style={{ padding:'12px 16px', background:'#fefce8', border:'1px solid #fde047', borderRadius:14, fontSize:13, color:'#854d0e' }}>⚠ {warning}</div>}

      <div style={s.actions}>
        <button style={s.btnPrimary} onClick={onRegenerate}>↺ 다른 방향으로 재제안</button>
        <button style={s.btnSecondary} onClick={onBackToForm}>← 입력 수정하기</button>
        <button style={{...s.btnSecondary, borderColor:'#6D28D9', color:'#6D28D9', opacity:pdfLoading?0.6:1}} onClick={handlePdfDownload} disabled={pdfLoading}>
          {pdfLoading?'⏳ PDF 생성 중...':'📄 PDF 다운로드'}
        </button>
        <button style={{...s.btnSecondary, borderColor:'#059669', color:'#059669'}} onClick={()=>setShowGuideline(true)}>📋 리브랜딩 가이드라인</button>
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
