// netlify/functions/bb-competition.js
// 경쟁 분석: 카카오 로컬 API + Gemini 분석

import fetch from 'node-fetch';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { district, category, brandName, storeConcept, brandConcept } = JSON.parse(event.body);

    if (!district || !category) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: '지역과 업종 정보가 필요합니다.' }),
      };
    }

    // ── STEP 1: 지역명으로 위경도 획득 ──────────────────────────────
    const geoRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(district)}&size=1`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }
    );
    const geoData = await geoRes.json();

    if (!geoData.documents || geoData.documents.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: '지역을 찾을 수 없습니다.' }),
      };
    }

    const { x: longitude, y: latitude, address_name: resolvedAddress } = geoData.documents[0];

    // ── STEP 2: 반경 500m 동일 업종 검색 ───────────────────────────
    const [res500, res1000] = await Promise.all([
      fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(category)}&x=${longitude}&y=${latitude}&radius=500&size=15`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }
      ),
      fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(category)}&x=${longitude}&y=${latitude}&radius=1000&size=15`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }
      ),
    ]);

    const data500 = await res500.json();
    const data1000 = await res1000.json();

    const competitors500 = data500.documents || [];
    const competitors1000 = data1000.documents || [];

    // 중복 제거 (500m 포함 업체는 1000m 목록에서 제외)
    const ids500 = new Set(competitors500.map((c) => c.id));
    const competitors500to1000 = competitors1000.filter((c) => !ids500.has(c.id));

    // 업체 요약 (Gemini에 전달할 텍스트)
    const formatCompetitors = (list) =>
      list.map((c) => `- ${c.place_name} (${c.category_name}) / ${c.road_address_name || c.address_name}`).join('\n');

    const competitorSummary500 = formatCompetitors(competitors500);
    const competitorSummary1000 = formatCompetitors(competitors500to1000);

    // ── STEP 3: Gemini 경쟁 분석 ────────────────────────────────────
    const prompt = `
당신은 외식업 상권 분석 전문가입니다. 아래 정보를 바탕으로 이 브랜드의 생존 가능성과 포지셔닝 전략을 분석해주세요.

## 브랜드 정보
- 브랜드명: ${brandName || '(미정)'}
- 업종: ${category}
- 지역: ${district} (${resolvedAddress})
- 매장 컨셉: ${storeConcept || '(없음)'}
- 브랜드 컨셉: ${brandConcept || '(없음)'}

## 반경 500m 이내 경쟁업체 (${competitors500.length}개)
${competitorSummary500 || '없음'}

## 반경 500m~1km 경쟁업체 (${competitors500to1000.length}개)
${competitorSummary1000 || '없음'}

## 분석 요청
아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "competitionLevel": "상" | "중" | "하",
  "competitionReason": "경쟁 강도 판단 이유 (2~3문장)",
  "totalCount": { "within500": ${competitors500.length}, "within1000": ${competitors1000.length} },
  "emptyPositions": [
    { "position": "비어있는 포지션명", "reason": "왜 비어있는지 / 기회 요인" },
    { "position": "...", "reason": "..." },
    { "position": "...", "reason": "..." }
  ],
  "differentiationScore": 1~10 사이 숫자,
  "differentiationComment": "이 브랜드가 이 상권에서 차별화될 수 있는 이유 (2~3문장)",
  "recommendedStrategy": "핵심 생존 전략 (3~4문장, 구체적으로)",
  "warningPoints": ["주의할 점 1", "주의할 점 2"],
  "survivabilityVerdict": "생존 가능" | "도전적" | "재고 권장"
}
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSON 파싱 (마크다운 코드블록 제거)
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      analysis = { raw: rawText };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        resolvedAddress,
        competitors: {
          within500: competitors500.map((c) => ({
            name: c.place_name,
            category: c.category_name,
            address: c.road_address_name || c.address_name,
            phone: c.phone,
            placeUrl: c.place_url,
          })),
          within1000: competitors500to1000.map((c) => ({
            name: c.place_name,
            category: c.category_name,
            address: c.road_address_name || c.address_name,
          })),
        },
        analysis,
      }),
    };
  } catch (err) {
    console.error('bb-competition error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
