import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

// ★★★ 리브랜드보스는 결제 기능을 자체적으로 갖지 않는다 ★★★
// KG이니시스 전자결제 심사/계약이 brandboss.kr 기준으로 진행됐기 때문에,
// 실제 카드 결제는 반드시 브랜드보스에서만 일어나야 한다 (심사받지 않은 도메인에서
// 결제가 발생하면 안 됨). 그래서 이 모달은 "구매하기" 버튼을 눌러도 실제 결제를 하지 않고,
// 안내 문구를 보여준 뒤 브랜드보스로 이동시키기만 한다.

// ★ 브랜드보스 도메인 — 실제 도메인 그대로
const BRANDBOSS_URL = 'https://brandboss.kr';

const CREDIT_PACKS = [
  { id: 'pack_s', credits: '300',   price: '9,900',  desc: '이미지 약 30장' },
  { id: 'pack_m', credits: '700',   price: '24,900', desc: '이미지 약 70장' },
  { id: 'pack_l', credits: '1,300', price: '49,900', desc: '이미지 약 130장' },
];

const CREDIT_COSTS = [
  { action: '리브랜딩 결정안 생성', cost: 10 },
  { action: '공간 이미지 1세트 (3장)', cost: 30 },
  { action: '이미지 1장 (메뉴/소품 등)', cost: 10 },
  { action: '가이드라인 전체 자동생성', cost: 100 },
  { action: '이미지 재생성 / 수정', cost: 10 },
];

export default function UpgradeModal({ onClose, reason = 'credit', useCoupon, onCreditRefresh }) {
  const [tab, setTab] = useState(reason === 'coupon' ? 'coupon' : 'credits');
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg,  setCouponMsg]  = useState('');
  const [couponOk,   setCouponOk]   = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const reasonText = reason === 'coupon'
    ? '쿠폰 코드를 입력해서 크레딧을 받으세요.'
    : '크레딧이 부족합니다. 결제는 브랜드보스에서 진행됩니다.';

  // ★ 핵심: 실제 결제를 하지 않고, 안내 후 브랜드보스로 이동 (★ SSO 토큰도 같이 실어보냄)
  const handleGoToBrandboss = async () => {
    setRedirecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && session?.refresh_token) {
        const hash = `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`;
        window.location.href = `${BRANDBOSS_URL}/?upgrade=true#${hash}`;
        return;
      }
    } catch { /* 토큰 획득 실패 시 그냥 로그인부터 시작하도록 폴백 */ }
    window.location.href = `${BRANDBOSS_URL}/?upgrade=true`;
  };

  const handleCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponMsg('쿠폰 코드를 입력해주세요.'); return; }
    setCouponLoading(true); setCouponMsg('');
    try {
      if (!useCoupon) throw new Error('로그인이 필요합니다');
      const result = await useCoupon(code);
      if (!result.ok) {
        setCouponMsg(result.error || '유효하지 않은 쿠폰 코드예요.');
      } else {
        setCouponOk(true);
        setCouponMsg('🎉 ' + result.bonus + '크레딧이 충전됐어요!');
        if (onCreditRefresh) onCreditRefresh();
      }
    } catch (e) {
      setCouponMsg(e.message || '쿠폰 등록에 실패했어요.');
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <button style={s.closeBtn} onClick={onClose}>✕</button>
        <div style={s.header}>
          <div style={s.logoIcon}>✦</div>
          <div style={s.limitBadge}>{reason === 'coupon' ? '쿠폰 등록' : '크레딧 부족'}</div>
          <h2 style={s.title}>{reason === 'coupon' ? '쿠폰 코드 등록' : '크레딧 구매 안내'}</h2>
          <p style={s.subtitle}>{reasonText}</p>
        </div>

        <div style={s.tabs}>
          {[{ key:'credits', label:'크레딧 구매' }, { key:'coupon', label:'🎟 쿠폰 등록' }].map(({ key, label }) => (
            <button key={key} style={{ ...s.tab, ...(tab === key ? s.tabActive : {}) }} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {tab === 'credits' && (
          <>
            {/* ★ 안내 배너 — 왜 여기서 못 사고 브랜드보스로 가는지 명확히 설명 */}
            <div style={s.noticeBox}>
              <div style={s.noticeTitle}>💡 결제는 브랜드보스에서 진행돼요</div>
              <div style={s.noticeText}>
                리브랜드보스와 브랜드보스는 <strong>같은 계정</strong>을 공유해요.<br/>
                크레딧을 구매하시면 리브랜드보스에서도 동일하게 사용할 수 있습니다.
              </div>
            </div>

            <div style={s.packGrid}>
              {CREDIT_PACKS.map(pack => (
                <div key={pack.id} style={s.packCard}>
                  <div style={s.packCredits}>{pack.credits}크레딧</div>
                  <div style={s.packDesc}>{pack.desc}</div>
                  <div style={s.packPrice}>₩{pack.price}</div>
                </div>
              ))}
            </div>

            <button style={{ ...s.goBtn, opacity: redirecting ? 0.6 : 1 }} onClick={handleGoToBrandboss} disabled={redirecting}>
              {redirecting ? '이동 중...' : '✦ 브랜드보스에서 구매하기 →'}
            </button>

            <div style={s.creditGuide}>
              <div style={s.creditGuideTitle}>크레딧 소모 기준</div>
              <div style={s.creditGuideGrid}>
                {CREDIT_COSTS.map(({ action, cost }) => (
                  <div key={action} style={s.creditGuideRow}>
                    <span style={s.creditGuideAction}>{action}</span>
                    <span style={s.creditGuideAmount}>{cost}크레딧</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'coupon' && (
          <div style={s.couponWrap}>
            <div style={s.couponBox}>
              <div style={s.couponIcon}>🎟</div>
              <div style={s.couponLabel}>쿠폰 코드 입력</div>
              <div style={s.couponInputRow}>
                <input
                  style={s.couponInput}
                  value={couponCode}
                  onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponMsg(''); setCouponOk(false); }}
                  onKeyDown={e => e.key === 'Enter' && !couponOk && handleCoupon()}
                  placeholder="예: BB50-XXXXXXXX"
                  maxLength={30}
                  disabled={couponOk}
                />
                <button style={{ ...s.couponBtn, opacity: couponLoading || couponOk ? 0.6 : 1 }} onClick={handleCoupon} disabled={couponLoading || couponOk}>
                  {couponLoading ? '확인 중...' : couponOk ? '적용됨 ✓' : '등록하기'}
                </button>
              </div>
              {couponMsg && (
                <div style={{ ...s.couponMsg, color: couponOk ? '#059669' : '#DC2626', background: couponOk ? '#ECFDF5' : '#FFF1F2' }}>{couponMsg}</div>
              )}
              {couponOk && <button style={s.couponCloseBtn} onClick={onClose}>확인</button>}
            </div>
          </div>
        )}

        <p style={s.footNote}>결제/환불 관련 문의: support@brandboss.kr</p>
      </div>
    </div>
  );
}

const s = {
  overlay:          { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' },
  modal:            { background:'#FFFFFF', borderRadius:24, padding:'28px 20px 24px', width:'100%', maxWidth:640, position:'relative', boxShadow:'0 24px 80px rgba(0,0,0,0.18)', maxHeight:'92vh', overflowY:'auto' },
  closeBtn:         { position:'absolute', top:16, right:16, width:32, height:32, border:'none', background:'#F4F4F5', borderRadius:'50%', cursor:'pointer', fontSize:14, color:'#71717A' },
  header:           { textAlign:'center', marginBottom:20 },
  logoIcon:         { width:44, height:44, borderRadius:12, background:'#6D28D9', color:'#fff', fontSize:18, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' },
  limitBadge:       { display:'inline-block', padding:'4px 12px', borderRadius:999, background:'#FEF3C7', color:'#92400E', fontSize:12, fontWeight:700, marginBottom:10 },
  title:            { margin:'0 0 8px', fontSize:20, fontWeight:900, color:'#09090B', letterSpacing:'-0.03em' },
  subtitle:         { margin:0, fontSize:13, color:'#71717A', lineHeight:1.6 },
  tabs:             { display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #E4E4E7', justifyContent:'center' },
  tab:              { padding:'8px 16px', border:'none', background:'transparent', color:'#71717A', fontSize:13, fontWeight:600, cursor:'pointer', borderBottom:'2px solid transparent', marginBottom:-1 },
  tabActive:        { color:'#6D28D9', borderBottomColor:'#6D28D9' },
  noticeBox:        { background:'#EEE8FF', border:'1px solid #D8D0F5', borderRadius:12, padding:'14px 16px', marginBottom:16 },
  noticeTitle:      { fontSize:13, fontWeight:800, color:'#6D28D9', marginBottom:6 },
  noticeText:       { fontSize:12, color:'#52525B', lineHeight:1.7 },
  packGrid:         { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 },
  packCard:         { border:'1.5px solid #E4E4E7', borderRadius:14, padding:'16px 12px', display:'flex', flexDirection:'column', gap:5, textAlign:'center' },
  packCredits:      { fontSize:18, fontWeight:900, color:'#09090B', letterSpacing:'-0.03em' },
  packDesc:         { fontSize:11, color:'#71717A' },
  packPrice:        { fontSize:15, fontWeight:700, color:'#6D28D9' },
  goBtn:            { width:'100%', padding:'14px 0', borderRadius:999, border:'none', background:'#6D28D9', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:16, boxShadow:'0 4px 14px rgba(109,40,217,0.3)' },
  creditGuide:      { background:'#F9F9FB', borderRadius:12, padding:'14px 16px', marginBottom:14 },
  creditGuideTitle: { fontSize:11, fontWeight:700, color:'#6D28D9', letterSpacing:'0.06em', marginBottom:10 },
  creditGuideGrid:  { display:'flex', flexDirection:'column', gap:6 },
  creditGuideRow:   { display:'flex', justifyContent:'space-between', alignItems:'center' },
  creditGuideAction:{ fontSize:12, color:'#52525B' },
  creditGuideAmount:{ fontSize:12, fontWeight:700, color:'#09090B' },
  couponWrap:       { padding:'8px 0 16px' },
  couponBox:        { background:'#FAFAFE', border:'1.5px solid #E4E4E7', borderRadius:16, padding:'28px 24px', textAlign:'center', marginBottom:16 },
  couponIcon:       { fontSize:36, marginBottom:12 },
  couponLabel:      { fontSize:13, fontWeight:700, color:'#3F3F46', marginBottom:14 },
  couponInputRow:   { display:'flex', gap:8, maxWidth:440, margin:'0 auto' },
  couponInput:      { flex:1, padding:'11px 14px', border:'1.5px solid #E4E4E7', borderRadius:10, fontSize:14, fontFamily:'monospace', letterSpacing:'0.06em', outline:'none', color:'#111', textTransform:'uppercase' },
  couponBtn:        { padding:'11px 20px', borderRadius:10, border:'none', background:'#6D28D9', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' },
  couponMsg:        { marginTop:12, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, maxWidth:440, margin:'12px auto 0' },
  couponCloseBtn:   { marginTop:16, padding:'10px 32px', borderRadius:999, border:'none', background:'#6D28D9', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' },
  footNote:         { margin:0, fontSize:11, color:'#A1A1AA', textAlign:'center', lineHeight:1.6 },
};
