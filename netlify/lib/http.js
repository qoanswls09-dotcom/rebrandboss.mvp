// netlify/lib/http.js
// 모든 함수가 공유하는 CORS / 응답 헬퍼.
//
// ★ 보안 (C-3): 기존에는 모든 함수가 'Access-Control-Allow-Origin: *' 였다.
//   브라우저 기준으로는 아무 사이트나 우리 함수를 호출해 FLUX/Gemini 비용을 태울 수 있었다.
//   여기서는 허용 오리진 화이트리스트로 제한한다.
//
//   주의: CORS는 브라우저에서만 강제된다 (curl은 CORS를 무시한다).
//   실제 악용 차단은 auth.js의 JWT 검증이 담당하고, CORS는 그 위에 얹는 2차 방어선이다.

const STATIC_ALLOWED = [
  'https://brandboss.kr',
  'https://www.brandboss.kr',
  // 로컬 개발 (netlify dev = 8888, vite = 5173)
  'http://localhost:8888',
  'http://localhost:5173',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:5173',
];

// Netlify Deploy Preview / branch deploy:
//   https://deploy-preview-12--brandboss.netlify.app
//   https://fix-security-auth-credits--brandboss.netlify.app
// 사이트 이름을 환경변수로 못 박지 않고 *.netlify.app 서브도메인만 허용한다.
// (미리보기에서 실제 사용자 흐름을 그대로 테스트할 수 있어야 하므로 필수)
const NETLIFY_PREVIEW = /^https:\/\/[a-z0-9-]+\.netlify\.app$/i;

export function resolveOrigin(event) {
  const headers = event?.headers || {};
  const origin = headers.origin || headers.Origin || '';
  if (!origin) return '';                       // same-origin 요청 / 서버 호출 — Origin 헤더 자체가 없다
  if (STATIC_ALLOWED.includes(origin)) return origin;
  if (NETLIFY_PREVIEW.test(origin)) return origin;
  // 환경변수로 추가 오리진을 허용하고 싶을 때 (쉼표 구분)
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (extra.includes(origin)) return origin;
  return null;                                  // 명시적으로 거부된 오리진
}

export function corsHeaders(event) {
  const origin = resolveOrigin(event);
  const base = {
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
  // origin === ''  → same-origin. ACAO 헤더가 아예 필요 없다 (붙여도 무해하지만 생략).
  // origin === null → 허용되지 않은 오리진. ACAO를 주지 않으면 브라우저가 응답을 차단한다.
  if (origin) base['Access-Control-Allow-Origin'] = origin;
  return base;
}

export function json(event, statusCode, body) {
  return { statusCode, headers: corsHeaders(event), body: JSON.stringify(body) };
}

// OPTIONS 프리플라이트 처리. 허용되지 않은 오리진이면 403.
export function preflight(event) {
  if (resolveOrigin(event) === null) {
    return { statusCode: 403, headers: corsHeaders(event), body: JSON.stringify({ ok: false, error: 'Origin not allowed' }) };
  }
  return { statusCode: 200, headers: corsHeaders(event), body: JSON.stringify({ ok: true }) };
}

export function safeParse(body) {
  try { return JSON.parse(body || '{}'); } catch { return null; }
}
