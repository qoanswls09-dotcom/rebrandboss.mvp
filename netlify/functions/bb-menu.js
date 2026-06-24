// netlify/functions/bb-menu.js
// 브랜드 기반 메뉴판 HTML 생성 (Gemini) — 스타일 3종
// ESM: export const handler

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}
function safeParse(body) { try { return JSON.parse(body || '{}'); } catch { return null; } }
function clean(v) { return typeof v === 'string' ? v.trim() : ''; }

// 스타일별 디자인 시스템
function getStyleConfig(menuStyle, colorKeywords, overallMood) {
  const c1 = colorKeywords?.[0] || '#1a1a1a';
  const c2 = colorKeywords?.[1] || '#555555';
  const c3 = colorKeywords?.[2] || '#9333ea';

  const configs = {
    modern: {
      label: '모던 미니멀',
      bg: '#ffffff',
      textPrimary: '#111111',
      textSecondary: '#666666',
      accent: c3,
      border: '#e5e5e5',
      fontFamily: 'Arial, sans-serif',
      headerStyle: 'letter-spacing:0.15em; font-weight:300; font-size:28px;',
      sectionStyle: 'font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#999;',
      itemNameStyle: 'font-weight:400; font-size:15px;',
      priceStyle: 'font-family:Arial; font-weight:300;',
      divider: `<div style="height:1px; background:#e5e5e5; margin:20px 0;"></div>`,
      decorator: '',
    },
    vintage: {
      label: '빈티지 클래식',
      bg: '#fdf6e3',
      textPrimary: '#2c1a0e',
      textSecondary: '#6b4c2a',
      accent: '#8b4513',
      border: '#d4a96a',
      fontFamily: 'Georgia, serif',
      headerStyle: 'letter-spacing:0.05em; font-weight:400; font-size:30px; font-style:italic;',
      sectionStyle: 'font-size:12px; letter-spacing:0.1em; font-weight:400; font-style:italic;',
      itemNameStyle: 'font-weight:400; font-size:15px; font-family:Georgia,serif;',
      priceStyle: 'font-family:Georgia,serif; font-style:italic;',
      divider: `<div style="text-align:center; margin:18px 0; color:#d4a96a; font-size:18px;">— ✦ —</div>`,
      decorator: `<div style="border:1px solid #d4a96a; padding:3px; margin-bottom:24px;"><div style="border:1px solid #d4a96a; padding:20px 24px;">`,
      decoratorClose: `</div></div>`,
    },
    bold: {
      label: '볼드 그래픽',
      bg: '#1a1a2e',
      textPrimary: '#f0f0f0',
      textSecondary: '#aaaaaa',
      accent: c3 !== '#9333ea' ? c3 : '#e94560',
      border: '#333355',
      fontFamily: 'Arial, sans-serif',
      headerStyle: 'letter-spacing:-0.02em; font-weight:900; font-size:32px; text-transform:uppercase;',
      sectionStyle: 'font-size:10px; letter-spacing:0.25em; text-transform:uppercase; font-weight:700;',
      itemNameStyle: 'font-weight:700; font-size:15px;',
      priceStyle: 'font-family:Arial; font-weight:900;',
      divider: `<div style="height:2px; background:#333355; margin:20px 0;"></div>`,
      decorator: '',
    },
  };
  return configs[menuStyle] || configs.modern;
}

function buildMenuPrompt(params, menuStyle) {
  const { brandName, storeConcept, menuDirection, overallMood, colorKeywords,
          category, rawMenu, storeSize, materialKeywords, signatureSpot } = params;
  const style = getStyleConfig(menuStyle, colorKeywords, overallMood);

  return `당신은 전문 메뉴판 디자이너 겸 F&B 컨설턴트다.
아래 브랜드 인테리어 컨셉과 스타일 가이드에 맞는 메뉴판 HTML을 생성하라.

브랜드 정보:
- 브랜드명: ${brandName}
- 업종/대표메뉴: ${category} / ${rawMenu}
- 컨셉: ${storeConcept}
- 분위기: ${overallMood}
- 메뉴 방향: ${menuDirection}
- 매장 규모: ${storeSize}
- 인테리어 소재: ${materialKeywords?.join(', ') || ''}
- 시그니처 공간: ${signatureSpot || ''}

디자인 스타일: ${style.label}
- 배경색: ${style.bg}
- 주색상: ${style.textPrimary}
- 서브색상: ${style.textSecondary}
- 포인트색: ${style.accent}
- 폰트: ${style.fontFamily}

출력 규칙:
1. 순수 HTML만 출력. 마크다운/코드블록/설명 절대 금지.
2. <style> 포함한 완전한 HTML 프래그먼트 (html/head/body 태그 없이)
3. max-width: 640px, 인쇄 가능 레이아웃
4. 반드시 위 디자인 스타일 컬러/폰트/느낌을 충실히 반영
5. 실제 메뉴명, 1줄 설명, 현실적 가격 포함
6. 섹션 3~4개, 섹션당 메뉴 3~5개
7. 외부 폰트/이미지 참조 금지 — 웹 안전 폰트만
8. 하단 영업 안내 문구 포함
9. 브랜드 인테리어 소재/컬러에서 영감 받은 장식 요소 사용

지금 바로 HTML만 출력:`;
}

async function callGemini(prompt, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8000, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini 호출 오류');
    return data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '';
  } finally { clearTimeout(timeout); }
}

function extractHtml(text) {
  let html = String(text || '').replace(/```html/gi, '').replace(/```/g, '').trim();
  const start = html.search(/<(style|div|section|main)/i);
  if (start > 0) html = html.slice(start);
  return html;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST')    return jsonResponse(405, { error: 'POST만 허용됩니다.' });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error: '잘못된 JSON' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return jsonResponse(500, { error: 'GEMINI_API_KEY 없음' });

  const menuStyle = clean(payload.menuStyle) || 'modern';
  const params = {
    brandName:       clean(payload.brandName)    || '브랜드',
    storeConcept:    clean(payload.storeConcept) || '',
    menuDirection:   clean(payload.menuDirection)|| '',
    overallMood:     clean(payload.overallMood)  || '',
    category:        clean(payload.category)     || '',
    rawMenu:         clean(payload.rawMenu)      || '',
    storeSize:       clean(payload.storeSize)    || '',
    signatureSpot:   clean(payload.signatureSpot)|| '',
    colorKeywords:   Array.isArray(payload.colorKeywords)   ? payload.colorKeywords   : [],
    materialKeywords:Array.isArray(payload.materialKeywords)? payload.materialKeywords: [],
  };

  try {
    const prompt     = buildMenuPrompt(params, menuStyle);
    const geminiText = await callGemini(prompt, apiKey);
    const html       = extractHtml(geminiText);
    if (!html || html.length < 100) throw new Error('메뉴판 HTML 생성 실패');
    return jsonResponse(200, { ok: true, html, menuStyle });
  } catch (error) {
    return jsonResponse(200, { ok: false, error: error?.message || '메뉴판 생성 실패' });
  }
};
