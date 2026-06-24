// src/components/TermsPage.jsx
// /terms 라우트에서 렌더링 — 서비스 이용약관 + 개인정보처리방침

import React, { useState } from 'react';

const TERMS_SERVICE = `제1조 (목적)
이 약관은 브랜드보스(이하 "회사")가 제공하는 AI 브랜드 기획 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
① "서비스"란 회사가 제공하는 AI 기반 브랜드 결정안 생성, 이미지 생성, 브랜드 가이드라인 제작 등 일체의 온라인 서비스를 말합니다.
② "이용자"란 이 약관에 따라 회사가 제공하는 서비스를 이용하는 자를 말합니다.
③ "크레딧"이란 서비스 내 이미지 생성 등 유료 기능 이용을 위해 사용되는 가상 화폐 단위를 말합니다.

제3조 (약관의 효력 및 변경)
① 이 약관은 서비스 화면에 게시하거나 이용자에게 공지함으로써 효력이 발생합니다.
② 회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 변경할 수 있으며, 변경 시 7일 전에 공지합니다.

제4조 (서비스 이용)
① 서비스는 회원가입 후 이용 가능합니다. 일부 기능은 비회원도 이용할 수 있습니다.
② 만 14세 미만은 서비스를 이용할 수 없습니다.
③ 이용자는 타인의 개인정보를 도용하거나 허위 정보를 등록할 수 없습니다.

제5조 (AI 생성 결과물의 법적 책임 한계)
① 본 서비스는 인공지능(AI) 기술을 활용하여 브랜드명, 콘셉트, 공간 이미지, 브랜드 가이드라인 등을 생성합니다.
② 회사는 AI가 생성한 결과물의 정확성, 완전성, 적법성, 상업적 적합성에 대하여 어떠한 보증도 하지 않습니다.
③ AI가 생성한 브랜드명, 로고 방향, 컨셉 등이 제3자의 상표권, 저작권, 기타 지식재산권을 침해할 수 있으며, 이에 대한 확인 및 법적 책임은 전적으로 이용자에게 있습니다.
④ AI 생성 결과물을 실제 사업에 적용하기 전에 반드시 전문 변리사, 변호사 등 전문가의 검토를 받으시기 바랍니다.
⑤ 회사는 AI 생성 결과물을 실제 사업에 적용함으로써 발생하는 어떠한 손해(상표권 분쟁, 영업 손실, 브랜드 분쟁 등)에 대해서도 책임을 지지 않습니다.
⑥ 생성된 공간 이미지는 실제 인테리어 시공의 기준이 될 수 없으며, 참고 자료로만 활용하여야 합니다. 실제 시공 시 발생하는 비용, 하자, 분쟁에 대해 회사는 일체의 책임을 지지 않습니다.

제6조 (구독 및 결제)
① 유료 서비스는 월정액 구독 방식으로 제공됩니다.
② 구독료는 매월 결제일에 자동으로 청구됩니다.
③ 크레딧은 구독 크레딧과 추가 구매 크레딧으로 구분되며, 구독 크레딧은 매월 초기화됩니다.
④ 추가 구매 크레딧의 유효기간은 구매일로부터 6개월입니다.
⑤ 사용된 크레딧은 환불되지 않습니다.

제7조 (환불 정책)
① 구독 서비스는 결제일로부터 7일 이내에 서비스를 이용하지 않은 경우 전액 환불이 가능합니다.
② 크레딧을 사용한 경우 사용분에 해당하는 금액을 제외하고 환불됩니다.
③ 이미 사용된 구독 기간에 대해서는 환불이 제공되지 않습니다.

제8조 (금지 행위)
이용자는 다음 행위를 하여서는 안 됩니다.
① 타인의 계정 정보를 도용하는 행위
② 서비스를 통해 불법적인 콘텐츠를 생성하는 행위
③ 서비스의 운영을 방해하는 행위
④ 생성된 결과물을 무단으로 재판매하는 행위

제9조 (서비스 중단)
① 회사는 시스템 점검, 장애, 불가항력적 사유 등으로 서비스 제공을 일시 중단할 수 있습니다.
② 회사의 귀책사유로 인한 서비스 중단 시 이용자에게 사전 공지합니다.

제10조 (면책조항)
① 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인해 서비스를 제공하지 못하는 경우 책임이 면제됩니다.
② 회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.
③ AI 서비스 특성상 생성 결과물이 이용자의 기대와 다를 수 있으며, 이에 대해 회사는 책임을 지지 않습니다.

제11조 (분쟁 해결)
이 약관과 관련된 분쟁은 대한민국 법률에 따라 처리되며, 관할 법원은 서울중앙지방법원으로 합니다.

부칙
이 약관은 2026년 1월 1일부터 시행합니다.`;

const TERMS_PRIVACY = `브랜드보스 개인정보 처리방침

브랜드보스(이하 "회사")는 개인정보보호법에 따라 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.

제1조 (수집하는 개인정보 항목)
① 회원가입 시: 이메일 주소, 비밀번호(암호화 저장)
② 서비스 이용 시: 브랜드 입력 정보, 이미지 생성 이력, 접속 로그
③ 결제 시: 결제 수단 정보(토스페이먼츠를 통해 처리, 회사는 카드번호 등 민감 정보를 저장하지 않음)

제2조 (개인정보 수집 목적)
① 서비스 제공 및 운영
② 회원 관리 및 본인 확인
③ 결제 처리 및 서비스 이용 이력 관리
④ 고객 지원 및 불만 처리
⑤ 서비스 개선을 위한 통계 분석

제3조 (개인정보 보유 기간)
① 회원 정보: 탈퇴 시까지 (탈퇴 후 즉시 삭제)
② 결제 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)
③ 접속 로그: 3개월

제4조 (개인정보 제3자 제공)
회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우는 예외입니다.
① 이용자가 사전에 동의한 경우
② 법령의 규정에 의거하거나 수사기관의 요청이 있는 경우

제5조 (개인정보 처리 위탁)
회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁합니다.
- Supabase Inc.: 데이터베이스 및 인증 서비스
- 토스페이먼츠: 결제 처리 서비스
- Google (Gemini API): AI 텍스트 생성 서비스
- Black Forest Labs (Flux API): AI 이미지 생성 서비스

제6조 (이용자의 권리)
이용자는 언제든지 다음 권리를 행사할 수 있습니다.
① 개인정보 열람 요청
② 개인정보 정정·삭제 요청
③ 개인정보 처리 정지 요청
④ 회원 탈퇴 및 개인정보 삭제 요청

제7조 (개인정보 보호책임자)
개인정보 관련 문의: support@brandboss.kr

이 방침은 2026년 1월 1일부터 시행합니다.`;

export default function TermsPage({ type = 'service', onBack }) {
  const [activeTab, setActiveTab] = useState(type);

  return (
    <div style={t.wrap}>
      <div style={t.header}>
        {onBack && <button style={t.backBtn} onClick={onBack}>← 뒤로</button>}
        <div style={t.logo}>✦ 브랜드보스</div>
      </div>

      <div style={t.container}>
        <div style={t.tabs}>
          <button style={{ ...t.tab, ...(activeTab === 'service' ? t.tabActive : {}) }} onClick={() => setActiveTab('service')}>서비스 이용약관</button>
          <button style={{ ...t.tab, ...(activeTab === 'privacy' ? t.tabActive : {}) }} onClick={() => setActiveTab('privacy')}>개인정보처리방침</button>
        </div>

        <div style={t.content}>
          {activeTab === 'service' && (
            <>
              <h1 style={t.title}>서비스 이용약관</h1>
              <p style={t.date}>시행일: 2026년 1월 1일</p>
              <div style={t.highlight}>
                <strong>⚠ 중요 안내</strong><br/>
                브랜드보스 AI가 생성한 결과물(브랜드명, 이미지, 가이드라인 등)을 실제 사업에 적용하기 전에 반드시 전문가의 검토를 받으시기 바랍니다. 회사는 AI 생성 결과물로 인해 발생하는 상표권 분쟁, 저작권 침해 등 법적 문제에 대해 책임을 지지 않습니다.
              </div>
              <pre style={t.body}>{TERMS_SERVICE}</pre>
            </>
          )}
          {activeTab === 'privacy' && (
            <>
              <h1 style={t.title}>개인정보처리방침</h1>
              <p style={t.date}>시행일: 2026년 1월 1일</p>
              <pre style={t.body}>{TERMS_PRIVACY}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const t = {
  wrap:      { minHeight:'100vh', background:'#fafafa' },
  header:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid #e4e4e7', background:'#fff' },
  backBtn:   { padding:'8px 16px', borderRadius:999, border:'1px solid #e4e4e7', background:'transparent', color:'#52525b', fontSize:13, fontWeight:600, cursor:'pointer' },
  logo:      { fontSize:16, fontWeight:800, color:'#09090b', letterSpacing:'-0.03em' },
  container: { maxWidth:800, margin:'0 auto', padding:'40px 24px 80px' },
  tabs:      { display:'flex', gap:8, marginBottom:32, borderBottom:'1px solid #e4e4e7', paddingBottom:0 },
  tab:       { padding:'10px 24px', border:'none', background:'transparent', color:'#71717a', fontSize:14, fontWeight:600, cursor:'pointer', borderBottom:'2px solid transparent', marginBottom:-1 },
  tabActive: { color:'#6D28D9', borderBottomColor:'#6D28D9' },
  title:     { fontSize:28, fontWeight:900, color:'#09090b', letterSpacing:'-0.03em', marginBottom:8 },
  date:      { fontSize:13, color:'#71717a', marginBottom:24 },
  highlight: { background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:12, padding:'16px 20px', fontSize:13, color:'#92400E', lineHeight:1.7, marginBottom:28 },
  body:      { fontSize:13, color:'#3f3f46', lineHeight:1.8, whiteSpace:'pre-wrap', fontFamily:'inherit', margin:0 },
  content:   { background:'#fff', borderRadius:16, padding:'32px', border:'1px solid #e4e4e7' },
};
