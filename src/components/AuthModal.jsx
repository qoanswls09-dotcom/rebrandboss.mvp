import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// 인앱 브라우저 감지
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /KAKAOTALK|KAKAO|Line|Instagram|FBAN|FBAV|Twitter|Snapchat|TikTok|Naver|DaumApp/i.test(ua);
}

// 외부 브라우저로 열기
function openInExternalBrowser() {
  const url = window.location.href;
  // 안드로이드 인텐트
  const intentUrl = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
  // iOS는 직접 이동
  try {
    window.location.href = intentUrl;
  } catch(e) {}
  // 폴백: 복사 안내
  setTimeout(() => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
  }, 500);
}

export default function AuthModal({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState('');
  const [inApp, setInApp]     = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  const handleKakao = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setMsg(error.message); setLoading(false); }
  };

  const handleGoogle = async () => {
    if (inApp) {
      setShowGuide(true);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) { setMsg(error.message); setLoading(false); }
  };

  const handleOpenBrowser = () => {
    const url = window.location.href;
    // URL 복사
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    // 안드로이드 인텐트로 크롬 열기 시도
    const chromeIntent = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    window.location.href = chromeIntent;
  };

  // 인앱 브라우저 안내 모달
  if (showGuide) {
    return (
      <div style={s.overlay} onClick={() => setShowGuide(false)}>
        <div style={s.modal} onClick={e => e.stopPropagation()}>
          <button style={s.closeBtn} onClick={() => setShowGuide(false)}>✕</button>
          <div style={{textAlign:'center', marginBottom:20}}>
            <div style={{fontSize:40, marginBottom:12}}>🌐</div>
            <h2 style={{...s.title, fontSize:18, marginBottom:8}}>외부 브라우저에서 열어주세요</h2>
            <p style={{fontSize:13, color:'#71717A', lineHeight:1.7, margin:0}}>
              구글 로그인은 카카오톡 등<br/>인앱 브라우저에서 지원되지 않아요.<br/>
              아래 버튼을 눌러 크롬으로 열어주세요.
            </p>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            <button style={{...s.googleBtn, background:'#4285F4', color:'#fff', border:'none', padding:'14px 0', fontSize:15, fontWeight:700, borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}
              onClick={handleOpenBrowser}>
              🌐 크롬으로 열기
            </button>
            <button style={{...s.googleBtn, padding:'12px 0', fontSize:13, cursor:'pointer', borderRadius:12}}
              onClick={() => {
                if (navigator.clipboard) navigator.clipboard.writeText(window.location.href);
                alert('주소가 복사됐어요!\n크롬 브라우저에 붙여넣어 접속해주세요.');
              }}>
              🔗 주소 복사하기
            </button>
          </div>
          <div style={{marginTop:16, padding:'12px 14px', background:'#F9F9FB', borderRadius:10, fontSize:12, color:'#888', lineHeight:1.7}}>
            💡 카카오톡 우측 상단 <strong>···</strong> 버튼 →<br/>
            <strong>"다른 브라우저로 열기"</strong> 를 눌러도 돼요.
          </div>
          <button style={{marginTop:12, width:'100%', padding:'11px', border:'1px solid #E4E4E7', borderRadius:10, background:'#fff', fontSize:13, color:'#888', cursor:'pointer', fontWeight:600}}
            onClick={() => setShowGuide(false)}>
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <button style={s.closeBtn} onClick={onClose}>✕</button>
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>✦</div>
          <div style={s.logoText}>브랜드보스</div>
        </div>
        <h2 style={s.title}>로그인 / 회원가입</h2>
        <p style={s.desc}>소셜 계정으로 3초만에 시작하세요</p>
        <div style={s.socialWrap}>
          <button style={s.kakaoBtn} onClick={handleKakao} disabled={loading}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919">
              <path d="M12 3C6.477 3 2 6.582 2 11c0 2.83 1.696 5.323 4.27 6.88-.188.703-.679 2.554-.778 2.95-.122.488.178.482.376.35.155-.103 2.464-1.673 3.463-2.355.537.076 1.09.115 1.669.115 5.523 0 10-3.582 10-8S17.523 3 12 3z"/>
            </svg>
            카카오로 시작하기
          </button>
          <button style={{...s.googleBtn, position:'relative'}} onClick={handleGoogle} disabled={loading}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 시작하기
            {inApp && <span style={{position:'absolute', top:-8, right:8, fontSize:9, fontWeight:700, background:'#6D28D9', color:'#fff', padding:'2px 6px', borderRadius:999}}>브라우저 필요</span>}
          </button>
        </div>
        {inApp && (
          <div style={{marginTop:12, padding:'10px 14px', background:'#F5F3FF', borderRadius:10, fontSize:12, color:'#6D28D9', lineHeight:1.7, textAlign:'center'}}>
            💡 구글 로그인은 외부 브라우저에서 이용 가능해요.<br/>
            카카오 로그인을 추천드려요!
          </div>
        )}
        {msg && <div style={s.errMsg}>{msg}</div>}
        {loading && <div style={s.loadingMsg}>로그인 중...</div>}
        <p style={s.note}>로그인 시 <span style={{color:'#6D28D9', cursor:'pointer'}}>서비스 이용약관</span> 및 <span style={{color:'#6D28D9', cursor:'pointer'}}>개인정보처리방침</span>에 동의하게 됩니다.</p>
      </div>
    </div>
  );
}

const s = {
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' },
  modal:      { background:'#fff', borderRadius:20, padding:'36px 28px 28px', width:'100%', maxWidth:380, position:'relative', boxShadow:'0 24px 80px rgba(0,0,0,0.2)' },
  closeBtn:   { position:'absolute', top:16, right:16, width:30, height:30, border:'none', background:'#F4F4F5', borderRadius:'50%', cursor:'pointer', fontSize:13, color:'#71717A' },
  logoWrap:   { display:'flex', alignItems:'center', gap:8, justifyContent:'center', marginBottom:20 },
  logoIcon:   { width:36, height:36, borderRadius:10, background:'#6D28D9', color:'#fff', fontSize:16, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' },
  logoText:   { fontSize:16, fontWeight:800, color:'#09090B', letterSpacing:'-0.03em' },
  title:      { textAlign:'center', fontSize:22, fontWeight:900, color:'#09090B', margin:'0 0 8px', letterSpacing:'-0.02em' },
  desc:       { textAlign:'center', fontSize:13, color:'#71717A', margin:'0 0 24px' },
  socialWrap: { display:'flex', flexDirection:'column', gap:12 },
  kakaoBtn:   { display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'14px 0', borderRadius:12, border:'none', background:'#FEE500', color:'#191919', fontSize:15, fontWeight:700, cursor:'pointer' },
  googleBtn:  { display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'14px 0', borderRadius:12, border:'1.5px solid #E4E4E7', background:'#fff', color:'#3F3F46', fontSize:15, fontWeight:600, cursor:'pointer' },
  errMsg:     { marginTop:12, padding:'10px 14px', borderRadius:8, fontSize:13, color:'#DC2626', background:'#FFF1F2', textAlign:'center' },
  loadingMsg: { marginTop:12, textAlign:'center', fontSize:13, color:'#6D28D9', fontWeight:600 },
  note:       { marginTop:20, fontSize:11, color:'#A1A1AA', textAlign:'center', lineHeight:1.6 },
};
