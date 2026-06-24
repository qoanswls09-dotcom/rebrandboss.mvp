import React, { useState } from 'react';

const PLANS = [
  {
    id: 'free',
    name: 'FREE',
    price: '0',
    credits: 50,
    features: ['크레딧 50개/월', '브랜드 생성 2회', '공간 이미지 1세트', '가이드라인 ✕'],
  },
  {
    id: 'starter',
    name: 'STARTER',
    price: '9,900',
    credits: 300,
    features: ['크레딧 300개/월', '브랜드 생성 5회', '공간 이미지 2세트', '가이드라인 1회', '크레딧 추가구매 가능'],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '24,900',
    badge: '추천',
    credits: 700,
    features: ['크레딧 700개/월', '브랜드 생성 15회', '공간 이미지 무제한', '가이드라인 3회', '브랜드명 재제안 무제한', '크레딧 추가구매 가능'],
  },
  {
    id: 'studio',
    name: 'STUDIO',
    price: '49,900',
    credits: 1300,
    features: ['크레딧 1,300개/월', '브랜드 생성 무제한', '모든 기능 무제한', '가이드라인 무제한', '크레딧 추가구매 가능'],
  },
];

const CREDIT_PACKS = [
  { id: 'pack_s', credits: '300',   price: '12,900', desc: '이미지 약 30장' },
  { id: 'pack_m', credits: '700',   price: '27,000', desc: '이미지 약 70장' },
  { id: 'pack_l', credits: '1,000', price: '38,900', desc: '이미지 약 100장' },
];

const CREDIT_COSTS = [
  { action: '브랜드 결정안 생성', cost: 10 },
  { action: '공간 이미지 1세트 (3장)', cost: 30 },
  { action: '이미지 1장 (메뉴/소품 등)', cost: 10 },
  { action: '가이드라인 전체 자동생성', cost: 100 },
  { action: '이미지 재생성 / 수정', cost: 10 },
  { action: '브랜드명 재제안', cost: 0 },
];

export default function UpgradeModal({ onClose, reason = 'credit', currentPlan = 'free', useCoupon, onCreditRefresh }) {
  const [tab, setTab] = useState(reason === 'coupon' ? 'coupon' : 'plans');
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg,  setCouponMsg]  = useState('');
  const [couponOk,   setCouponOk]   = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);

  const reasonText = reason === 'credit'
    ? '크레딧이 부족합니다. 플랜을 업그레이드하거나 크레딧을 추가 구매하세요.'
    : reason === 'brand'
    ? '이번 달 크레딧을 모두 사용했습니다. 플랜을 업그레이드하세요.'
    : reason === 'image'
    ? '이미지 생성 크레딧이 부족합니다.'
    : '쿠폰 코드를 입력해서 크레딧을 받으세요.';

  const handlePlan = (plan) => {
    if (plan.id === 'free') return;
    alert(plan.name + ' 플랜 결제 준비 중입니다.\n토스페이먼츠 심사 완료 후 활성화됩니다.');
  };

  const handleCredit = (pack) => {
    alert('크레딧 ' + pack.credits + '개 (' + pack.price + '원) 구매 준비 중입니다.\n토스페이먼츠 심사 완료 후 활성화됩니다.');
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
          <div style={s.limitBadge}>
            {reason === 'coupon' ? '쿠폰 등록' : reason === 'credit' ? '크레딧 부족' : 'FREE 한도 도달'}
          </div>
          <h2 style={s.title}>
            {reason === 'coupon' ? '쿠폰 코드 등록' : reason === 'credit' ? '크레딧을 충전하세요' : '더 많이 사용하려면\n업그레이드하세요'}
          </h2>
          <p style={s.subtitle}>{reasonText}</p>
        </div>
        <div style={s.tabs}>
          {[
            { key:'plans',   label:'플랜 업그레이드' },
            { key:'credits', label:'크레딧 추가구매' },
            { key:'coupon',  label:'🎟 쿠폰 등록' },
          ].map(({ key, label }) => (
            <button key={key} style={{ ...s.tab, ...(tab === key ? s.tabActive : {}) }} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'plans' && (
          <>
            <div style={s.planGrid}>
              {PLANS.map(plan => {
                const isCurrent = plan.id === currentPlan;
                const isDowngrade = PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === currentPlan);
                return (
                  <div key={plan.id} style={{ ...s.planCard, ...(plan.badge ? s.planCardFeatured : {}), ...(isCurrent ? s.planCardCurrent : {}) }}>
                    {plan.badge  && <div style={s.planBadge}>{plan.badge}</div>}
                    {isCurrent   && <div style={s.currentBadge}>현재 플랜</div>}
                    <div style={s.planName}>{plan.name}</div>
                    <div style={s.planPrice}>
                      <span style={s.planPriceNum}>{plan.price}</span>
                      <span style={s.planPricePeriod}>{plan.price === '0' ? '원' : '원/월'}</span>
                    </div>
                    <div style={s.creditBadge}>크레딧 {plan.credits.toLocaleString()}개/월</div>
                    <div style={s.planDivider}/>
                    <ul style={s.featureList}>
                      {plan.features.map(f => (
                        <li key={f} style={s.featureItem}>
                          <span style={s.featureCheck}>✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      style={{ ...s.planBtn, ...(isCurrent ? s.planBtnCurrent : plan.badge ? s.planBtnPrimary : s.planBtnSecondary) }}
                      onClick={() => !isCurrent && handlePlan(plan)}
                      disabled={isCurrent || isDowngrade}
                    >
                      {isCurrent ? '현재 사용 중' : isDowngrade ? '현재 플랜 이하' : plan.name + ' 시작하기'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={s.creditGuide}>
              <div style={s.creditGuideTitle}>크레딧 소모 기준</div>
              <div style={s.creditGuideGrid}>
                {CREDIT_COSTS.map(({ action, cost }) => (
                  <div key={action} style={s.creditGuideRow}>
                    <span style={s.creditGuideAction}>{action}</span>
                    <span style={s.creditGuideAmount}>{cost === 0 ? '무료' : cost + '크레딧'}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'credits' && (
          <>
            <div style={s.packGrid}>
              {CREDIT_PACKS.map(pack => (
                <div key={pack.id} style={s.packCard}>
                  <div style={s.packCredits}>{pack.credits}크레딧</div>
                  <div style={s.packDesc}>{pack.desc}</div>
                  <div style={s.packPrice}>₩{pack.price}</div>
                  <button style={s.packBtn} onClick={() => handleCredit(pack)}>구매하기</button>
                </div>
              ))}
            </div>
            <div style={s.creditGuide}>
              <div style={s.creditGuideTitle}>크레딧 소모 기준</div>
              <div style={s.creditGuideGrid}>
                {CREDIT_COSTS.map(({ action, cost }) => (
                  <div key={action} style={s.creditGuideRow}>
                    <span style={s.creditGuideAction}>{action}</span>
                    <span style={s.creditGuideAmount}>{cost === 0 ? '무료' : cost + '크레딧'}</span>
                  </div>
                ))}
              </div>
            </div>
            <p style={s.packNote}>구매한 크레딧은 구독 크레딧 소진 후 자동으로 사용됩니다. 유효기간 6개월.</p>
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
                <button
                  style={{ ...s.couponBtn, opacity: couponLoading || couponOk ? 0.6 : 1 }}
                  onClick={handleCoupon}
                  disabled={couponLoading || couponOk}
                >
                  {couponLoading ? '확인 중...' : couponOk ? '적용됨 ✓' : '등록하기'}
                </button>
              </div>
              {couponMsg && (
                <div style={{ ...s.couponMsg, color: couponOk ? '#059669' : '#DC2626', background: couponOk ? '#ECFDF5' : '#FFF1F2' }}>
                  {couponMsg}
                </div>
              )}
              {couponOk && <button style={s.couponCloseBtn} onClick={onClose}>확인</button>}
            </div>
            <div style={s.couponNote}>
              <div style={s.couponNoteTitle}>쿠폰 사용 안내</div>
              <div style={s.couponNoteItem}>· 쿠폰 크레딧은 즉시 지급됩니다</div>
              <div style={s.couponNoteItem}>· 쿠폰당 1회만 사용 가능합니다</div>
              <div style={s.couponNoteItem}>· 쿠폰 크레딧 유효기간은 6개월입니다</div>
              <div style={s.couponNoteItem}>· 문의: support@brandboss.kr</div>
            </div>
          </div>
        )}

        <p style={s.footNote}>언제든 해지 가능 · 다음 달 1일 자동 갱신 · 결제 문의: support@brandboss.kr</p>
      </div>
    </div>
  );
}

const s = {
  overlay:          { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' },
  modal:            { background:'#FFFFFF', borderRadius:24, padding:'28px 20px 24px', width:'100%', maxWidth:780, position:'relative', boxShadow:'0 24px 80px rgba(0,0,0,0.18)', maxHeight:'92vh', overflowY:'auto' },
  closeBtn:         { position:'absolute', top:16, right:16, width:32, height:32, border:'none', background:'#F4F4F5', borderRadius:'50%', cursor:'pointer', fontSize:14, color:'#71717A' },
  header:           { textAlign:'center', marginBottom:20 },
  logoIcon:         { width:44, height:44, borderRadius:12, background:'#6D28D9', color:'#fff', fontSize:18, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' },
  limitBadge:       { display:'inline-block', padding:'4px 12px', borderRadius:999, background:'#FEF3C7', color:'#92400E', fontSize:12, fontWeight:700, marginBottom:10 },
  title:            { margin:'0 0 8px', fontSize:20, fontWeight:900, color:'#09090B', letterSpacing:'-0.03em', lineHeight:1.35, whiteSpace:'pre-line' },
  subtitle:         { margin:0, fontSize:13, color:'#71717A', lineHeight:1.6 },
  tabs:             { display:'flex', gap:4, marginBottom:20, borderBottom:'1px solid #E4E4E7' },
  tab:              { padding:'8px 16px', border:'none', background:'transparent', color:'#71717A', fontSize:13, fontWeight:600, cursor:'pointer', borderBottom:'2px solid transparent', marginBottom:-1 },
  tabActive:        { color:'#6D28D9', borderBottomColor:'#6D28D9' },
  planGrid:         { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 },
  planCard:         { border:'1.5px solid #E4E4E7', borderRadius:14, padding:'14px 10px', position:'relative', display:'flex', flexDirection:'column', gap:5 },
  planCardFeatured: { border:'2px solid #6D28D9', background:'#FAFAFE' },
  planCardCurrent:  { background:'#F9F9F9', opacity:0.85 },
  planBadge:        { position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'#6D28D9', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:999, whiteSpace:'nowrap' },
  currentBadge:     { position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:'#E4E4E7', color:'#71717A', fontSize:10, fontWeight:700, padding:'2px 10px', borderRadius:999, whiteSpace:'nowrap' },
  planName:         { fontSize:10, fontWeight:700, color:'#6D28D9', letterSpacing:'0.06em' },
  planPrice:        { display:'flex', alignItems:'baseline', gap:2 },
  planPriceNum:     { fontSize:17, fontWeight:900, color:'#09090B', letterSpacing:'-0.03em' },
  planPricePeriod:  { fontSize:11, color:'#71717A' },
  creditBadge:      { display:'inline-block', fontSize:10, color:'#6D28D9', background:'#EEE8FF', padding:'2px 7px', borderRadius:8, fontWeight:600, marginBottom:2 },
  planDivider:      { height:1, background:'#E4E4E7', margin:'4px 0' },
  featureList:      { listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:4, flex:1 },
  featureItem:      { display:'flex', alignItems:'flex-start', gap:4, fontSize:10, color:'#3F3F46', lineHeight:1.45 },
  featureCheck:     { color:'#6D28D9', fontWeight:700, flexShrink:0 },
  planBtn:          { marginTop:6, width:'100%', padding:'8px 0', borderRadius:999, fontSize:11, fontWeight:700, cursor:'pointer', border:'none' },
  planBtnPrimary:   { background:'#6D28D9', color:'#fff' },
  planBtnSecondary: { background:'#F4F4F5', color:'#3F3F46' },
  planBtnCurrent:   { background:'#E4E4E7', color:'#A1A1AA', cursor:'default' },
  creditGuide:      { background:'#F9F9FB', borderRadius:12, padding:'14px 16px', marginBottom:14 },
  creditGuideTitle: { fontSize:11, fontWeight:700, color:'#6D28D9', letterSpacing:'0.06em', marginBottom:10 },
  creditGuideGrid:  { display:'flex', flexDirection:'column', gap:6 },
  creditGuideRow:   { display:'flex', justifyContent:'space-between', alignItems:'center' },
  creditGuideAction:{ fontSize:12, color:'#52525B' },
  creditGuideAmount:{ fontSize:12, fontWeight:700, color:'#09090B' },
  packGrid:         { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 },
  packCard:         { border:'1.5px solid #E4E4E7', borderRadius:14, padding:'18px 14px', display:'flex', flexDirection:'column', gap:6, textAlign:'center' },
  packCredits:      { fontSize:20, fontWeight:900, color:'#09090B', letterSpacing:'-0.03em' },
  packDesc:         { fontSize:12, color:'#71717A' },
  packPrice:        { fontSize:17, fontWeight:700, color:'#6D28D9', margin:'4px 0' },
  packBtn:          { width:'100%', padding:'9px 0', borderRadius:999, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', background:'#6D28D9', color:'#fff', marginTop:4 },
  packNote:         { fontSize:11, color:'#A1A1AA', textAlign:'center', marginBottom:12, lineHeight:1.6 },
  couponWrap:       { padding:'8px 0 16px' },
  couponBox:        { background:'#FAFAFE', border:'1.5px solid #E4E4E7', borderRadius:16, padding:'28px 24px', textAlign:'center', marginBottom:16 },
  couponIcon:       { fontSize:36, marginBottom:12 },
  couponLabel:      { fontSize:13, fontWeight:700, color:'#3F3F46', marginBottom:14 },
  couponInputRow:   { display:'flex', gap:8, maxWidth:440, margin:'0 auto' },
  couponInput:      { flex:1, padding:'11px 14px', border:'1.5px solid #E4E4E7', borderRadius:10, fontSize:14, fontFamily:'monospace', letterSpacing:'0.06em', outline:'none', color:'#111', textTransform:'uppercase' },
  couponBtn:        { padding:'11px 20px', borderRadius:10, border:'none', background:'#6D28D9', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' },
  couponMsg:        { marginTop:12, padding:'10px 16px', borderRadius:8, fontSize:13, fontWeight:600, maxWidth:440, margin:'12px auto 0' },
  couponCloseBtn:   { marginTop:16, padding:'10px 32px', borderRadius:999, border:'none', background:'#6D28D9', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' },
  couponNote:       { background:'#F9F9FB', borderRadius:12, padding:'14px 16px' },
  couponNoteTitle:  { fontSize:12, fontWeight:700, color:'#6D28D9', marginBottom:8 },
  couponNoteItem:   { fontSize:12, color:'#71717A', lineHeight:1.8 },
  footNote:         { margin:0, fontSize:11, color:'#A1A1AA', textAlign:'center', lineHeight:1.6 },
};
