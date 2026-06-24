// netlify/functions/bb-brandname.js
// 브랜드명만 재제안 — 기존 결과 기반으로 새로운 이름 3개 생성
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

async function callGemini(prompt, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
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
            temperature: 1.0,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini 오류');
    return data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '';
  } finally { clearTimeout(timeout); }
}

function buildNamePrompt(brandContext, existingName, userFeedback) {
  const { category, menu, target, district, region, storeConcept, overallMood, tagline } = brandContext;

  return `당신은 대한민국 최고의 외식업 브랜드 네이밍 전문가다.

현재 브랜드 정보:
- 업종/메뉴: ${category} / ${menu}
- 핵심 고객: ${target}
- 지역/상권: ${district} / ${region}
- 기존 이름: "${existingName}"
- 브랜드 컨셉: ${storeConcept}
- 분위기: ${overallMood}
- 태그라인: ${tagline}
${userFeedback ? `- 피드백: "${userFeedback}"` : ''}

⚠️ 기존 이름 "${existingName}"과 완전히 다른 방향으로 3개를 제안하라.

브랜드명 품질 기준 (모두 충족):
① 이름만 봐도 어떤 곳인지 반쯤 알 수 있어야 함
② 네이버/카카오맵에 이미 있을 법한 평범한 이름 금지
   금지: "[동네명]+[업종]", "더 키친", "더 테이블", "[숫자]+[업종]"
③ 추상적/감성적 단어만 쓰는 이름 절대 금지
   금지: "행복한 집", "맛있는 부엌", "좋은 식당"
④ 간판에 걸렸을 때 지나가던 사람이 한번 더 쳐다볼 이름
⑤ 이름에 스토리가 있어야 함 — 왜 이 이름인지 설명 가능해야 함
⑥ 2~5글자 또는 단어 2개 조합

좋은 예시:
• "한탄강 튀김살롱" — 장소+업종을 비틀어 고급스럽게
• "연탄骨 강남본점" — 소재+지역+한자로 독특함
• "골목 연구소" — 공간 성격이 이름에 녹아있음
• "서울 미트클럽" — 영문+한국 감성 조합

반드시 JSON 형식으로만 출력하라. 설명 텍스트 없이:
{
  "names": [
    {
      "name": "브랜드명 1",
      "reason": "이 이름을 선택한 이유 1문장",
      "tagline": "이 이름에 어울리는 태그라인"
    },
    {
      "name": "브랜드명 2",
      "reason": "이 이름을 선택한 이유 1문장",
      "tagline": "이 이름에 어울리는 태그라인"
    },
    {
      "name": "브랜드명 3",
      "reason": "이 이름을 선택한 이유 1문장",
      "tagline": "이 이름에 어울리는 태그라인"
    }
  ]
}`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST')    return jsonResponse(405, { error: 'POST만 허용됩니다.' });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error: '잘못된 JSON' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return jsonResponse(500, { error: 'GEMINI_API_KEY 없음' });

  const bd = payload.brandDecision || {};
  const brandContext = {
    category:     clean(payload.formData?.category)  || '',
    menu:         clean(payload.formData?.menu)       || '',
    target:       clean(bd.coreCustomers)             || '',
    district:     clean(payload.formData?.district)   || '',
    region:       clean(payload.formData?.region)     || '',
    storeConcept: clean(bd.storeConcept)              || '',
    overallMood:  clean(bd.overallMood)               || '',
    tagline:      clean(bd.tagline)                   || '',
  };

  const existingName = clean(bd.brandName) || '기존 이름';
  const userFeedback = clean(payload.feedback) || '';

  try {
    const prompt = buildNamePrompt(brandContext, existingName, userFeedback);
    const text   = await callGemini(prompt, apiKey);

    // JSON 파싱
    const stripped = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const start = stripped.indexOf('{');
      const end   = stripped.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        parsed = JSON.parse(stripped.slice(start, end + 1));
      } else {
        throw new Error('JSON 파싱 실패');
      }
    }

    return jsonResponse(200, { ok: true, names: parsed.names || [] });

  } catch (error) {
    return jsonResponse(200, { ok: false, error: error?.message || '브랜드명 생성 실패' });
  }
};
