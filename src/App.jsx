import React, { useState, useEffect } from 'react';
import './App.css';
import StepForm from './components/StepForm';
import ResultScreen from './components/ResultScreen';
import AuthModal from './components/AuthModal';
import MyBrands from './components/MyBrands';
import SharePage from './components/SharePage';
import HeroSection from './components/HeroSection';
import AdminDashboard from './components/AdminDashboard';
import { supabase } from './lib/supabase';
import { useUsageLimit } from './hooks/useUsageLimit';
import UpgradeModal from './components/UpgradeModal';
import TermsPage from './components/TermsPage';

const ADMIN_EMAILS = [
  'qoanswls09@gmail.com',
  'qoanswls81@gmail.com',
  'qoanswls@naver.com',
];

const KAKAO_CHANNEL_URL = 'http://pf.kakao.com/_PgaRn';

// ── 친구초대 상수 ──────────────────────────────────────────
const INVITE_DAILY_LIMIT = 5;
const INVITE_TOTAL_LIMIT = 10;
const INVITE_BONUS = 50;

const INITIAL_FORM_DATA = {
  category: '', customCategory: '', menu: '',
  currentBrandName: '', operatingPeriod: '', storeAddress: '', storeSize: '',
  problems: [], changeWish: '',
  targetAudience: '', targetNote: '', strength: '',
  budget: '', changeScope: '', budgetNote: '',
  ownerStyle: '', moodTone: '',
  familiarHint: '', breakHint: '', experienceHint: '', extraNote: '',
  referenceStyle: '',
};

function safeJsonParse(t) { try { return JSON.parse(t); } catch { return null; } }

function resolveCategory(f) {
  if (f.category === '기타(직접입력)') return f.customCategory?.trim() || '기타';
  return f.category?.trim() || '';
}

function validateStep(step, f, storePhotos, menuPhotos) {
  if (step === 1) {
    if (!f.category) return '업종을 먼저 선택해 주세요.';
    if (f.category === '기타(직접입력)' && !f.customCategory?.trim()) return '직접 입력 업종을 적어 주세요.';
    if (!f.menu?.trim()) return '대표 메뉴를 입력해 주세요.';
    if (!f.currentBrandName?.trim()) return '현재 브랜드명을 입력해 주세요.';
    if (!f.operatingPeriod) return '운영 기간을 선택해 주세요.';
    if (!f.storeAddress?.trim()) return '매장 주소를 입력해 주세요.';
  }
  if (step === 2) {
    if (!f.problems || f.problems.length === 0) return '현재 문제점을 하나 이상 선택해 주세요.';
    if (!f.changeWish?.trim()) return '바꾸고 싶은 것을 입력해 주세요.';
    if (!f.targetAudience) return '현재 핵심 고객을 선택해 주세요.';
  }
  if (step === 3) {
    if (!storePhotos || storePhotos.length < 5) return '매장 사진을 최소 5장 올려주세요.';
    if (!menuPhotos || menuPhotos.length < 1) return '대표 메뉴 사진을 최소 1장 올려주세요.';
  }
  if (step === 4) {
    if (!f.budget) return '리브랜딩 예산을 선택해 주세요.';
    if (!f.changeScope) return '변화 범위를 선택해 주세요.';
  }
  if (step === 5) {
    if (!f.ownerStyle) return '운영자 스타일을 선택해 주세요.';
    if (!f.moodTone) return '원하는 브랜드 무드를 선택해 주세요.';
  }
  return '';
}

function extractResult(parsed) {
  if (!parsed) return null;
  if (parsed.result) return parsed.result;
  if (parsed.data) return parsed.data;
  return parsed;
}

function getShareIdFromUrl() {
  const path = window.location.pathname;
  const match = path.match(/^\/share\/([a-f0-9-]{36})$/);
  return match ? match[1] : null;
}

// ── 카카오 채널 플로팅 버튼 ──────────────────────────────
function KakaoChannelButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed', bottom: 28, right: 24, zIndex: 999,
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#FEE500', color: '#191919',
        padding: hovered ? '10px 18px 10px 14px' : '12px',
        borderRadius: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        textDecoration: 'none', fontWeight: 700, fontSize: 13,
        transition: 'all 0.2s ease', overflow: 'hidden', whiteSpace: 'nowrap',
      }} title="카카오 채널 고객센터">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#191919" style={{ flexShrink: 0 }}>
        <path d="M12 3C6.477 3 2 6.582 2 11c0 2.83 1.696 5.323 4.27 6.88-.188.703-.679 2.554-.778 2.95-.122.488.178.482.376.35.155-.103 2.464-1.673 3.463-2.355.537.076 1.09.115 1.669.115 5.523 0 10-3.582 10-8S17.523 3 12 3z"/>
      </svg>
      {hovered && <span>카카오 고객센터</span>}
    </a>
  );
}

// ── 친구초대 모달 ─────────────────────────────────────────
function InviteModal({ onClose, user }) {
  const [copied, setCopied] = useState(false);
  const inviteLink = user ? `https://rebrandboss.kr/?ref=${user.id}` : '';

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 400 }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '24px 24px 0 0', padding: '28px 20px 40px', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#111', letterSpacing: '-0.03em' }}>🎁 친구 초대하기</div>
            <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>친구가 가입하면 양쪽 모두 +{INVITE_BONUS}크레딧!</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb', padding: 0 }}>✕</button>
        </div>
        <div style={{ background: 'var(--purple-50)', border: '1px solid var(--border-soft)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.8 }}>
            📌 내 초대 링크로 친구가 가입하면<br />
            <strong style={{ color: '#6D28D9' }}>나 +{INVITE_BONUS}크레딧 · 친구 +{INVITE_BONUS}크레딧</strong> 적립!<br />
            <span style={{ fontSize: 11, color: '#aaa' }}>하루 최대 {INVITE_DAILY_LIMIT}명 · 평생 최대 {INVITE_TOTAL_LIMIT}명</span>
          </div>
        </div>
        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '12px 14px', marginBottom: 12, fontSize: 12, color: '#555', wordBreak: 'break-all', lineHeight: 1.6 }}>
          {inviteLink || '로그인 후 이용 가능합니다'}
        </div>
        <button onClick={handleCopy} style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: copied ? '#2e7d52' : '#6D28D9', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 8, transition: 'background 0.2s' }}>
          {copied ? '✅ 복사됐어요!' : '🔗 초대 링크 복사'}
        </button>
        <button onClick={handleCopy} style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#FEE500', color: '#191919', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 8 }}>
          💬 링크 복사 후 카카오톡에 붙여넣기
        </button>
        <button onClick={onClose} style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#f5f5f5', color: '#888', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>닫기</button>
      </div>
    </div>
  );
}

export default function App() {
  const [step, setStep]         = useState(1);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);

  // ── 사진 state ──
  const [storePhotos, setStorePhotos] = useState([]); // 매장 사진 (최대 10장)
  const [menuPhotos, setMenuPhotos]   = useState([]); // 메뉴 사진 (최대 3장)

  const [view, setView] = useState(() => {
    if (getShareIdFromUrl()) return 'share';
    const path = window.location.pathname;
    if (path === '/terms' || path === '/privacy') return 'terms';
    return 'home';
  });
  const [termsType, setTermsType]   = useState(() => window.location.pathname === '/privacy' ? 'privacy' : 'service');
  const [shareId, setShareId]       = useState(() => getShareIdFromUrl());
  const [resultData, setResultData] = useState(null);
  const [error, setError]           = useState('');
  const [warning, setWarning]       = useState('');

  const [user, setUser]                     = useState(null);
  const [showAuthModal, setShowAuthModal]   = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [saveLoading, setSaveLoading]       = useState(false);
  const [saveMsg, setSaveMsg]               = useState('');
  const [shareMsg, setShareMsg]             = useState('');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [isPublic, setIsPublic]             = useState(false);
  const [currentShareId, setCurrentShareId] = useState(null);

  const { checkLimit, useCredit, useCoupon, refetch: refetchUsage, credits } = useUsageLimit(user);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason]       = useState('brand');

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // ── ?ref= 파라미터 저장 ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) sessionStorage.setItem('rbb_ref', ref);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await handleReferral(u);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── 친구초대 적립 처리 ──
  const handleReferral = async (u) => {
    const referrerId = sessionStorage.getItem('rbb_ref');
    if (!referrerId || referrerId === u.id) return;
    try {
      const { data: existing } = await supabase.from('referrals').select('id').eq('invitee_id', u.id).maybeSingle();
      if (existing) { sessionStorage.removeItem('rbb_ref'); return; }

      const today = new Date().toISOString().slice(0, 10);
      const { data: todayRows } = await supabase.from('referrals').select('id').eq('referrer_id', referrerId).gte('created_at', `${today}T00:00:00Z`);
      const { data: totalRows } = await supabase.from('referrals').select('id').eq('referrer_id', referrerId);
      if ((todayRows?.length ?? 0) >= INVITE_DAILY_LIMIT || (totalRows?.length ?? 0) >= INVITE_TOTAL_LIMIT) {
        sessionStorage.removeItem('rbb_ref'); return;
      }
      await supabase.from('referrals').insert({ referrer_id: referrerId, invitee_id: u.id });
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await fetch('/.netlify/functions/bb-credits', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'invite_bonus', amount: INVITE_BONUS, reason: `초대받은 보상 (referrer: ${referrerId})` }),
      });
      await fetch('/.netlify/functions/bb-credits', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'invite_bonus_referrer', referrerId, amount: INVITE_BONUS, reason: `초대 보상 (invitee: ${u.id})` }),
      });
      sessionStorage.removeItem('rbb_ref');
    } catch (e) { console.error('referral error:', e); }
  };

  const onField = (name, value) => {
    setFormData(p => ({ ...p, [name]: value }));
    setErrors(p => ({ ...p, step: '' }));
    setError(''); setWarning('');
  };

  const onNext = () => {
    const msg = validateStep(step, formData, storePhotos, menuPhotos);
    if (msg) { setErrors({ step: msg }); return; }
    setErrors({ step: '' });
    setStep(p => Math.min(p + 1, 5));
  };

  const onPrev = () => { setErrors({ step: '' }); setStep(p => Math.max(p - 1, 1)); };

  // ── 리브랜딩 분석 요청 ──
  const requestRebrand = async ({ refineType = 'default', previousResult = null } = {}) => {
    if (!user) { setShowAuthModal(true); return; }
    const { allowed } = checkLimit('brand');
    if (!allowed) { setUpgradeReason('credit'); setShowUpgradeModal(true); return; }
    const creditResult = await useCredit('brand');
    if (!creditResult.ok) { setUpgradeReason('credit'); setShowUpgradeModal(true); return; }

    setResultData(null); setCurrentProjectId(null); setCurrentShareId(null);
    setIsPublic(false); setSaveMsg(''); setShareMsg('');
    setLoading(true); setError(''); setWarning('');

    const cat = resolveCategory(formData);
    const currentReferenceStyle = formData.referenceStyle?.trim() || '';

    // 사진을 base64로 변환해서 payload에 포함
    const storePhotoBase64 = storePhotos.map(p => p.base64);
    const menuPhotoBase64  = menuPhotos.map(p => p.base64);

    const payload = {
      ...formData,
      categoryResolved: cat,
      storePhotos: storePhotoBase64,
      menuPhotos: menuPhotoBase64,
      referenceStyle: currentReferenceStyle,
      refineType,
      previousResult,
    };

    try {
      const res    = await fetch('/.netlify/functions/gemini-rebrandboss', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const raw    = await res.text();
      const parsed = safeJsonParse(raw);
      if (!res.ok) throw new Error(parsed?.error || '리브랜딩 분석 중 오류가 발생했습니다.');
      if (!parsed)  throw new Error('서버 응답을 JSON으로 읽지 못했습니다.');
      const result = extractResult(parsed);
      if (!result || typeof result !== 'object') throw new Error('결과 데이터 형식이 올바르지 않습니다.');
      setResultData({ ...result, referenceStyle: currentReferenceStyle, formData: { ...formData } });
      setWarning(parsed?.warning || result?.warning || '');
      setView('result');
      if (user) refetchUsage();
    } catch (err) {
      setError(err?.message || '리브랜딩 결과를 불러오지 못했습니다.');
      setView('form');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!user) { setShowAuthModal(true); return; }
    if (!resultData) return;
    setSaveLoading(true); setSaveMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setShowAuthModal(true); return; }
      const res = await fetch('/.netlify/functions/bb-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          action: 'save_project', projectId: currentProjectId || null, formData,
          referenceStyle: formData.referenceStyle?.trim() || '',
          brandDecision: resultData?.brandDecision || {},
          interiorImagePackage: resultData?.interiorImagePackage || {},
          images: resultData?.images || {},
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '저장 실패');
      const proj = data.project;
      setCurrentProjectId(proj?.id || null);
      setCurrentShareId(proj?.share_id || null);
      setIsPublic(proj?.is_public || false);
      setSaveMsg('저장됐습니다 ✓');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) { setSaveMsg(`저장 실패: ${e.message}`); }
    finally { setSaveLoading(false); }
  };

  const handleShare = async () => {
    if (!user) { setShowAuthModal(true); return; }
    let projId = currentProjectId;
    let shareUid = currentShareId;
    if (!projId) {
      setShareMsg('저장 중...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch('/.netlify/functions/bb-save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ action: 'save_project', projectId: null, formData, referenceStyle: formData.referenceStyle?.trim() || '', brandDecision: resultData?.brandDecision || {}, interiorImagePackage: resultData?.interiorImagePackage || {}, images: resultData?.images || {} }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        projId = data.project?.id; shareUid = data.project?.share_id;
        setCurrentProjectId(projId); setCurrentShareId(shareUid);
      } catch (e) { setShareMsg(`공유 실패: ${e.message}`); return; }
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const newPublic = !isPublic;
      const res = await fetch('/.netlify/functions/bb-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'toggle_share', projectId: projId, isPublic: newPublic }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setIsPublic(newPublic);
      if (newPublic && shareUid) {
        await navigator.clipboard.writeText(`${window.location.origin}/share/${shareUid}`);
        setShareMsg('링크 복사됐습니다 ✓');
      } else { setShareMsg('공유가 해제됐습니다'); }
      setTimeout(() => setShareMsg(''), 4000);
    } catch (e) { setShareMsg(`공유 실패: ${e.message}`); }
  };

  const handleOpenProject = (project) => {
    setResultData({
      brandDecision:        project.brand_decision        || {},
      interiorImagePackage: project.interior_image_package || {},
      referenceStyle:       project.reference_style        || '',
      images:               project.images                 || {},
    });
    setCurrentProjectId(project.id);
    setCurrentShareId(project.share_id || null);
    setIsPublic(project.is_public || false);
    setSaveMsg(''); setShareMsg('');
    setView('result');
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); };

  const onSubmit = async () => {
    if (!user) { setShowAuthModal(true); return; }
    for (let i = 1; i <= 5; i++) {
      const msg = validateStep(i, formData, storePhotos, menuPhotos);
      if (msg) { setStep(i); setErrors({ step: msg }); return; }
    }
    setErrors({ step: '' });
    await requestRebrand({ refineType: 'default', previousResult: null });
  };

  const onRegenerate = () => requestRebrand({
    refineType: 'regenerate',
    previousResult: resultData ? { ...resultData } : null,
  });

  const onRestart = () => {
    setStep(1); setFormData(INITIAL_FORM_DATA); setErrors({});
    setStorePhotos([]); setMenuPhotos([]);
    setLoading(false); setView('home'); setResultData(null);
    setCurrentProjectId(null); setCurrentShareId(null); setIsPublic(false);
    setSaveMsg(''); setShareMsg(''); setError(''); setWarning('');
    window.history.pushState({}, '', '/');
  };

  const onBack = () => { setView('form'); setStep(5); setError(''); };
  const handleHeroStart = () => { if (!user) { setShowAuthModal(true); return; } setView('form'); };

  // ── 이용약관 ──
  if (view === 'terms') {
    return (
      <>
        <KakaoChannelButton />
        <TermsPage type={termsType} onBack={() => { window.history.pushState({}, '', '/'); setView('home'); }} />
      </>
    );
  }

  // ── 공유 페이지 ──
  if (view === 'share' && shareId) {
    return (
      <>
        <KakaoChannelButton />
        <SharePage shareId={shareId} onStart={() => { window.history.pushState({}, '', '/'); setView('home'); setShareId(null); }} />
      </>
    );
  }

  // ── 관리자 대시보드 ──
  if (view === 'admin') {
    return (
      <>
        <KakaoChannelButton />
        <div className="bb-page">
          <header style={s.header}>
            <div style={s.headerInner}>
              <div style={s.logo} onClick={onRestart} role="button">
                <div style={s.logoIcon}>✦</div>
                <span style={s.logoText}>리브랜드보스</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#7F77DD', fontWeight: 700, background: '#EEEDFE', padding: '4px 10px', borderRadius: 999 }}>🔑 관리자</span>
                <span style={s.userEmail}>{user?.email?.split('@')[0]}</span>
                <button style={s.headerBtn} onClick={() => setView('home')}>← 홈으로</button>
                <button style={s.headerBtn} onClick={handleLogout}>로그아웃</button>
              </div>
            </div>
          </header>
          <main style={s.main}><AdminDashboard user={user} onBack={() => setView('home')} /></main>
        </div>
      </>
    );
  }

  // ── 히어로 화면 ──
  if (view === 'home') {
    return (
      <>
        <KakaoChannelButton />
        {showAuthModal   && <AuthModal   onClose={() => setShowAuthModal(false)} />}
        {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} user={user} />}
        <div style={s.heroNav}>
          <div style={s.logo} onClick={onRestart} role="button">
            <div style={s.logoIconDark}>✦</div>
            <span style={s.logoTextDark}>리브랜드보스</span>
          </div>
          {user ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {isAdmin && <button style={{ ...s.heroNavBtn, background: 'rgba(127,119,221,0.3)', borderColor: 'rgba(127,119,221,0.5)' }} onClick={() => setView('admin')}>🔑 관리자</button>}
              <button style={s.heroNavBtn} onClick={() => setShowInviteModal(true)}>🎁 친구 초대</button>
              <button style={s.heroNavBtn} onClick={() => setView('mybrands')}>📁 내 프로젝트</button>
              <button style={s.heroNavBtn} onClick={handleLogout}>로그아웃</button>
            </div>
          ) : (
            <button style={s.heroNavBtn} onClick={() => setShowAuthModal(true)}>로그인</button>
          )}
        </div>
        <HeroSection onStart={handleHeroStart} />
      </>
    );
  }

  // ── 메인 앱 ──
  return (
    <>
      <KakaoChannelButton />
      <div className="bb-page">
        {showAuthModal    && <AuthModal    onClose={() => setShowAuthModal(false)} />}
        {showUpgradeModal && <UpgradeModal reason={upgradeReason} onClose={() => setShowUpgradeModal(false)} useCoupon={useCoupon} onCreditRefresh={refetchUsage} />}
        {showInviteModal  && <InviteModal  onClose={() => setShowInviteModal(false)} user={user} />}

        <header style={s.header}>
          <div style={s.headerInner}>
            <div style={s.logo} onClick={onRestart} role="button">
              <div style={s.logoIcon}>✦</div>
              <span style={s.logoText}>리브랜드보스</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {view === 'result' && <button style={s.headerBtn} onClick={onBack}>← 다시 입력</button>}
              {user ? (
                <>
                  {isAdmin && <button style={{ ...s.headerBtn, color: '#7F77DD', borderColor: '#C4B5FD' }} onClick={() => setView('admin')}>🔑 관리자</button>}
                  <button style={{ ...s.headerBtn, ...(view === 'mybrands' ? s.headerBtnActive : {}) }} onClick={() => setView('mybrands')}>📁 내 프로젝트</button>
                  <button style={{ ...s.headerBtn, color: '#6D28D9', borderColor: '#C4B5FD' }} onClick={() => setShowInviteModal(true)}>🎁 친구 초대</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-full)', background: 'var(--purple-50)', border: '1px solid var(--border-soft)', cursor: 'pointer' }}
                    onClick={() => { setUpgradeReason('credit'); setShowUpgradeModal(true); }}>
                    <span style={{ fontSize: 13 }}>⚡</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple-600)' }}>{isAdmin ? '∞' : credits.remain.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{isAdmin ? '무제한' : '크레딧'}</span>
                  </div>
                  <button style={s.upgradeBtn} onClick={() => { setUpgradeReason('credit'); setShowUpgradeModal(true); }}>✦ 업그레이드</button>
                  <span style={s.userEmail}>{user.email?.split('@')[0]}</span>
                  <button style={s.headerBtn} onClick={handleLogout}>로그아웃</button>
                </>
              ) : (
                <button style={{ ...s.headerBtn, ...s.loginBtn }} onClick={() => setShowAuthModal(true)}>로그인</button>
              )}
            </div>
          </div>
        </header>

        <main style={s.main}>
          {view === 'mybrands' && <MyBrands user={user} onOpenProject={handleOpenProject} onBack={() => setView('form')} />}

          {view === 'form' && (
            <>
              <section style={s.hero}>
                <div style={s.heroEyebrow}>AI 매장 리브랜딩 서비스</div>
                <h1 style={s.heroTitle}>
                  지금 내 매장을<br />
                  <span style={s.heroAccent}>새롭게 바꿔드립니다</span>
                </h1>
                <p style={s.heroDesc}>
                  매장 사진과 예산을 입력하면<br />
                  리브랜딩 전략부터 인테리어 이미지까지 제안합니다
                </p>
              </section>
              <div style={s.formWrap}>
                <StepForm
                  currentStep={step} formData={formData}
                  onFieldChange={onField} onNext={onNext} onPrev={onPrev}
                  onSubmit={onSubmit} loading={loading} errors={errors}
                  storePhotos={storePhotos} setStorePhotos={setStorePhotos}
                  menuPhotos={menuPhotos}   setMenuPhotos={setMenuPhotos}
                />
              </div>
              {error && <div style={s.errBox}><span style={s.errIcon}>⚠</span> {error}</div>}
              <section style={s.features}>
                {[
                  { icon: '📸', title: '사진 기반 분석', desc: '매장 사진을 AI가 직접\n분석해서 리브랜딩 방향 제안' },
                  { icon: '💰', title: '예산별 시나리오', desc: '내 예산에 맞는\n실행 가능한 계획을 제안' },
                  { icon: '🖼', title: '인테리어 이미지', desc: '내 매장 사진 기반으로\n새로운 공간 이미지 생성' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={s.featureCard}>
                    <div style={s.featureIcon}>{icon}</div>
                    <div style={s.featureTitle}>{title}</div>
                    <div style={s.featureDesc}>{desc}</div>
                  </div>
                ))}
              </section>
            </>
          )}

          {view === 'result' && (
            <>
              <ResultScreen
                resultData={resultData} error={error} warning={warning} loading={loading}
                onRegenerate={onRegenerate} onBackToForm={onBack} onRestart={onRestart}
                useCredit={useCredit} checkLimit={checkLimit}
                onCreditInsufficient={() => { setUpgradeReason('credit'); setShowUpgradeModal(true); }}
              />
              {resultData && !loading && (
                <div style={s.saveBar}>
                  <button style={{ ...s.saveBtn, opacity: saveLoading ? 0.7 : 1 }} onClick={handleSave} disabled={saveLoading}>
                    {saveLoading ? '저장 중...' : currentProjectId ? '💾 업데이트' : '💾 저장하기'}
                  </button>
                  <button style={{ ...s.shareBtn, ...(isPublic ? s.shareBtnActive : {}) }} onClick={handleShare}>
                    {isPublic ? '🔗 공유중 (클릭시 해제)' : '🔗 공유하기'}
                  </button>
                  {(saveMsg || shareMsg) && (
                    <span style={{ ...s.saveMsg, color: (saveMsg || shareMsg).includes('실패') ? '#9F1239' : '#0F6E56' }}>
                      {saveMsg || shareMsg}
                    </span>
                  )}
                  {!user && <span style={s.saveMsgHint}>로그인하면 저장·공유할 수 있어요</span>}
                </div>
              )}
            </>
          )}
        </main>

        <footer style={s.footer}>
          <div style={s.footerLinks}>
            <span style={s.footerLink} onClick={() => { setTermsType('service'); setView('terms'); window.history.pushState({}, '', '/terms'); }}>서비스 이용약관</span>
            <span style={s.footerLink} onClick={() => { setTermsType('privacy'); setView('terms'); window.history.pushState({}, '', '/privacy'); }}>개인정보처리방침</span>
            <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={s.footerLink}>💬 카카오 고객센터</a>
            <a href="mailto:support@rebrandboss.kr" style={s.footerLink}>이메일 문의</a>
          </div>
          <p style={s.footerCopy}>© 2026 RebrandBoss. All rights reserved.</p>
        </footer>
      </div>
    </>
  );
}

const s = {
  heroNav:        { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' },
  heroNavBtn:     { padding: '7px 14px', borderRadius: 2, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 400, cursor: 'pointer', letterSpacing: '0.02em' },
  logoIconDark:   { width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900 },
  logoTextDark:   { fontSize: 17, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.03em' },
  header:         { position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' },
  headerInner:    { maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo:           { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  logoIcon:       { width: 32, height: 32, borderRadius: 8, background: 'var(--purple-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900 },
  logoText:       { fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' },
  headerBtn:      { padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  headerBtnActive:{ background: 'var(--purple-50)', color: 'var(--purple-600)', border: '1px solid var(--border-soft)' },
  upgradeBtn:     { padding: '8px 16px', borderRadius: 'var(--radius-full)', border: 'none', background: 'linear-gradient(135deg,#6D28D9,#9333EA)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(109,40,217,0.3)' },
  loginBtn:       { background: '#6D28D9', color: '#FFFFFF', border: 'none' },
  userEmail:      { fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 },
  main:           { flex: 1, maxWidth: 1100, margin: '0 auto', width: '100%', padding: '0 24px 80px' },
  hero:           { textAlign: 'center', padding: '72px 0 48px' },
  heroEyebrow:    { display: 'inline-block', padding: '6px 16px', borderRadius: 'var(--radius-full)', background: 'var(--purple-50)', color: 'var(--purple-600)', fontSize: 13, fontWeight: 700, marginBottom: 24, letterSpacing: '0.02em' },
  heroTitle:      { fontSize: 'clamp(32px,5vw,56px)', fontWeight: 900, color: '#09090B', lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: 20, wordBreak: 'keep-all' },
  heroAccent:     { color: '#6D28D9' },
  heroDesc:       { fontSize: 'clamp(15px,2vw,18px)', color: 'var(--text-secondary)', lineHeight: 1.7, wordBreak: 'keep-all' },
  formWrap:       { maxWidth: 780, margin: '0 auto 32px' },
  errBox:         { maxWidth: 780, margin: '0 auto 16px', padding: '14px 18px', background: '#FFF1F2', border: '1px solid #FECDD3', borderRadius: 'var(--radius-md)', fontSize: 14, color: '#9F1239', display: 'flex', alignItems: 'center', gap: 8 },
  errIcon:        { fontSize: 16 },
  features:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, maxWidth: 780, margin: '0 auto', paddingTop: 16 },
  featureCard:    { background: 'var(--purple-50)', borderRadius: 'var(--radius-lg)', padding: '24px 20px', textAlign: 'center' },
  featureIcon:    { fontSize: 24, marginBottom: 10 },
  featureTitle:   { fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 },
  featureDesc:    { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' },
  saveBar:        { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '24px 0 0', marginTop: 8, flexWrap: 'wrap' },
  saveBtn:        { padding: '13px 28px', borderRadius: 'var(--radius-full)', border: 'none', background: '#6D28D9', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,40,217,0.35)', transition: 'opacity 0.15s' },
  shareBtn:       { padding: '13px 28px', borderRadius: 'var(--radius-full)', border: '1.5px solid #6D28D9', background: 'transparent', color: '#6D28D9', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' },
  shareBtnActive: { background: '#EEE8FF', borderColor: '#6D28D9' },
  saveMsg:        { fontSize: 14, fontWeight: 600 },
  saveMsgHint:    { fontSize: 13, color: 'var(--text-tertiary)', width: '100%', textAlign: 'center' },
  footer:         { textAlign: 'center', padding: '24px 0 40px', borderTop: '1px solid var(--border)', marginTop: 40 },
  footerLinks:    { display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 8, flexWrap: 'wrap' },
  footerLink:     { fontSize: 12, color: 'var(--text-tertiary)', cursor: 'pointer', textDecoration: 'none' },
  footerCopy:     { fontSize: 12, color: 'var(--text-tertiary)' },
};
