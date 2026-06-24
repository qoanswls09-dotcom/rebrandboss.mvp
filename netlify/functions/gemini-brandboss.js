// netlify/functions/gemini-brandboss.js
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
function cleanArray(v) { return Array.isArray(v) ? v.map(clean).filter(Boolean) : []; }
function getCategory(p) { return clean(p.categoryResolved || p.category); }
function getTarget(p) { return clean(p.target || p.targetAudience); }

// ── 평수 → 규모 설명 ─────────────────────────────────────
function storeSizeDesc(storeSize) {
  const s = clean(storeSize);
  const match = s.match(/(\d+)/);
  if (!match) return s;
  const pyeong = parseInt(match[1]);
  const sqm = Math.round(pyeong * 3.3);
  if (pyeong <= 10) return `${s} (약 ${sqm}㎡, 테이블 4~6개 수준의 소형)`;
  if (pyeong <= 20) return `${s} (약 ${sqm}㎡, 테이블 8~12개 수준의 소형)`;
  if (pyeong <= 30) return `${s} (약 ${sqm}㎡, 테이블 12~18개 수준의 중형)`;
  if (pyeong <= 50) return `${s} (약 ${sqm}㎡, 테이블 18~30개 수준의 중형)`;
  if (pyeong <= 80) return `${s} (약 ${sqm}㎡, 테이블 30~50개 수준의 대형)`;
  return `${s} (약 ${sqm}㎡, 50테이블 이상 대형)`;
}

// ── 상권 컨텍스트 분석 ────────────────────────────────────
function analyzeRegionContext(region, district, regionDetail) {
  const r = clean(region);
  const d = clean(district);
  const rd = clean(regionDetail);
  const contexts = [];

  if (r.includes('주거')) contexts.push('주거상권 특성: 반경 1km 내 단골 의존도 높음, 저녁/주말 수요 집중, 가족/커플 비중 높음');
  if (r.includes('오피스')) contexts.push('오피스상권 특성: 점심 피크 집중, 평일 저녁 회식 수요, 혼밥/빠른 식사 수요 있음');
  if (r.includes('학교') || r.includes('학원')) contexts.push('학교/학원가: 가성비 민감, 10~20대 비중, 포장/배달 수요 높음');
  if (r.includes('관광')) contexts.push('관광지: 재방문율 낮음, 첫인상/인스타그래머블 요소 중요, 외지인 비중 높음');
  if (r.includes('한강') || r.includes('나들이')) contexts.push('한강/나들이: 계절성 강함, 가족/커플, 야외 연계 경험 중요');
  if (d) contexts.push(`지역: ${d}`);
  if (rd) contexts.push(`상권 상세: ${rd}`);
  return contexts.join('\n  ');
}

// ── 업종별 고정관념 DB ────────────────────────────────────
function getCategoryStereotype(category, menu) {
  const c = (category + menu).toLowerCase();
  if (c.match(/치킨/)) return '치킨집 = 배달 위주, 밝은 형광등, 플라스틱 테이블, 체류 이유 없음';
  if (c.match(/장어/)) return '장어집 = 아저씨 보양식, 올드한 인테리어, 여름 한정 방문, 젊은 층 기피';
  if (c.match(/고기|갈비|삼겹/)) return '고깃집 = 연기 냄새, 비슷비슷한 인테리어, 회식 장소 이미지';
  if (c.match(/카페/)) return '카페 = 스타벅스/이디야 같은 프랜차이즈 느낌, 차별화 없음, 잠깐 앉다 가는 곳';
  if (c.match(/디저트|빙수|케이크/)) return '디저트 카페 = 인스타용 사진 찍고 바로 나가는 곳, 체류 가치 낮음';
  if (c.match(/한식|백반|정식/)) return '한식집 = 어머니 밥상 이미지, 올드, 젊은 층 관심 없음';
  if (c.match(/분식|떡볶이|김밥/)) return '분식집 = 허름하고 싸구려, 제대로 된 식사가 아님';
  if (c.match(/주점|이자카야|술/)) return '주점 = 아저씨 회식 장소, 또는 대학가 저가 술집';
  if (c.match(/파스타|이탈/)) return '이탈리안 = 비싸고 격식 있거나, 아니면 프랜차이즈 이탈리안';
  if (c.match(/초밥|일식/)) return '일식집 = 비쌈 또는 가성비 컨베이어벨트';
  return `${category} = 이 업종의 일반적인 고정관념과 진부한 이미지`;
}

// ── 메인 프롬프트 빌더 ────────────────────────────────────
function buildPrompt(payload) {
  const category     = getCategory(payload);
  const menu         = clean(payload.menu);
  const target       = getTarget(payload);
  const targetNote   = clean(payload.targetNote);
  const region       = clean(payload.region);
  const district     = clean(payload.district);
  const regionDetail = clean(payload.regionDetail);
  const storeSize    = storeSizeDesc(clean(payload.storeSize));
  const ownerStyle   = clean(payload.ownerStyle);
  const moodTone     = clean(payload.moodTone);
  const familiarHint = clean(payload.familiarHint);
  const breakHint    = clean(payload.breakHint);
  const experienceHint = clean(payload.experienceHint);
  const extraNote    = clean(payload.extraNote);
  const referenceStyle = clean(payload.referenceStyle);
  const refineType   = clean(payload.refineType) || 'default';
  const prevBrand    = clean(payload.previousResult?.brandDecision?.brandName);
  const prevConcept  = clean(payload.previousResult?.brandDecision?.storeConcept);

  const stereotype   = getCategoryStereotype(category, menu);
  const regionCtx    = analyzeRegionContext(region, district, regionDetail);

  const refineInstruction = refineType === 'regenerate' && prevBrand
    ? `\n⚠️ 재제안 요청: 이전 결과(${prevBrand} / ${prevConcept})와 완전히 다른 방향으로 제안하라. 브랜드명, 콘셉트, 인테리어 방향 모두 달라야 한다.\n`
    : '';

  const referenceInstruction = referenceStyle
    ? `\n레퍼런스 스타일: "${referenceStyle}" — 이 레퍼런스의 시각적 요소와 분위기를 interiorImagePackage에 구체적으로 반영하라. materialKeywords, colorKeywords, mustHaveElements에 이 레퍼런스의 핵심 인테리어 요소를 명시하라.\n`
    : '';

  return `당신은 대한민국 최고 수준의 외식업 브랜드 전략가다.
단순한 아이디어 나열이 아니라, 실제 창업자가 오픈 당일 실행할 수 있는 수준의 구체적 브랜드 결정안을 내놓는다.
${refineInstruction}${referenceInstruction}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 핵심 철학: 익숙함 70% + 새로움 30%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

이 브랜드는 반드시 이 공식으로 설계되어야 한다:

[익숙함 70%] — 이 업종/메뉴의 검증된 핵심 매력. 고객이 "맞아, 이게 진짜지"라고 느끼는 요소.
절대 버리면 안 된다. 너무 새로우면 고객이 낯설어서 안 온다.

[새로움 30%] — 이 업종의 고정관념을 뒤집는 단 1가지 뾰족한 차별점.
"왜 이제야 이런 곳이 나왔지?"를 느끼게 해야 한다.

실제 성공 예시:
• 장어집: 익숙함(장어구이, 보양식 정서) + 새로움(아이 모래놀이터+무인카페, 3대가 함께 오는 구조) → "장어집=아저씨 식당" 고정관념 파괴
• 연탄구이: 익숙함(불향, 노포 정서) + 새로움(강남 대형 유리 안에 연탄 진열, 내부는 쾌적 무취) → "연탄=불편하고 낡은" 고정관념 파괴
• 치킨집: 익숙함(프라이드 치킨, 동네 친근함) + 새로움(하이볼 바 + 레트로 라운지) → "치킨=배달용" 고정관념 파괴

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. 입력 정보 (이것을 기반으로 판단하라)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

업종/메뉴: ${category} / ${menu}
핵심 고객: ${target}${targetNote ? ` (${targetNote})` : ''}
지역/상권: ${district} / ${region}${regionCtx ? `\n  → ${regionCtx}` : ''}
매장 규모: ${storeSize}
운영자 스타일: ${ownerStyle}
원하는 무드/분위기: ${moodTone}
익숙하게 가져갈 요소: ${familiarHint || '(미입력)'}
깨고 싶은 고정관념: ${breakHint || '(미입력)'}
넣고 싶은 새로운 경험: ${experienceHint || '(미입력)'}
추가 메모: ${extraNote || '(미입력)'}
이 업종의 일반적 고정관념: ${stereotype}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. 판단 순서 (이 순서로 사고하고 JSON으로만 출력)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[STEP 1] 이 업종의 진짜 문제를 진단하라
- 고객이 이 업종에서 무의식적으로 감수하는 불편함은?
- "어차피 ~하겠지"라는 고정관념은?
- breakHint 입력이 있으면 그것을 중심으로 진단하라

[STEP 2] 지킬 것(익숙함)을 확정하라
- familiarHint 입력 반영
- 이 업종의 핵심 매력 중 절대 포기하면 안 되는 것 1~2가지
- 구체적 언어로 표현하라 (추상적 금지)

[STEP 3] 뒤집을 것(새로움)을 1가지로 압축하라
- breakHint + experienceHint 기반
- "이 업종에서 이걸 하는 곳은 없었다" 1가지
- 단 이것이 너무 생소하면 안 됨. "왜 이제야"가 포인트
- 공간/경험/메뉴/고객 구성 중 어느 것에서든 나올 수 있음

[STEP 4] 브랜드명을 역산하라
- STEP 2+3의 조합에서 브랜드명이 나와야 함
- 브랜드명 규칙:
  ① 한국어 또는 영문 혼용 가능
  ② 이 업종+지역+새로움의 조합이 느껴져야 함
  ③ 추상적/감성적 단어만 쓰는 이름 금지 (예: "행복한 집", "맛있는 부엌" 금지)
  ④ 이름만 봐도 어떤 곳인지 반쯤 알 수 있어야 함

[STEP 5] interiorImagePackage를 채워라 — 이것이 이미지 생성에 직결된다
- materialKeywords: 실제 사용할 마감재 (예: "다크 월넛 원목", "브러시드 골드 메탈", "테라코타 타일")
- colorKeywords: 정확한 색상 (예: "딥 버건디 #722F37", "웜 앰버 #FFBF69", "차콜 그레이 #36454F")
- mustHaveElements: 이 브랜드에서 반드시 보여야 할 3가지 장면
- signatureSpot: 가장 기억에 남아야 할 1개의 장소/장면
- narrative: 이 공간의 스토리를 한 문장으로
- referenceStyle이 있으면 그 레퍼런스의 핵심 시각 요소를 재료/색상/가구에 명시하라

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. 출력 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 순수 JSON만 출력. 마크다운, 코드블록, 설명 텍스트 절대 금지
- 모든 텍스트 필드는 한국어로, 구체적이고 실행 가능하게
- brandConclusion: 익숙함과 새로움의 조합이 왜 이 상권에 맞는지 2문장 이내로
- brandDefinition: 이 브랜드가 무엇을 지키고 무엇을 뒤집는지 명확히
- appealReason: 고객의 고정관념을 어떻게 뒤집었는지 구체적으로
- launchChecklist: 오픈 전 반드시 할 3가지, 뾰족하고 측정 가능하게
- spaceDirection: "~한 공간을 연출한다" 수준이 아니라 실제 인테리어 요소 명시
- 평수에 맞는 현실적 테이블 수와 동선 언급

{
  "brandDecision": {
    "brandConclusion": "",
    "brandDefinition": "",
    "brandName": "",
    "tagline": "",
    "storeConcept": "",
    "overallMood": "",
    "coreCustomers": "",
    "appealReason": "",
    "keyMessage": "",
    "menuDirection": "",
    "spaceDirection": "",
    "propDirection": "",
    "serviceDirection": "",
    "launchChecklist": ["", "", ""]
  },
  "interiorImagePackage": {
    "selectedBrandName": "",
    "selectedConcept": "",
    "spaceConceptSummary": "",
    "narrative": "",
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

// ── Gemini 호출 ───────────────────────────────────────────
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_APIKEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  // ★ thinkingBudget: 0 유지 (타임아웃 방지) — 대신 프롬프트 품질로 보완
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
  const bd  = parsed.brandDecision        || {};
  const pkg = parsed.interiorImagePackage || {};
  const category = getCategory(payload);
  const menu     = clean(payload.menu);
  const target   = getTarget(payload);

  return {
    brandDecision: {
      brandConclusion:  norm(bd.brandConclusion,  `이 브랜드는 ${category}의 익숙함을 살리면서 새로운 경험을 더한 방향으로 가야 한다.`),
      brandDefinition:  norm(bd.brandDefinition,  `${menu}의 핵심 매력을 지키되, 기존 고정관념을 뒤집어 ${target}에게 새로운 방문 이유를 만드는 브랜드.`),
      brandName:        norm(bd.brandName,        `${clean(payload.district)} ${category} 하우스`),
      tagline:          norm(bd.tagline,          `익숙함과 새로움이 만나는 곳`),
      storeConcept:     norm(bd.storeConcept,     `${category} 기반 브랜드`),
      overallMood:      norm(bd.overallMood,      clean(payload.moodTone)),
      coreCustomers:    norm(bd.coreCustomers,    target),
      appealReason:     norm(bd.appealReason,     `기존 ${category}의 고정관념을 뒤집어 새로운 방문 이유를 만든다.`),
      keyMessage:       norm(bd.keyMessage,       `${menu}를 가장 새롭게 경험하는 방법.`),
      menuDirection:    norm(bd.menuDirection,    `${menu} 중심 구성`),
      spaceDirection:   norm(bd.spaceDirection,   `${clean(payload.moodTone)} 무드의 공간`),
      propDirection:    norm(bd.propDirection,    `브랜드 세계관을 강화하는 소품 구성`),
      serviceDirection: norm(bd.serviceDirection, `${target}이 편하게 느끼는 응대 톤`),
      launchChecklist:  normArr(bd.launchChecklist, ['브랜드명과 콘셉트 확정', '대표 메뉴 구성 완성', '공간 시그니처 포인트 설계']),
    },
    interiorImagePackage: {
      selectedBrandName:   norm(pkg.selectedBrandName,   bd.brandName || '브랜드'),
      selectedConcept:     norm(pkg.selectedConcept,     bd.storeConcept || category),
      spaceConceptSummary: norm(pkg.spaceConceptSummary, bd.spaceDirection || ''),
      narrative:           norm(pkg.narrative,           bd.tagline || ''),
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
    categoryResolved: clean(payload.categoryResolved || payload.category),
    menu:             clean(payload.menu),
    target:           clean(payload.target || payload.targetAudience),
    targetAudience:   clean(payload.targetAudience || payload.target),
    targetNote:       clean(payload.targetNote),
    region:           clean(payload.region),
    district:         clean(payload.district || payload.regionDetail || payload.region),
    regionDetail:     clean(payload.regionDetail),
    storeSize:        clean(payload.storeSize),
    ownerStyle:       clean(payload.ownerStyle),
    moodTone:         clean(payload.moodTone),
    familiarHint:     clean(payload.familiarHint),
    breakHint:        clean(payload.breakHint),
    experienceHint:   clean(payload.experienceHint),
    extraNote:        clean(payload.extraNote),
    referenceStyle:   clean(payload.referenceStyle),
    refineType:       clean(payload.refineType || 'default'),
  };

  // 필수 필드 검증
  const missing = ['categoryResolved', 'menu', 'target', 'district', 'storeSize'].filter(k => !p[k]);
  if (missing.length) return jsonResponse(400, { error: `필수 입력값 누락: ${missing.join(', ')}` });

  try {
    const prompt     = buildPrompt(p);
    const geminiText = await callGemini(prompt);

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