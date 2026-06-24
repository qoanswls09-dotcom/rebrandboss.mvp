// src/components/SharePage.jsx
// 공유 링크 페이지 — 로그인 없이 접근 가능
import React, { useState, useEffect } from 'react';

export default function SharePage({ shareId, onStart }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!shareId) return;
    const fetchShared = async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/.netlify/functions/bb-projects?action=shared&shareId=${shareId}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || '공유 페이지를 찾을 수 없습니다.');
        setProject(data.project);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, [shareId]);

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
      <p style={s.loadTxt}>불러오는 중...</p>
    </div>
  );

  if (error) return (
    <div style={s.center}>
      <p style={s.errorTxt}>😕 {error}</p>
      <button style={s.ctaBtn} onClick={onStart}>내 브랜드 만들기</button>
    </div>
  );

  if (!project) return null;

  const bd     = project.brandDecision        || {};
  const images = project.images               || {};
  const thumbs = [
    ...(images.space   || []),
    ...(images.menu    || []),
    ...(images.prop    || []),
    ...(images.service || []),
  ].slice(0, 4);

  return (
    <div style={s.wrap}>

      {/* 헤더 */}
      <div style={s.header}>
        <div style={s.logo}>
          <div style={s.logoIcon}>✦</div>
          <span style={s.logoText}>브랜드보스</span>
        </div>
      </div>

      {/* 브랜드 히어로 */}
      <section style={s.hero}>
        <div style={s.badge}>BRAND DECISION</div>
        <h1 style={s.brandName}>{bd.brandName || ''}</h1>
        <p style={s.tagline}>{bd.tagline || ''}</p>
        <p style={s.concept}>{bd.storeConcept || ''}</p>
      </section>

      {/* 이미지 그리드 */}
      {thumbs.length > 0 && (
        <section style={s.imgGrid}>
          {thumbs.map((url, i) => (
            <div key={i} style={s.imgWrap}>
              <img src={url} alt={`브랜드 이미지 ${i+1}`}
                style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
          ))}
        </section>
      )}

      {/* 브랜드 정보 */}
      <section style={s.infoSection}>
        {[
          { label:'매장 콘셉트', value: bd.storeConcept },
          { label:'핵심 고객',   value: bd.coreCustomers },
          { label:'어필 포인트', value: bd.appealReason },
          { label:'핵심 메시지', value: bd.keyMessage },
        ].filter(i => i.value).map(({ label, value }) => (
          <div key={label} style={s.infoCard}>
            <div style={s.infoLabel}>{label}</div>
            <p style={s.infoValue}>{value}</p>
          </div>
        ))}
      </section>

      {/* 방향 요약 */}
      <section style={s.dirSection}>
        {[
          { label:'메뉴 플레이팅', value: bd.menuDirection },
          { label:'공간 연출',     value: bd.spaceDirection },
          { label:'소품 디테일',   value: bd.propDirection },
          { label:'유니폼 외',     value: bd.serviceDirection },
        ].filter(i => i.value).map(({ label, value }) => (
          <div key={label} style={s.dirCard}>
            <div style={s.dirLabel}>{label}</div>
            <p style={s.dirValue}>{value}</p>
          </div>
        ))}
      </section>

      {/* 프린트/PDF 버튼 */}
      <div style={{ textAlign:'center', marginBottom:16 }}>
        <button
          style={{ padding:'10px 24px', borderRadius:999, border:'1.5px solid #6D28D9', background:'transparent', color:'#6D28D9', fontSize:14, fontWeight:700, cursor:'pointer' }}
          onClick={() => window.print()}
        >
          🖨 PDF로 저장하기
        </button>
      </div>

      {/* CTA */}
      <section style={s.ctaSection}>
        <div style={s.ctaBox}>
          <div style={s.ctaBadge}>AI 브랜드 결정 서비스</div>
          <h2 style={s.ctaTitle}>나도 내 브랜드 만들기</h2>
          <p style={s.ctaDesc}>업종, 고객, 상권을 입력하면<br />브랜드명부터 공간 이미지까지 한 번에</p>
          <button style={s.ctaBtn} onClick={onStart}>
            ✦ 무료로 시작하기
          </button>
        </div>
      </section>

    </div>
  );
}

const s = {
  wrap:        { minHeight:'100vh', background:'var(--bg, #F8F8FC)' },
  center:      { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:16 },
  spinner:     { width:36, height:36, border:'3px solid #E4E4E7', borderTopColor:'#6D28D9', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  loadTxt:     { fontSize:14, color:'#71717A' },
  errorTxt:    { fontSize:16, color:'#71717A', textAlign:'center' },

  header:      { maxWidth:1060, margin:'0 auto', padding:'20px 24px', display:'flex', alignItems:'center' },
  logo:        { display:'flex', alignItems:'center', gap:8 },
  logoIcon:    { width:32, height:32, borderRadius:8, background:'#6D28D9', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900 },
  logoText:    { fontSize:17, fontWeight:800, color:'#09090B', letterSpacing:'-0.03em' },

  hero:        { maxWidth:1060, margin:'0 auto', padding:'40px 24px 32px', textAlign:'center' },
  badge:       { display:'inline-block', padding:'5px 14px', borderRadius:999, background:'#EEE8FF', color:'#6D28D9', fontSize:12, fontWeight:700, letterSpacing:'0.04em', marginBottom:16 },
  brandName:   { margin:'0 0 10px', fontSize:'clamp(36px,6vw,72px)', fontWeight:900, color:'#09090B', letterSpacing:'-0.04em', lineHeight:1.1 },
  tagline:     { margin:'0 0 8px', fontSize:18, color:'#6D28D9', fontWeight:600, lineHeight:1.5 },
  concept:     { margin:0, fontSize:15, color:'#71717A', lineHeight:1.7, maxWidth:600, marginLeft:'auto', marginRight:'auto', wordBreak:'keep-all' },

  imgGrid:     { maxWidth:1060, margin:'0 auto 32px', padding:'0 24px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10 },
  imgWrap:     { aspectRatio:'4/3', borderRadius:14, overflow:'hidden', background:'#EEE8FF' },

  infoSection: { maxWidth:1060, margin:'0 auto 24px', padding:'0 24px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 },
  infoCard:    { background:'#FFFFFF', border:'1px solid #E4E4E7', borderRadius:14, padding:'18px 16px' },
  infoLabel:   { fontSize:11, fontWeight:700, color:'#6D28D9', letterSpacing:'0.06em', marginBottom:6, textTransform:'uppercase' },
  infoValue:   { margin:0, fontSize:14, color:'#09090B', lineHeight:1.65, wordBreak:'keep-all' },

  dirSection:  { maxWidth:1060, margin:'0 auto 48px', padding:'0 24px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 },
  dirCard:     { background:'#FFFFFF', border:'1px solid #E4E4E7', borderRadius:14, padding:'18px 16px' },
  dirLabel:    { fontSize:11, fontWeight:700, color:'#71717A', letterSpacing:'0.06em', marginBottom:6, textTransform:'uppercase' },
  dirValue:    { margin:0, fontSize:13, color:'#3F3F46', lineHeight:1.65, wordBreak:'keep-all' },

  ctaSection:  { padding:'0 24px 80px' },
  ctaBox:      { maxWidth:560, margin:'0 auto', background:'#6D28D9', borderRadius:28, padding:'48px 40px', textAlign:'center' },
  ctaBadge:    { display:'inline-block', padding:'4px 14px', borderRadius:999, background:'rgba(255,255,255,0.2)', color:'#fff', fontSize:12, fontWeight:700, letterSpacing:'0.06em', marginBottom:16 },
  ctaTitle:    { margin:'0 0 12px', fontSize:'clamp(24px,4vw,36px)', fontWeight:900, color:'#fff', letterSpacing:'-0.03em' },
  ctaDesc:     { margin:'0 0 28px', fontSize:15, color:'rgba(255,255,255,0.8)', lineHeight:1.7 },
  ctaBtn:      { padding:'16px 40px', borderRadius:999, border:'none', background:'#fff', color:'#6D28D9', fontSize:16, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 20px rgba(0,0,0,0.15)' },
};
