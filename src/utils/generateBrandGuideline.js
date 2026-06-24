// src/utils/generateBrandGuideline.js
// 브랜드 가이드라인 HTML 생성 — 새 탭에서 열어 인쇄/PDF 저장

export function openBrandGuideline(resultData) {
  const bd  = resultData?.brandDecision        || {};
  const pkg = resultData?.interiorImagePackage || {};
  const fd  = resultData?.formData             || {};

  const brandName   = bd.brandName    || '브랜드명';
  const tagline     = bd.tagline      || '';
  const concept     = bd.storeConcept || '';
  const mood        = bd.overallMood  || '';
  const customers   = bd.coreCustomers|| '';
  const appeal      = bd.appealReason || '';
  const keyMsg      = bd.keyMessage   || '';
  const menuDir     = bd.menuDirection|| '';
  const spaceDir    = bd.spaceDirection|| '';
  const serviceDir  = bd.serviceDirection || '';
  const checklist   = bd.launchChecklist || [];

  const colors      = pkg.colorKeywords    || [];
  const materials   = pkg.materialKeywords || [];
  const furniture   = pkg.furnitureKeywords|| [];
  const mustHave    = pkg.mustHaveElements || [];
  const signatureSpot = pkg.signatureSpot  || '';
  const narrative   = pkg.narrative        || '';
  const lighting    = pkg.lightingDirection|| '';

  const category = fd.category || '';
  const district = fd.district || '';
  const storeSize= fd.storeSize|| '';

  const today = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' });

  // 컬러 스와치 HTML
  const colorSwatches = colors.map(c => {
    const hex = c.match(/#[0-9A-Fa-f]{3,6}/)?.[0] || '#888';
    const name = c.replace(/#[0-9A-Fa-f]{3,6}/, '').trim() || hex;
    return `
      <div class="color-chip">
        <div class="color-swatch" style="background:${hex}"></div>
        <div class="color-name">${name}</div>
        <div class="color-hex">${hex}</div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${brandName} — 브랜드 가이드라인</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Noto Sans KR', sans-serif; background:#fff; color:#111; font-size:13px; line-height:1.7; }

  .page { max-width:794px; margin:0 auto; padding:60px 60px 80px; }

  /* 표지 */
  .cover { min-height:260px; border-bottom:2px solid #111; padding-bottom:40px; margin-bottom:48px; }
  .cover-badge { font-size:10px; font-weight:500; letter-spacing:0.18em; color:#888; text-transform:uppercase; margin-bottom:24px; }
  .cover-name { font-size:52px; font-weight:700; letter-spacing:-0.03em; line-height:1.1; margin-bottom:12px; }
  .cover-tagline { font-size:16px; font-weight:300; color:#555; margin-bottom:32px; }
  .cover-meta { display:flex; gap:32px; font-size:11px; color:#888; }
  .cover-meta span { display:flex; flex-direction:column; gap:2px; }
  .cover-meta strong { color:#111; font-weight:500; font-size:12px; }

  /* 섹션 */
  .section { margin-bottom:48px; padding-bottom:48px; border-bottom:1px solid #e5e5e5; }
  .section:last-child { border-bottom:none; }
  .section-label { font-size:9px; font-weight:700; letter-spacing:0.2em; color:#888; text-transform:uppercase; margin-bottom:16px; }
  .section-title { font-size:20px; font-weight:700; letter-spacing:-0.02em; margin-bottom:20px; }

  /* 브랜드 핵심 */
  .brand-core { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .core-item { background:#f8f8f8; border-radius:8px; padding:20px; }
  .core-item-label { font-size:10px; font-weight:600; letter-spacing:0.1em; color:#888; text-transform:uppercase; margin-bottom:8px; }
  .core-item-value { font-size:13px; font-weight:400; color:#111; line-height:1.65; word-break:keep-all; }

  /* 컬러 팔레트 */
  .color-palette { display:flex; gap:16px; flex-wrap:wrap; }
  .color-chip { display:flex; flex-direction:column; align-items:center; gap:6px; }
  .color-swatch { width:64px; height:64px; border-radius:8px; border:1px solid rgba(0,0,0,0.08); }
  .color-name { font-size:11px; font-weight:500; color:#333; text-align:center; max-width:72px; }
  .color-hex { font-size:10px; color:#888; font-family:monospace; }

  /* 소재/가구 태그 */
  .tag-list { display:flex; flex-wrap:wrap; gap:8px; }
  .tag { padding:6px 14px; border:1px solid #ddd; border-radius:20px; font-size:12px; font-weight:400; color:#333; }

  /* 공간 방향 */
  .direction-block { background:#f8f8f8; border-radius:8px; padding:20px; margin-bottom:12px; }
  .direction-label { font-size:10px; font-weight:600; letter-spacing:0.1em; color:#888; text-transform:uppercase; margin-bottom:8px; }
  .direction-text { font-size:13px; color:#111; line-height:1.7; word-break:keep-all; }

  /* 시그니처 */
  .signature-box { border:2px solid #111; border-radius:8px; padding:24px; }
  .signature-text { font-size:16px; font-weight:700; line-height:1.5; word-break:keep-all; }

  /* 내러티브 */
  .narrative-box { background:#111; color:#fff; border-radius:8px; padding:28px; }
  .narrative-text { font-size:15px; font-weight:300; line-height:1.8; word-break:keep-all; letter-spacing:0.01em; }

  /* 체크리스트 */
  .checklist { display:flex; flex-direction:column; gap:12px; }
  .check-item { display:flex; gap:14px; align-items:flex-start; }
  .check-num { width:24px; height:24px; border-radius:50%; background:#111; color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; }
  .check-text { font-size:13px; color:#111; line-height:1.65; word-break:keep-all; }

  /* 푸터 */
  .footer { margin-top:48px; padding-top:24px; border-top:1px solid #e5e5e5; display:flex; justify-content:space-between; align-items:center; }
  .footer-brand { font-size:12px; font-weight:700; letter-spacing:-0.02em; }
  .footer-meta { font-size:11px; color:#888; }

  /* 인쇄 버튼 */
  .print-bar { position:fixed; top:0; left:0; right:0; background:#fff; border-bottom:1px solid #e5e5e5; padding:12px 24px; display:flex; justify-content:space-between; align-items:center; z-index:100; }
  .print-bar-title { font-size:13px; font-weight:600; color:#111; }
  .print-btns { display:flex; gap:10px; }
  .btn-print { padding:8px 20px; border:none; border-radius:6px; background:#111; color:#fff; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
  .btn-close { padding:8px 16px; border:1px solid #ddd; border-radius:6px; background:#fff; color:#555; font-size:13px; cursor:pointer; font-family:inherit; }

  @media print {
    .print-bar { display:none !important; }
    .page { padding:40px; }
    body { font-size:12px; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <span class="print-bar-title">${brandName} 브랜드 가이드라인</span>
  <div class="print-btns">
    <button class="btn-print" onclick="window.print()">🖨 인쇄 / PDF 저장</button>
    <button class="btn-close" onclick="window.close()">✕ 닫기</button>
  </div>
</div>

<div class="page" style="margin-top:52px;">

  <!-- 표지 -->
  <div class="cover">
    <div class="cover-badge">Brand Guidelines · BrandBoss</div>
    <div class="cover-name">${brandName}</div>
    ${tagline ? `<div class="cover-tagline">${tagline}</div>` : ''}
    <div class="cover-meta">
      ${category ? `<span><strong>업종</strong>${category}</span>` : ''}
      ${district  ? `<span><strong>지역</strong>${district}</span>`  : ''}
      ${storeSize ? `<span><strong>규모</strong>${storeSize}</span>` : ''}
      <span><strong>작성일</strong>${today}</span>
    </div>
  </div>

  <!-- 브랜드 핵심 -->
  ${(concept || customers || appeal || keyMsg) ? `
  <div class="section">
    <div class="section-label">01 · Brand Core</div>
    <div class="section-title">브랜드 핵심 정의</div>
    <div class="brand-core">
      ${concept   ? `<div class="core-item"><div class="core-item-label">매장 콘셉트</div><div class="core-item-value">${concept}</div></div>` : ''}
      ${customers ? `<div class="core-item"><div class="core-item-label">핵심 고객</div><div class="core-item-value">${customers}</div></div>` : ''}
      ${appeal    ? `<div class="core-item"><div class="core-item-label">어필 포인트</div><div class="core-item-value">${appeal}</div></div>` : ''}
      ${keyMsg    ? `<div class="core-item"><div class="core-item-label">핵심 메시지</div><div class="core-item-value">${keyMsg}</div></div>` : ''}
    </div>
  </div>` : ''}

  <!-- 컬러 팔레트 -->
  ${colors.length > 0 ? `
  <div class="section">
    <div class="section-label">02 · Color Palette</div>
    <div class="section-title">브랜드 컬러</div>
    <div class="color-palette">${colorSwatches}</div>
  </div>` : ''}

  <!-- 소재 & 가구 -->
  ${(materials.length > 0 || furniture.length > 0) ? `
  <div class="section">
    <div class="section-label">03 · Materials & Furniture</div>
    <div class="section-title">소재 & 가구 방향</div>
    ${materials.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div class="core-item-label" style="margin-bottom:10px;">소재 키워드</div>
      <div class="tag-list">${materials.map(m => `<span class="tag">${m}</span>`).join('')}</div>
    </div>` : ''}
    ${furniture.length > 0 ? `
    <div>
      <div class="core-item-label" style="margin-bottom:10px;">가구 키워드</div>
      <div class="tag-list">${furniture.map(f => `<span class="tag">${f}</span>`).join('')}</div>
    </div>` : ''}
  </div>` : ''}

  <!-- 공간 방향 -->
  ${(spaceDir || lighting || menuDir || serviceDir) ? `
  <div class="section">
    <div class="section-label">04 · Space & Service Direction</div>
    <div class="section-title">공간 & 서비스 방향</div>
    ${spaceDir   ? `<div class="direction-block"><div class="direction-label">공간 연출</div><div class="direction-text">${spaceDir}</div></div>` : ''}
    ${lighting   ? `<div class="direction-block"><div class="direction-label">조명 방향</div><div class="direction-text">${lighting}</div></div>` : ''}
    ${menuDir    ? `<div class="direction-block"><div class="direction-label">메뉴 방향</div><div class="direction-text">${menuDir}</div></div>` : ''}
    ${serviceDir ? `<div class="direction-block"><div class="direction-label">서비스 방향</div><div class="direction-text">${serviceDir}</div></div>` : ''}
  </div>` : ''}

  <!-- 반드시 있어야 할 것 -->
  ${mustHave.length > 0 ? `
  <div class="section">
    <div class="section-label">05 · Must-Have Elements</div>
    <div class="section-title">반드시 있어야 할 요소</div>
    <div class="tag-list">${mustHave.map(m => `<span class="tag">✦ ${m}</span>`).join('')}</div>
  </div>` : ''}

  <!-- 시그니처 스팟 -->
  ${signatureSpot ? `
  <div class="section">
    <div class="section-label">06 · Signature Spot</div>
    <div class="section-title">시그니처 공간</div>
    <div class="signature-box">
      <div class="signature-text">${signatureSpot}</div>
    </div>
  </div>` : ''}

  <!-- 내러티브 -->
  ${narrative ? `
  <div class="section">
    <div class="section-label">07 · Brand Narrative</div>
    <div class="section-title">브랜드 스토리</div>
    <div class="narrative-box">
      <div class="narrative-text">"${narrative}"</div>
    </div>
  </div>` : ''}

  <!-- 오픈 체크리스트 -->
  ${checklist.length > 0 ? `
  <div class="section">
    <div class="section-label">08 · Launch Checklist</div>
    <div class="section-title">오픈 전 체크리스트</div>
    <div class="checklist">
      ${checklist.map((item, i) => `
      <div class="check-item">
        <div class="check-num">${i+1}</div>
        <div class="check-text">${item}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- 푸터 -->
  <div class="footer">
    <div class="footer-brand">✦ BrandBoss</div>
    <div class="footer-meta">Generated ${today} · brandboss.kr</div>
  </div>

</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('팝업이 차단되었습니다. 팝업을 허용해주세요.'); return; }
  win.document.write(html);
  win.document.close();
}
