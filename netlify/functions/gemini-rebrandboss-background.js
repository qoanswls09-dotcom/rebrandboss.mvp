import { requireUser } from '../lib/auth.js';
import { checkBalance, chargeBalance } from '../lib/imageJobs.js';
// netlify/functions/gemini-rebrandboss-background.js
//
// ★ 수정 (2026-08-09): 동기 함수 → Background Function 전환.
//   Netlify 무료(nf_team_dev) 플랜의 동기 함수는 CDN 레벨에서 30초에 강제로
//   끊긴다("Inactivity Timeout" 504). netlify.toml의 timeout=120은 플랜 상한
//   (최대 26초, 그마저도 별도 활성화 필요)을 넘는 값이라 적용 자체가 안 된다.
//   실측 결과 이 프롬프트의 Gemini 3.6-flash 응답은 사진 없이도 32~37초가
//   걸리므로 동기 방식으로는 구조적으로 불가능하다.
//   → 파일명에 -background 접미사를 붙여 최대 15분까지 실행하고,
//     결과는 Netlify Blobs에 저장한 뒤 프론트가 rebrand-poll로 가져간다.
//
//   응답 규약: 즉시 202(빈 본문). 결과는 Blobs의 rebrand-jobs 스토어에
//   jobId 키로 저장된다. (flux 이미지 생성의 pollingUrl 패턴과 동일한 UX)

import { getStore } from '@netlify/blobs';

const JOB_STORE = 'rebrand-jobs';

// 폴링이 쓰기 직후를 읽어야 하므로 strong consistency 필수.
// (기본 eventual은 최대 60초까지 전파가 지연돼 폴링이 헛돈다)
function jobStore() {
  return getStore({ name: JOB_STORE, consistency: 'strong' });
}

// ★ 수정 (2026-08-10): 사진은 요청 본문이 아니라 Blobs에서 읽는다.
//   백그라운드 함수의 payload 상한이 ~256KB라(동기 함수는 ~6MB) 사진을 본문에
//   실으면 413으로 접수 자체가 거부되기 때문. 프론트가 rebrand-upload로 먼저
//   한 장씩 올려두고, 여기서는 장수만 받아 꺼내 쓴다.
async function loadPhotos(store, jobId, kind, count) {
  const n = Number.isInteger(count) ? Math.max(0, Math.min(kind === 'menu' ? 5 : 10, count)) : 0;
  if (!n) return [];
  const keys = Array.from({ length: n }, (_, i) => `${jobId}/${kind}-${i}`);
  const photos = await Promise.all(keys.map(k => store.get(k).catch(() => null)));
  return photos.filter(v => typeof v === 'string' && v);
}

// 분석이 끝나면 사진 블롭은 지운다 (용량이 크고 재사용하지 않음)
async function deletePhotos(store, jobId, kind, count) {
  const n = Number.isInteger(count) ? Math.max(0, Math.min(kind === 'menu' ? 5 : 10, count)) : 0;
  if (!n) return;
  await Promise.all(
    Array.from({ length: n }, (_, i) => store.delete(`${jobId}/${kind}-${i}`).catch(() => {}))
  );
}

function clean(v) { return typeof v === 'string' ? v.trim() : ''; }
function cleanArray(v) { return Array.isArray(v) ? v.map(clean).filter(Boolean) : []; }
function getCategory(p) { return clean(p.categoryResolved || p.category); }
function getTarget(p) { return clean(p.target || p.targetAudience); }

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
  const ownerStyle     = clean(payload.ownerStyle);
  const moodTone       = clean(payload.moodTone);
  const familiarHint   = clean(payload.familiarHint);
  const breakHint      = clean(payload.breakHint);
  const experienceHint = clean(payload.experienceHint);
  const extraNote      = clean(payload.extraNote);
  const referenceStyle = clean(payload.referenceStyle);
  const refineType     = clean(payload.refineType) || 'default';
  const prevBrand      = clean(payload.previousResult?.rebrandDecision?.newBrandName);

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
${refineInstruction}${referenceInstruction}
[실행 품질 기준 — 기존 출력 형식 안에서 적용]
- 사용자의 금지 사항, 유지할 이름·시설·메뉴, 운영 인원, 매장 규모를 최우선 제약으로 삼는다. 차별화나 레퍼런스를 이유로 이를 어기지 않는다.
- 고객 수요·상권·매출·공사 가능 여부는 제공된 사실과 가설을 구분한다. 실제 조사 없이 검증된 성공 사례나 매출 상승 수치를 만들지 않는다.
- 입력에 없는 전통, 창업 연혁, 지역 식재료 산지, 특허, 수상 경력을 브랜드 스토리에 사실처럼 만들지 않는다.
- 포장 전용이면 좌석·체류 공간을 제안하지 않는다. 면적만으로 테이블 수를 확정하지 말고 주방·보관·통로를 고려한다. 인력 추가 금지이면 별도 직원이 필요한 서비스를 넣지 않는다.
- 차별점은 이 매장의 대표 메뉴·핵심 고객·운영 제약 중 최소 두 가지와 연결한다. 단순히 감성적, 프리미엄, SNS 명소라고 결론 내리지 않는다. 입력한 차별점이 현실적이면 억지로 다른 경험을 추가하지 않는다.
- 실행 항목은 무엇을 어느 위치에서 어떻게 바꿀지와 확인 방법을 쓴다. 확인 방법은 테스트 절차이며 이미 검증된 성과가 아니다.
- interiorImagePackage.selectedBrandName은 최종 결정 브랜드명과 동일해야 한다. 콘셉트·색상·재료·배치·메뉴는 설명과 이미지 지시에서 동일하게 유지한다. 이미지 지시에 금지 요소도 빠짐없이 전달한다.
- 홍보 문구에도 실측하지 않은 속도·성과를 약속하지 않는다. 특히 대기 0초, 3초 픽업, 대기 Zero, 기다림 없이, 매출 극대화, 1분당 2줄처럼 보장하는 표현은 쓰지 않는다. 대신 예약 시간대별 수령, 대기 혼잡 완화 목표, 시험 주문으로 처리량 확인처럼 실행 방식으로 쓴다. 임의의 처리 시간을 브랜드명에 넣지 않는다.
- 기존 냉장고·작업대·벽·주방 유지 조건을 설명뿐 아니라 이미지 layoutDirection, mustHaveElements 및 영문 지시에도 반영한다.
- 고객에게 내부 검토 과정은 출력하지 않는다. JSON을 반환하기 전에 제약 위반과 필드 간 모순을 수정하라. JSON 키나 데이터 타입은 바꾸지 않는다.
${photoInstruction}${menuPhotoInstruction}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 리브랜딩 철학: 강점 살리기 + 고정관념 깨기
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

이 매장은 이미 운영 중이다. 즉:
- 검증된 메뉴/맛이 있다 → 절대 버리지 않는다
- 기존 단골이 있다 → 그들을 잃지 않아야 한다
- 임팩트 있는 것부터 바꾼다

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
3. 원하는 방향
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

운영자 스타일: ${ownerStyle}
원하는 무드: ${moodTone}
익숙하게 가져갈 것: ${familiarHint || '(미입력)'}
깨고 싶은 고정관념: ${breakHint || '(미입력)'}
넣고 싶은 새 경험: ${experienceHint || '(미입력)'}
추가 메모: ${extraNote || '(미입력)'}
검증이 필요한 업종 가설 (입력과 사진을 우선할 것): ${stereotype}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. 출력 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- 순수 JSON만 출력. 마크다운, 코드블록, 설명 텍스트 절대 금지
- 모든 텍스트 필드는 한국어로, 구체적이고 실행 가능하게
- newBrandName: 이름 유지 요청이 있으면 현재 이름을 정확히 유지한다. 변경을 원하는 경우에만 새 이름을 제안한다.
- priorityActions: 가장 먼저 해야 할 것 3가지 (임팩트 대비 노력이 낮은 순, 예산 언급 없이 행동 자체로 기술)
- interiorImagePackage: 첨부 사진이 있으면 관찰 내용을 반영한다. 사진이 없으면 photoAnalysis의 문자열은 빈 문자열, 배열은 빈 배열로 두며 노후도·균열·실제 배치 등을 본 것처럼 쓰지 않는다. 메뉴 사진 분석은 photoAnalysis.menuVisualAnalysis에 쓴다.

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

  // ★ 백그라운드 함수는 최대 15분까지 살아 있으므로, 기존 55초 제한을 5분으로 넓힌다.
  //   (동기 함수 시절엔 어차피 플랫폼이 먼저 끊어서 의미 없던 값)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  const parts = [];

  if (storePhotos.length > 0) {
    parts.push({ text: `[매장 사진 ${storePhotos.length}장 첨부]` });
    storePhotos.slice(0, 10).forEach((base64) => {
      const data = base64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = base64.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
      parts.push({ inlineData: { mimeType, data } });
    });
  }

  if (menuPhotos.length > 0) {
    parts.push({ text: `[메뉴 사진 ${menuPhotos.length}장 첨부]` });
    menuPhotos.slice(0, 5).forEach((base64) => {
      const data = base64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = base64.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
      parts.push({ inlineData: { mimeType, data } });
    });
  }

  parts.push({ text: prompt });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.9,
            responseMimeType: 'application/json',
            maxOutputTokens: 16000,
            thinkingConfig: { thinkingLevel: 'minimal' },
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
  const hasStorePhotos = Array.isArray(payload.storePhotos) && payload.storePhotos.length > 0;
  const hasMenuPhotos = Array.isArray(payload.menuPhotos) && payload.menuPhotos.length > 0;
  const category = getCategory(payload);
  const menu     = clean(payload.menu);
  const target   = getTarget(payload);

  return {
    photoAnalysis: {
      currentState:       hasStorePhotos ? norm(pa.currentState, '') : '',
      problems:           hasStorePhotos ? normArr(pa.problems, []) : [],
      opportunities:      hasStorePhotos ? normArr(pa.opportunities, []) : [],
      menuVisualAnalysis: hasMenuPhotos ? norm(pa.menuVisualAnalysis, '') : '',
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
      selectedBrandName:   norm(rd.newBrandName,   pkg.selectedBrandName || '리브랜딩 매장'),
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

// ── handler (Background Function) ────────────────────────
// 반환값은 클라이언트에 전달되지 않는다(즉시 202). 모든 결과는 Blobs로 나간다.
export default async (req) => {
  const auth=await requireUser({headers:Object.fromEntries(req.headers)});
  if (!auth.ok) return;
  let payload = null;
  try { payload = await req.json(); } catch { /* 잘못된 JSON → payload는 null 유지 */ }

  const rawJobId = clean(payload?.jobId);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(rawJobId)) return;
  const jobId = `${auth.user.id}/${rawJobId}`;
  // jobId가 없으면 결과를 되돌려줄 방법이 없다 → 조용히 종료
  if (!jobId) return;

  const store = jobStore();
  // Blobs에서 실제로 읽어낸 사진 장수. 요청한 장수와 다르면 업로드가 유실된 것이므로
  // 모든 상태 기록에 함께 남긴다(진행 중이든 완료든 사후 확인 가능).
  let photoInfo = null;
  const writeJob = (data) => store.setJSON(jobId, {
    ...data,
    ...(photoInfo ? { photos: photoInfo } : {}),
    updatedAt: new Date().toISOString(),
  });

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
    ownerStyle:        clean(payload.ownerStyle),
    moodTone:          clean(payload.moodTone),
    familiarHint:      clean(payload.familiarHint),
    breakHint:         clean(payload.breakHint),
    experienceHint:    clean(payload.experienceHint),
    extraNote:         clean(payload.extraNote),
    referenceStyle:    clean(payload.referenceStyle),
    refineType:        clean(payload.refineType || 'default'),
    // 사진은 아래에서 Blobs로부터 채운다 (본문에 실려오지 않는다)
    storePhotos:       [],
    menuPhotos:        [],
  };

  const storeCount = payload.storePhotoCount;
  const menuCount  = payload.menuPhotoCount;

  try {
    const claim=await store.setJSON(jobId+'/claim',{started:Date.now()},{onlyIfNew:true});
    if (!claim.modified) { photoInfo={duplicate:true}; return; }
    await writeJob({ status: 'processing' });

    p.storePhotos = await loadPhotos(store, jobId, 'store', storeCount);
    p.menuPhotos  = await loadPhotos(store, jobId, 'menu',  menuCount);

    photoInfo = { store: p.storePhotos.length, menu: p.menuPhotos.length };
    const amount=10+Math.max(0,photoInfo.store-5)+Math.max(0,photoInfo.menu-3);
    await checkBalance(auth,amount);
    await writeJob({ status:'processing' });

    // 필수 필드 검증
    const missing = ['categoryResolved', 'menu'].filter(k => !p[k]);
    if (missing.length) {
      await writeJob({ status: 'done', ok: false, error: `필수 입력값 누락: ${missing.join(', ')}` });
      return;
    }

    const prompt     = buildPrompt(p);
    const geminiText = await callGemini(prompt, p.storePhotos, p.menuPhotos);

    // ★ 유지 (2026-07-27 결정): 실제 AI 분석이 아닌 경우 ok:false로 명확히 알려서,
    //   프론트가 "성공했을 때만" 크레딧을 차감하도록 한다.
    if (!geminiText) {
      await writeJob({ status: 'done', ok: false, error: 'API 키가 없거나 Gemini를 사용할 수 없습니다.', fallbackResult: normalizeResult({}, p) });
      return;
    }

    const parsed = extractJsonText(geminiText);
    if (!parsed) {
      await writeJob({ status: 'done', ok: false, error: 'AI 응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.', fallbackResult: normalizeResult({}, p) });
      return;
    }

    await writeJob({ status: 'done', ok: true, result: normalizeResult(parsed, p) });
    try { await chargeBalance(auth,amount); } catch { console.error('[brand-billing] reconciliation required',jobId); }

  } catch (error) {
    // ★ 반드시 정상 종료해야 한다. 예외를 던지면 Netlify가 1분/2분 뒤 자동 재시도하면서
    //   Gemini를 중복 호출한다(비용 + 결과 덮어쓰기).
    try {
      await writeJob({ status: 'done', ok: false, error: error?.message || 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', fallbackResult: normalizeResult({}, p) });
    } catch { /* Blobs 쓰기까지 실패하면 프론트가 폴링 타임아웃으로 처리한다 */ }
  } finally {
    // 성공/실패와 무관하게 사진 블롭은 정리한다 (용량이 크고 재사용하지 않음)
    if (photoInfo?.duplicate) return;
    await deletePhotos(store, jobId, 'store', storeCount);
    await deletePhotos(store, jobId, 'menu',  menuCount);
  }
};
