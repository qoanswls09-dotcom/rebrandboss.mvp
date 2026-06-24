// src/components/HeroSection.jsx
import React, { useState, useEffect } from 'react';

const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap';
link.rel = 'stylesheet';
document.head.appendChild(link);

export default function HeroSection({ onStart }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div style={h.wrap}>
      <div style={{
        ...h.bg,
        backgroundPosition: isMobile ? '70% center' : 'center right',
      }} />
      <div style={{
        ...h.overlay,
        background: isMobile
          ? 'linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.40) 100%)'
          : 'linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0) 100%)',
      }} />
      <div style={{
        ...h.content,
        paddingLeft: isMobile ? 28 : 'clamp(32px, 8vw, 120px)',
        paddingRight: isMobile ? 28 : 0,
        maxWidth: isMobile ? '100%' : 600,
      }}>
        <div style={h.eyebrow}>AI 매장 리브랜딩 서비스</div>
        <h1 style={{
          ...h.title,
          fontSize: isMobile ? 'clamp(33px, 8vw, 46px)' : 'clamp(46px, 6vw, 76px)',
        }}>
          내 매장을<br />
          새롭게 바꿔드립니다.
        </h1>
        <p style={{
          ...h.sub,
          fontSize: isMobile ? 15 : 'clamp(15px, 1.5vw, 19px)',
        }}>
          매장 사진과 예산만 입력하면<br />
          리브랜딩 전략부터 인테리어 이미지까지 — 5분
        </p>
        <button
          style={h.cta}
          onClick={onStart}
          onMouseEnter={e => { e.target.style.background = '#fff'; e.target.style.color = '#111'; }}
          onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#fff'; }}
        >
          무료로 시작하기
        </button>
      </div>
    </div>
  );
}

const h = {
  wrap:    { position: 'relative', width: '100%', height: '100vh', minHeight: 600, overflow: 'hidden', display: 'flex', alignItems: 'center' },
  bg:      { position: 'absolute', inset: 0, backgroundImage: 'url(/hero-bg.jpg)', backgroundSize: 'cover', backgroundRepeat: 'no-repeat' },
  overlay: { position: 'absolute', inset: 0 },
  content: { position: 'relative', zIndex: 2 },
  eyebrow: { display: 'inline-block', padding: '6px 14px', border: '1px solid rgba(255,255,255,0.6)', borderRadius: 20, color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: 500, letterSpacing: '0.08em', marginBottom: 24, backdropFilter: 'blur(4px)', background: 'rgba(255,255,255,0.12)' },
  title:   { margin: '0 0 18px', fontFamily: "'DM Serif Display', serif", fontWeight: 400, color: '#ffffff', lineHeight: 1.15, letterSpacing: '-0.01em', wordBreak: 'keep-all', textShadow: '0 2px 16px rgba(0,0,0,0.4)' },
  sub:     { margin: '0 0 36px', color: 'rgba(255,255,255,0.92)', lineHeight: 1.8, fontWeight: 400, wordBreak: 'keep-all', textShadow: '0 1px 8px rgba(0,0,0,0.5)' },
  cta:     { display: 'inline-block', padding: '14px 32px', border: '1.5px solid rgba(255,255,255,0.75)', borderRadius: 2, background: 'transparent', color: '#ffffff', fontSize: 13, fontWeight: 400, letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.25s ease', textTransform: 'uppercase' },
};
