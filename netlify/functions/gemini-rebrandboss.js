// netlify/functions/gemini-rebrandboss.js

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
function cleanArray(v) { return Array.isArray(v) ? v.map(clean).filter(Boolean) : []; }
function getCategory(p) { return clean(p.categoryResolved || p.category); }
function getTarget(p) { return clean(p.target || p.targetAudience); }

// ── 예산 범위 설명 ────────────────────────────────────────
function budgetScopeDesc(budget, changeScope) {
  const scopeMap = {
    sign:    '간판만 교체 (로고·간판 중심 변경)',
    partial: '부분 리뉴얼 (메뉴판·소품·일부 인테리어)',
    full:    '전면 리모델링 (인테리어 전체 + 브랜드 교체)',
  };
  return `예산: ${budget} / 범위: ${scopeMap[changeScope] || changeScope}`;
}

// ── 예산별 실행 가능 범위 ─────────────────────────────────
function getBudgetScenarios(budget, changeScope) {
  const isSign    = changeScope === 'sign';
  const isPartial = changeScope === 'partial';
  const isFull    = changeScope === 'full';

  if (budget?.includes('500만원 미만')) {
    return {
      low:  '간판 교체 + 로고 제작 + 메뉴판 리뉴얼',
      mid:  '간판 + 메뉴판 + 조명 일부 교체 + SNS 홍보물',
      high: '위 항목 전체 + 유니폼 + 소품 스타일링',
    };
  }
  if (budget?.includes('500~1,000')) {
    return {
      low:  '간판 + 메뉴판 + 조명 교체 + 포인트 벽면 시공',
      mid:  '위 항목 + 일부 가구 교체 + 바닥 부분 시공',
      high: '위 항목 전체 + 외관 도색 + 스타일링 소품',
    };
  }
  if (budget?.includes('1,000~3,000')) {
    return {
      low:  '인테리어 부분 리뉴얼 (주방 제외) + 가구 교체 + 조명 전체',
      mid:  '위 항목 + 바닥 전체 + 외관 파사드 리뉴얼',
      high: '위 항목 전체 + 브랜드 아이덴티티 전면 교체',
    };
  }
  if (budget?.includes('3,000~5,000')) {
    return {
      low:  '인테리어 전면 리뉴얼 (주방 제외) + 브랜드 전체 교체',
      mid:  '위 항목 + 주방 일부 + 외관 전체 리뉴얼',
      high: '전면 리모델링 + 브랜드 런칭 마케팅',
    };
  }
  return {
    low:  '전면 리모델링 + 브랜드 전체 교체 + 주방 리뉴얼',
    mid:  '위 항목 + 외관 신축급 리뉴얼 + 마케팅 캠페인',
    high: '완전한 브랜드 재탄생 — 이름·공간·메뉴·서비스 전면 교체',
  };
}

// ── 업종별 고정관념 DB ────────────────────────────────────
function getCategoryStereotype(category, menu) {
  const c = (category + menu).toLowerCase();
  if (c.match(/치킨/)) return '치킨집 = 배달 위주, 밝은 형광등, 플라스틱 테이블, 체류 이유 없음';
  if (c.match(/장어/)) return '장어집 = 아저씨 보양식, 올드한 인테리어, 여름 한정 방문, 젊은 층 기피';
  if (c.match(/고기|갈비|삼겹/)) return '고깃집 = 연기 냄새, 비슷비슷한 인테리어, 회식 장소 이미지';
  if (c.match(/카페/)) return '카페 = 스타벅스/이디야 같은 프랜차이즈 느낌, 차별화 없음';
  if (c.match(/디저트|빙수|케이크/)) return '디저트 카페 = 인스타용 사진 찍고 바로 나가는 곳';
  if (c.match(/한식|백반|정식/)) return '한식집 = 어머니 밥상 이미지, 올드, 젊은 층 관심 없음';
  if (c.match(/분식|떡볶이|김밥/)) return '분식집 = 허름하고 싸구려, 제대로 된 식사가 아님';
  if (c.match(/주점|이자카야|술/)) return '주점 = 아저씨 회식 장소, 또는 대학가 저가 술집';
  return `${category} = 이 업종의 일반적인 고정관념과 진부한 이미지`;
}

// ── 메인 프롬프트 빌더 ────────────────────────────────────
function buildPrompt(payload) {
  const category       = getCategory(payload);
  const menu           = clean(payload.menu);
  const currentBrand   = clean(payload.currentBrandName);
  const operatingPeriod = clean(payload.operatingPeriod);
  const storeAddress   = clean(payload.storeAddress);
  const storeSize      = clean(payload.storeSize);
  const problems       = cleanArray(payload.problems).join(', ');
  const changeWish     = clean(payload.changeWish);
  const target         = getTarget(payload);
  const targetNote     = clean(payload.targetNote);
  const strength       = clean(payload.strength);
  const budget         = clean(payload.budget);
  const changeScope    = clean(payload.changeScope);
  const budgetNote     = clean(payload.budgetNote);
  const ownerStyle     = clean(payload.ownerStyle);
  const moodTone       = clean(payload.moodTone);
  const familiarHint   = clean(payload.familiarHint);
  const breakHint      = clean(payload.breakHint);
  const experienceHint = clean(payload.experienceHint);
  const extraNote      = clean(payload.extraNote);
  const referenceStyle = clean(payload.referenceStyle);
  const refineType     = clean(payload.refineType) || 'default';
  const prevBrand      = clean(payload.previousResult?.rebrandDecision?.newBrandName);

  const budgetDesc     = budgetScopeDesc(budget, changeScope);
  const scenarios      = getBudgetScenarios(budget, changeScope);
  const stereotype     = getCategoryStereotype(category, menu);

  const hasStorePhotos = Array.isArray(payload.storePhotos) && payload.storePhotos.length > 0;
  const hasMenuPhotos  = Array.isArray(payload.menuPhotos)  && payload.menuPhotos.length  > 0;

  const refineInstruction = refineType === 'regenerate' && prevBrand
    ? `\n⚠️ 재제안 요청: 이전 결과(${prevBrand})와 완전히 다른 방향으로 제안하라.\n`
    : '';

  const referenceInstruction = referenceStyle
    ? `\n레퍼런스 스타일: "${referenceStyle}" — 이 레퍼런스의 시각적 요소와 분위기를 인테리어 제안에 구체적으로 반영하라.\n`
    : '';

  const photoInstruction = hasStorePhotos
    ? `\n📸 매장 사진 ${payload.storePhotos.length}장이 첨부되어 있다. 사진을 분석해서:\n  - 현재 인테리어 상태 (노후도, 스타일, 문제점)\n  - 공간 구조와 활용 가능성\n  - 브랜드 이미지와 실제 공간의 괴리\n  를 photoAnalysis 필드에 구체적으로 기술하라.\n`
    : '';

  const menuPhotoInstruction = hasMenuPhotos
    ? `\n🍽️ 메뉴 사진 ${payload.menuPhotos.length}장이 첨부되어 있다. 사진을 분석해서:\n  - 현재 메뉴의 비주얼 수준\n  - 플레이팅/담음새 개선 방향\n  - 메뉴 리뉴얼 시 참고할 방향\n  를 menuPhotoAnalysis 필드에 기술하라.\n`
    : '';

  return `당신은 대한민국 최고 수준의 외식업 리브랜딩 전문가다.
운영 중인 매장을 분석해서 실제로 실행 가능한 리브랜딩 전략을 제안한다.
단순한 아이디어가 아닌, 오너가 다음 달부터 실행할 수 있는 수준의 구체적 결정안을 내놓는다.
${refineInstruction}${referenceInstruction}${photoInstruction}${menuPhotoInstruction}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 리브랜딩 철학: 강점 살리기 + 고정관념 깨기
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

이 매장은 이미 운영 중이다. 즉:
- 검증된 메뉴/맛이 있다 → 절대 버리지 않는다
- 기존 단골이 있다 → 그들을 잃지 않아야 한다
- 예산이 한정되어 있다 → 임팩트 있는 것부터 바꾼다

리브랜딩 성공 공식:
[지킬 것] 이 매장의 핵심 강점 (맛, 단골, 위치 등)
[바꿀 것] 고객이 안 오는 진짜 이유 1가지
[새로운 이유] "이 매장에 다시 가야 할" 새로운 이유 1가지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. 현재 매장 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

현재 브랜드명: ${currentBrand}
업종/대표메뉴: ${category} / ${menu}
운영 기간: ${operatingPeriod}
매장 주소: ${storeAddress}
매장 평수: ${storeSize || '미입력'}
현재 핵심 고객: ${target}${targetNote ? ` (${targetNote})` : ''}
현재 강점: ${strength || '(미입력)'}
현재 문제점: ${problems || '(미입력)'}
바꾸고 싶은 것: ${changeWish || '(미입력)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. 예산 및 변화 범위
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${budgetDesc}
예산 메모: ${budgetNote || '(미입력)'}

예산별 실행 가능 범위 (아래를 budgetScenarios에 반영):
- 최소 실행: ${scenarios.low}
- 권장 실행: ${scenarios.mid}
- 풀 실행: ${scenarios.high}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. 원하는 방향
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

운영자 스타일: ${ownerStyle}
원하는 무드: ${moodTone}
익숙하게 가져갈 것: ${familiarHint || '(미입력)'}
깨고 싶은 고정관념: ${breakHint || '(미입력)'}
넣고 싶은 새 경험: ${experienceHint || '(미입력)'}
추가 메모: ${extraNote || '(미입력)'}
이 업종의 고정관념: ${stereotype}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. 출력 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 순수 JSON만 출력. 마크다운, 코드블록, 설명 텍스트 절대 금지
- 모든 텍스트 필드는 한국어로, 구체적이고 실행 가능하게
- newBrandName: 현재 이름에서 발전시키거나 완전히 새로운 이름 제안
- budgetScenarios: 예산 범위 내에서 단계별로 실행 가능한 것 명시
- priorityActions: 가장 먼저 해야 할 것 3가지 (임팩트 대비 비용이 낮은 순)
- interiorImagePackage: 사진 기반 분석 결과를 반영한 인테리어 방향

{
  "photoAnalysis": {
    "currentState": "",
    "problems": [],
    "opportunities": [],
    "menuVisualAnalysis": ""
  },
  "rebrandDecision": {
    "diagnosis": "",
    "keepStrengths": [],
    "changePoints": [],
    "newBrandName": "",
    "tagline": "",
    "newConcept": "",
    "overallMood": "",
    "targetCustomers": "",
    "newVisitReason": "",
    "menuDirection": "",
    "serviceDirection": "",
    "priorityActions": ["", "", ""],
    "budgetScenarios": {
      "minimum": "",
      "recommended": "",
      "full": ""
    },
    "brandGuideline": {
      "mainColor": "",
      "subColor": "",
      "fontDirection": "",
      "logoDirection": "",
      "signageDirection": ""
    },
    "launchChecklist": ["", "", "", "", ""]
  },
  "interiorImagePackage": {
    "selectedBrandName": "",
    "selectedConcept": "",
    "spaceConceptSummary": "",
    "narrative": "",
    "currentIssues": "",
    "improvementDirection": "",
    "targetAudience": "",
    "storeSize": "",
    "moodTone": "",
    "layoutDirection": "",
    "materialKeywords": ["", "", "", ""],
    "colorKeywords": ["", "", "", ""],
    "furnitureKeywords": ["", "", "", ""],
    "mustHaveElements": ["", "", ""],
    "shouldAvoidElements": ["", "", ""],
    "seatingDirection": "",
    "lightingDirection": "",
    "signatureSpot": "",
    "stylingNotes": "",
    "promptBundle": {
      "masterPrompt": "",
      "shortPrompt": "",
      "negativePrompt": ""
    }
  }
}`;
}

// ── JSON 추출 ─────────────────────────────────────────────
function extractJsonText(text) {
  const stripped = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch {
    const start = stripped.indexOf('{');
    const end   = stripped.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try { return JSON.parse(stripped.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

// ── Gemini 호출 (사진 포함) ───────────────────────────────
async function callGemini(prompt, storePhotos = [], menuPhotos = []) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  // 사진이 있으면 멀티모달로 전송
  const parts = [];

  // 매장 사진 추가
  if (storePhotos.length > 0) {
    parts.push({ text: `[매장 사진 ${storePhotos.length}장 첨부]` });
    storePhotos.slice(0, 5).forEach((base64, i) => { // 최대 5장만 전송 (토큰 절약)
      const data = base64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = base64.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
      parts.push({ inlineData: { mimeType, data } });
    });
  }

  // 메뉴 사진 추가
  if (menuPhotos.length > 0) {
    parts.push({ text: `[메뉴 사진 ${menuPhotos.length}장 첨부]` });
    menuPhotos.slice(0, 3).forEach((base64) => {
      const data = base64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = base64.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
      parts.push({ inlineData: { mimeType, data } });
    });
  }

  // 프롬프트 텍스트
  parts.push({ text: prompt });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.9,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini 호출 오류');
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '';
    if (!text.trim()) throw new Error('Gemini 응답이 비어 있습니다.');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

// ── 결과 정규화 ───────────────────────────────────────────
function norm(v, fallback) { return typeof v === 'string' && v.trim() ? v.trim() : (fallback || ''); }
function normArr(v, fallback) {
  if (Array.isArray(v) && v.length) return v.map(i => typeof i === 'string' ? i.trim() : '').filter(Boolean);
  return Array.isArray(fallback) ? fallback : [];
}

function normalizeResult(parsed, payload) {
  if (!parsed || typeof parsed !== 'object') return null;
  const pa  = parsed.photoAnalysis        || {};
  const rd  = parsed.rebrandDecision      || {};
  const pkg = parsed.interiorImagePackage || {};
  const category = getCategory(payload);
  const menu     = clean(payload.menu);
  const target   = getTarget(payload);

  return {
    photoAnalysis: {
      currentState:       norm(pa.currentState,       '매장 사진 분석 결과'),
      problems:           normArr(pa.problems,         ['사진 분석 필요']),
      opportunities:      normArr(pa.opportunities,    ['개선 가능성 있음']),
      menuVisualAnalysis: norm(pa.menuVisualAnalysis,  '메뉴 사진 분석 결과'),
    },
    rebrandDecision: {
      diagnosis:       norm(rd.diagnosis,       `${category} 매장의 현재 문제와 기회를 분석한 결과입니다.`),
      keepStrengths:   normArr(rd.keepStrengths, ['현재 메뉴의 핵심 매력', '기존 단골 고객']),
      changePoints:    normArr(rd.changePoints,  ['브랜드 이미지 노후화', '새로운 고객층 유입 필요']),
      newBrandName:    norm(rd.newBrandName,    `뉴 ${clean(payload.currentBrandName) || category}`),
      tagline:         norm(rd.tagline,         `새롭게 시작하는 ${category}`),
      newConcept:      norm(rd.newConcept,      `${category} 리브랜딩 컨셉`),
      overallMood:     norm(rd.overallMood,     clean(payload.moodTone)),
      targetCustomers: norm(rd.targetCustomers, target),
      newVisitReason:  norm(rd.newVisitReason,  '새로운 방문 이유'),
      menuDirection:   norm(rd.menuDirection,   `${menu} 중심 메뉴 리뉴얼`),
      serviceDirection:norm(rd.serviceDirection,'새로운 서비스 방향'),
      priorityActions: normArr(rd.priorityActions, ['간판/로고 교체', '메뉴판 리뉴얼', 'SNS 채널 개설']),
      budgetScenarios: {
        minimum:     norm(rd.budgetScenarios?.minimum,     '최소 비용으로 할 수 있는 것'),
        recommended: norm(rd.budgetScenarios?.recommended, '권장 실행 범위'),
        full:        norm(rd.budgetScenarios?.full,        '전면 리브랜딩 시 실행 범위'),
      },
      brandGuideline: {
        mainColor:       norm(rd.brandGuideline?.mainColor,       '메인 브랜드 컬러'),
        subColor:        norm(rd.brandGuideline?.subColor,        '보조 컬러'),
        fontDirection:   norm(rd.brandGuideline?.fontDirection,   '폰트 방향'),
        logoDirection:   norm(rd.brandGuideline?.logoDirection,   '로고 방향'),
        signageDirection:norm(rd.brandGuideline?.signageDirection,'간판 방향'),
      },
      launchChecklist: normArr(rd.launchChecklist, [
        '새 브랜드명·로고 확정', '메뉴판 리뉴얼', '간판 교체',
        'SNS 채널 개설 및 첫 포스팅', '단골 고객에게 변경 안내',
      ]),
    },
    interiorImagePackage: {
      selectedBrandName:   norm(pkg.selectedBrandName,   rd.newBrandName || '리브랜딩 매장'),
      selectedConcept:     norm(pkg.selectedConcept,     rd.newConcept   || category),
      spaceConceptSummary: norm(pkg.spaceConceptSummary, rd.newConcept   || ''),
      narrative:           norm(pkg.narrative,           rd.tagline      || ''),
      currentIssues:       norm(pkg.currentIssues,       '현재 인테리어 문제점'),
      improvementDirection:norm(pkg.improvementDirection,'개선 방향'),
      targetAudience:      norm(pkg.targetAudience,      target),
      storeSize:           norm(pkg.storeSize,           clean(payload.storeSize)),
      moodTone:            norm(pkg.moodTone,            clean(payload.moodTone)),
      layoutDirection:     norm(pkg.layoutDirection,     '입구-주문-체류 순서의 자연스러운 동선'),
      materialKeywords:    normArr(pkg.materialKeywords, ['우드', '메탈', '스톤']),
      colorKeywords:       normArr(pkg.colorKeywords,    ['웜 뉴트럴', '차콜', '포인트 컬러']),
      furnitureKeywords:   normArr(pkg.furnitureKeywords,['2~4인 테이블', '체어', '조명']),
      mustHaveElements:    normArr(pkg.mustHaveElements, ['시그니처 존', '조명 포인트', '브랜드 그래픽']),
      shouldAvoidElements: normArr(pkg.shouldAvoidElements, ['과한 장식', '기존 경쟁점과 유사한 분위기']),
      seatingDirection:    norm(pkg.seatingDirection,    '2인/4인 혼합 좌석'),
      lightingDirection:   norm(pkg.lightingDirection,   '간접조명 중심'),
      signatureSpot:       norm(pkg.signatureSpot,       '입구에서 보이는 메인 포인트'),
      stylingNotes:        norm(pkg.stylingNotes,        ''),
      promptBundle: {
        masterPrompt:   norm(pkg.promptBundle?.masterPrompt,   ''),
        shortPrompt:    norm(pkg.promptBundle?.shortPrompt,    ''),
        negativePrompt: norm(pkg.promptBundle?.negativePrompt, 'cartoon, illustration, watermark, text overlay, cheap, generic, distorted'),
      },
    },
  };
}

// ── handler ──────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST')    return jsonResponse(405, { error: 'POST 요청만 허용됩니다.' });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error: '잘못된 JSON 요청입니다.' });

  const p = {
    ...payload,
    categoryResolved:  clean(payload.categoryResolved || payload.category),
    menu:              clean(payload.menu),
    currentBrandName:  clean(payload.currentBrandName),
    operatingPeriod:   clean(payload.operatingPeriod),
    storeAddress:      clean(payload.storeAddress),
    storeSize:         clean(payload.storeSize),
    problems:          cleanArray(payload.problems),
    changeWish:        clean(payload.changeWish),
    target:            clean(payload.target || payload.targetAudience),
    targetAudience:    clean(payload.targetAudience || payload.target),
    targetNote:        clean(payload.targetNote),
    strength:          clean(payload.strength),
    budget:            clean(payload.budget),
    changeScope:       clean(payload.changeScope),
    budgetNote:        clean(payload.budgetNote),
    ownerStyle:        clean(payload.ownerStyle),
    moodTone:          clean(payload.moodTone),
    familiarHint:      clean(payload.familiarHint),
    breakHint:         clean(payload.breakHint),
    experienceHint:    clean(payload.experienceHint),
    extraNote:         clean(payload.extraNote),
    referenceStyle:    clean(payload.referenceStyle),
    refineType:        clean(payload.refineType || 'default'),
    storePhotos:       Array.isArray(payload.storePhotos) ? payload.storePhotos : [],
    menuPhotos:        Array.isArray(payload.menuPhotos)  ? payload.menuPhotos  : [],
  };

  // 필수 필드 검증
  const missing = ['categoryResolved', 'menu'].filter(k => !p[k]);
  if (missing.length) return jsonResponse(400, { error: `필수 입력값 누락: ${missing.join(', ')}` });

  try {
    const prompt     = buildPrompt(p);
    const geminiText = await callGemini(prompt, p.storePhotos, p.menuPhotos);

    if (!geminiText) {
      return jsonResponse(200, { ok: true, result: normalizeResult({}, p), warning: 'API 키가 없거나 Gemini를 사용할 수 없습니다.' });
    }

    const parsed = extractJsonText(geminiText);
    if (!parsed) {
      return jsonResponse(200, { ok: true, result: normalizeResult({}, p), warning: 'Gemini 응답 파싱 실패' });
    }

    const result = normalizeResult(parsed, p);
    return jsonResponse(200, { ok: true, result });

  } catch (error) {
    return jsonResponse(200, { ok: true, result: normalizeResult({}, p), warning: error?.message || 'Gemini 호출 실패' });
  }
};