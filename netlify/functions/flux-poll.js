// netlify/functions/flux-poll.js
// Flux 폴링 결과 확인 — 프론트에서 직접 호출
// 한 번 체크만 하고 즉시 반환 (타임아웃 없음)
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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST')    return jsonResponse(405, { error: 'POST만 허용됩니다.' });

  const payload = safeParse(event.body);
  if (!payload?.pollingUrl) return jsonResponse(400, { error: 'pollingUrl 없음' });

  const fluxApiKey = process.env.FLUX_API_KEY;
  if (!fluxApiKey) return jsonResponse(500, { error: 'FLUX_API_KEY 없음' });

  try {
    const res    = await fetch(payload.pollingUrl, {
      headers: { 'x-key': fluxApiKey },
    });
    const result = await res.json();

    if (result.status === 'Ready') {
      const imageUrl = result.result?.sample;
      if (!imageUrl) return jsonResponse(200, { status: 'Error', error: '이미지 URL 없음' });

      // 이미지 → base64 변환
      const imgRes = await fetch(imageUrl);
      const buffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      return jsonResponse(200, {
        status: 'Ready',
        imageUrl: `data:image/jpeg;base64,${base64}`,
      });
    }

    if (result.status === 'Error' || result.status === 'Failed') {
      return jsonResponse(200, { status: 'Error', error: JSON.stringify(result.error) || 'Flux 에러' });
    }

    // Pending / Processing
    return jsonResponse(200, { status: result.status || 'Pending' });

  } catch (error) {
    return jsonResponse(200, { status: 'Error', error: error?.message || '폴링 실패' });
  }
};
