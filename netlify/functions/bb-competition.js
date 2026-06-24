// netlify/functions/bb-competition.js
import fetch from 'node-fetch';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const GEMINI_API_KEY     = process.env.GEMINI_API_KEY;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode:405, body:'Method Not Allowed' };

  try {
    const { address, lat, lng, district, category, brandName, storeConcept, brandConcept } = JSON.parse(event.body);

    if (!category) return { statusCode:400, body: JSON.stringify({ error:'업종 정보가 필요합니다.' }) };

    let longitude, latitude, resolvedAddress;

    // ── STEP 1: 위경도 결정 ──────────────────────────────
    // 프론트에서 이미 위경도를 넘긴 경우 바로 사용
    if (lat && lng) {
      latitude  = lat;
      longitude = lng;
      resolvedAddress = address || district || '';
    } else {
      // 주소 텍스트로 카카오 검색
      const searchQuery = address || district || '';
      if (!searchQuery) return { statusCode:400, body: JSON.stringify({ error:'주소 또는 지역명이 필요합니다.' }) };

      const geoRes = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}&size=1`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }
      );
      const geoData = await geoRes.json();
      if (!geoData.documents?.length) return { statusCode:404, body: JSON.stringify({ error:'위치를 찾을 수 없습니다. 주소를 다시 확인해주세요.' }) };

      longitude       = geoData.documents[0].x;
      latitude        = geoData.documents[0].y;
      resolvedAddress = geoData.documents[0].address_name || searchQuery;
    }

    // ── STEP 2: 반경 경쟁업체 검색 ──────────────────────
    const [res500, res1000] = await Promise.all([
      fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(category)}&x=${longitude}&y=${latitude}&radius=500&size=15`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }),
      fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(category)}&x=${longitude}&y=${latitude}&radius=1000&size=15`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` } }),
    ]);

    const data500  = await res500.json();
    const data1000 = await res1000.json();

    const competitors500     = data500.documents  || [];
    const competitors1000    = data1000.documents || [];
    const ids500             = new Set(competitors500.map(c => c.id));
    const competitors500to1k = competitors1000.filter(c => !ids500.has(c.id));

    const fmt = list => list.map(c => `- ${c.place_name} (${c.category_name}) / ${c.road_address_name || c.address_name}`).join('\n');

    // ── STEP 3: Gemini 분석 ──────────────────────────────
    const prompt = `
당신은 외식업 상권 분석 전문가입니다. 아래 정보를 바탕으로 이 브랜드의 생존 가능성과 포지셔닝 전략을 분석하세요.

## 브랜드 정보
- 브랜드명: ${brandName || '(미정)'}
- 업종: ${category}
- 오픈 희망 주소: ${resolvedAddress}
- 매장 컨셉: ${storeConcept || '(없음)'}
- 브랜드 컨셉: ${brandConcept || '(없음)'}

## 반경 500m 이내 동일 업종 (${competitors500.length}개)
${fmt(competitors500) || '없음'}

## 반경 500m~1km 동일 업종 (${competitors500to1k.length}개)
${fmt(competitors500to1k) || '없음'}

아래 JSON 형식으로만 응답하세요. 다른 텍스트나 마크다운 없이 순수 JSON만:

{
  "competitionLevel": "상" 또는 "중" 또는 "하",
  "competitionReason": "경쟁 강도 판단 이유 2~3문장",
  "emptyPositions": [
    { "position": "비어있는 포지션명", "reason": "기회 요인" },
    { "position": "...", "reason": "..." },
    { "position": "...", "reason": "..." }
  ],
  "differentiationScore": 숫자 1~10,
  "differentiationComment": "차별화 가능성 설명 2~3문장",
  "recommendedStrategy": "핵심 생존 전략 3~4문장",
  "warningPoints": ["주의사항 1", "주의사항 2"],
  "survivabilityVerdict": "생존 가능" 또는 "도전적" 또는 "재고 권장"
}`;

    const gemRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }], generationConfig:{ temperature:0.7, maxOutputTokens:1500 } }) }
    );
    const gemData = await gemRes.json();
    const rawText = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = rawText.replace(/```json|```/g,'').trim();

    let analysis;
    try { analysis = JSON.parse(cleaned); }
    catch { analysis = { raw: rawText }; }

    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        success: true,
        resolvedAddress,
        competitors: {
          within500:  competitors500.map(c=>({ name:c.place_name, category:c.category_name, address:c.road_address_name||c.address_name, phone:c.phone })),
          within1000: competitors500to1k.map(c=>({ name:c.place_name, category:c.category_name, address:c.road_address_name||c.address_name })),
        },
        analysis,
      }),
    };
  } catch (err) {
    console.error('bb-competition error:', err);
    return { statusCode:500, body: JSON.stringify({ error: err.message }) };
  }
};
