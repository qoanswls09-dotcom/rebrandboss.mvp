// src/hooks/usePdfExport.js
// 브라우저 프린트 방식 — 결과 화면을 그대로 PDF로 저장
// 한글 완벽 지원, 이미지 포함, 별도 라이브러리 불필요

import { useState } from 'react';

export function usePdfExport() {
  const [exporting, setExporting] = useState(false);

  const exportPdf = async (resultData) => {
    setExporting(true);
    try {
      const bd     = resultData?.brandDecision        || {};
      const pkg    = resultData?.interiorImagePackage  || {};
      const images = resultData?.images               || {};

      const spaceImgs   = images.space   || [];
      const menuImgs    = images.menu    || [];
      const propImgs    = images.prop    || [];
      const serviceImgs = images.service || [];

      const imgTag = (url) =>
        url ? `<img src="${url}" style="width:100%;border-radius:8px;display:block;margin-bottom:8px;" />` : '';

      const infoItems = [
        { label: '매장 콘셉트', value: bd.storeConcept },
        { label: '핵심 고객',   value: bd.coreCustomers },
        { label: '어필 포인트', value: bd.appealReason },
        { label: '핵심 메시지', value: bd.keyMessage },
      ].filter(i => i.value);

      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>${bd.brandName || 'BrandBoss'} — 브랜드북</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Nanum Gothic', sans-serif;
    background: #fff;
    color: #09090B;
    font-size: 14px;
    line-height: 1.6;
  }

  /* ── 커버 ── */
  .cover {
    background: #6D28D9;
    color: #fff;
    padding: 56px 48px 48px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    page-break-after: always;
  }
  .cover-logo { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; opacity: 0.6; margin-bottom: 6px; }
  .cover-sub  { font-size: 9px; opacity: 0.45; margin-bottom: 52px; letter-spacing: 0.1em; }
  .cover-name { font-size: 56px; font-weight: 900; letter-spacing: -0.04em; line-height: 1.05; margin-bottom: 12px; }
  .cover-tagline { font-size: 17px; opacity: 0.82; line-height: 1.55; margin-bottom: 32px; }
  .cover-hr   { border: none; border-top: 1px solid rgba(255,255,255,0.22); margin-bottom: 28px; }
  .cover-conclusion { font-size: 14px; font-weight: 700; line-height: 1.65; margin-bottom: 36px; }
  .info-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .info-card  { background: rgba(255,255,255,0.13); border-radius: 10px; padding: 16px; }
  .info-label { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; opacity: 0.6; margin-bottom: 6px; text-transform: uppercase; }
  .info-value { font-size: 13px; line-height: 1.55; }
  .cover-date { font-size: 10px; opacity: 0.38; margin-top: 32px; }

  /* ── 섹션 공통 ── */
  .section {
    padding: 48px;
    page-break-after: always;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .sec-label { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; color: #6D28D9; text-transform: uppercase; margin-bottom: 8px; }
  .sec-title { font-size: 30px; font-weight: 900; letter-spacing: -0.03em; margin-bottom: 14px; color: #09090B; }
  .sec-text  { font-size: 13px; color: #3F3F46; line-height: 1.75; word-break: keep-all; margin-bottom: 24px; flex: 1; }
  .sec-hr    { border: none; border-top: 1px solid #E4E4E7; margin-bottom: 24px; }

  /* ── 이미지 레이아웃 ── */
  .img-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .img-center { max-width: 58%; margin: 0 auto; display: block; }
  .img-full   { width: 100%; border-radius: 8px; display: block; }

  /* ── 스펙 ── */
  .spec-grid  { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 18px; }
  .spec-card  { background: #F4F4F5; border-radius: 10px; padding: 16px; }
  .spec-label { font-size: 9px; font-weight: 700; color: #6D28D9; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px; }
  .spec-item  { font-size: 12px; color: #09090B; line-height: 1.9; font-weight: 600; }
  .highlight  { background: #EEE8FF; border-radius: 10px; padding: 18px; margin-bottom: 12px; }
  .hl-label   { font-size: 9px; font-weight: 700; color: #6D28D9; letter-spacing: 0.08em; margin-bottom: 6px; text-transform: uppercase; }
  .hl-text    { font-size: 14px; font-weight: 800; color: #09090B; line-height: 1.55; word-break: keep-all; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .highlight { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .info-card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- 커버 -->
<div class="cover">
  <div class="cover-logo">BRANDBOSS</div>
  <div class="cover-sub">AI BRAND DECISION SERVICE</div>
  <div class="cover-name">${bd.brandName || ''}</div>
  <div class="cover-tagline">${bd.tagline || ''}</div>
  <hr class="cover-hr"/>
  <div class="cover-conclusion">${bd.brandConclusion || bd.brandDefinition || ''}</div>
  <div class="info-grid">
    ${infoItems.map(i => `
    <div class="info-card">
      <div class="info-label">${i.label}</div>
      <div class="info-value">${i.value}</div>
    </div>`).join('')}
  </div>
  <div class="cover-date">생성일: ${new Date().toLocaleDateString('ko-KR')} · BrandBoss AI Brand Decision Service</div>
</div>

<!-- 공간 연출 -->
${bd.spaceDirection || spaceImgs.length ? `
<div class="section">
  <div class="sec-label">SPACE DIRECTION</div>
  <div class="sec-title">공간 연출</div>
  <hr class="sec-hr"/>
  <div class="sec-text">${bd.spaceDirection || ''}</div>
  ${spaceImgs.length ? `
  <div class="img-grid-3">
    ${spaceImgs.slice(0,3).map(url => `<div>${imgTag(url)}</div>`).join('')}
  </div>` : ''}
</div>` : ''}

<!-- 메뉴 플레이팅 -->
${bd.menuDirection || menuImgs.length ? `
<div class="section">
  <div class="sec-label">MENU DIRECTION</div>
  <div class="sec-title">메뉴 플레이팅</div>
  <hr class="sec-hr"/>
  <div class="sec-text">${bd.menuDirection || ''}</div>
  ${menuImgs[0] ? `<div class="img-center">${imgTag(menuImgs[0])}</div>` : ''}
</div>` : ''}

<!-- 소품 디테일 -->
${bd.propDirection || propImgs.length ? `
<div class="section">
  <div class="sec-label">PROP DIRECTION</div>
  <div class="sec-title">소품 디테일</div>
  <hr class="sec-hr"/>
  <div class="sec-text">${bd.propDirection || ''}</div>
  ${propImgs[0] ? `<div>${imgTag(propImgs[0])}</div>` : ''}
</div>` : ''}

<!-- 유니폼 외 -->
${bd.serviceDirection || serviceImgs.length ? `
<div class="section">
  <div class="sec-label">SERVICE DIRECTION</div>
  <div class="sec-title">유니폼 외</div>
  <hr class="sec-hr"/>
  <div class="sec-text">${bd.serviceDirection || ''}</div>
  ${serviceImgs[0] ? `<div>${imgTag(serviceImgs[0])}</div>` : ''}
</div>` : ''}

<!-- 브랜드 스펙 -->
${(pkg.materialKeywords?.length || pkg.furnitureKeywords?.length || pkg.mustHaveElements?.length || pkg.signatureSpot || pkg.narrative) ? `
<div class="section">
  <div class="sec-label">BRAND SPEC</div>
  <div class="sec-title">브랜드 스펙</div>
  <hr class="sec-hr"/>
  <div class="spec-grid">
    ${pkg.materialKeywords?.length ? `
    <div class="spec-card">
      <div class="spec-label">소재 키워드</div>
      ${pkg.materialKeywords.map(k => `<div class="spec-item">· ${k}</div>`).join('')}
    </div>` : ''}
    ${pkg.furnitureKeywords?.length ? `
    <div class="spec-card">
      <div class="spec-label">가구 키워드</div>
      ${pkg.furnitureKeywords.map(k => `<div class="spec-item">· ${k}</div>`).join('')}
    </div>` : ''}
    ${pkg.mustHaveElements?.length ? `
    <div class="spec-card">
      <div class="spec-label">반드시 있어야 할 것</div>
      ${pkg.mustHaveElements.map(k => `<div class="spec-item">· ${k}</div>`).join('')}
    </div>` : ''}
  </div>
  ${pkg.signatureSpot ? `
  <div class="highlight">
    <div class="hl-label">SIGNATURE SPOT</div>
    <div class="hl-text">${pkg.signatureSpot}</div>
  </div>` : ''}
  ${pkg.narrative ? `
  <div class="highlight">
    <div class="hl-label">NARRATIVE</div>
    <div class="hl-text">${pkg.narrative}</div>
  </div>` : ''}
</div>` : ''}

</body>
</html>`;

      // 새 창에서 열고 이미지 로딩 후 프린트
      const win = window.open('', '_blank', 'width=1000,height=800');
      win.document.write(html);
      win.document.close();

      // 이미지 로딩 대기
      win.onload = () => {
        const imgs = win.document.querySelectorAll('img');
        if (!imgs.length) {
          setTimeout(() => { win.focus(); win.print(); }, 300);
          return;
        }
        let loaded = 0;
        const tryPrint = () => { loaded++; if (loaded >= imgs.length) { setTimeout(() => { win.focus(); win.print(); }, 300); } };
        imgs.forEach(img => {
          if (img.complete) tryPrint();
          else { img.onload = tryPrint; img.onerror = tryPrint; }
        });
        // 최대 8초 후 강제 프린트
        setTimeout(() => { if (loaded < imgs.length) { win.focus(); win.print(); } }, 8000);
      };

    } catch (e) {
      alert(`PDF 생성 실패: ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  return { exportPdf, exporting };
}