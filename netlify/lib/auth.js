// netlify/lib/auth.js
// Supabase JWT 검증 — 유료 AI 함수 앞단 게이트.
//
// ★ 보안 (C-3): 기존에는 generate-interior / flux-poll / gemini-brandboss /
//   gemini-brandboss-franchise / bb-menu / bb-logo / bb-brandname / kakao-brand-search 가
//   Authorization 헤더를 아예 읽지 않았다. 로그인 없이 curl 한 줄로 FLUX/Gemini/Stability
//   비용을 무제한 태울 수 있었다. 이 파일이 그 구멍을 막는다.
//
// 기존 함수들(bb-save.js / bb-payment.js)이 쓰던 것과 동일한 방식:
//   GET {SUPABASE_URL}/auth/v1/user  +  Authorization: Bearer <user JWT>
// (@supabase/supabase-js를 추가로 번들하지 않기 위해 fetch를 직접 쓴다)

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// bb-credits.js / admin-stats.js / bb-franchise-*.js와 동일한 목록
export const ADMIN_EMAILS = ['qoanswls09@gmail.com', 'qoanswls81@gmail.com', 'qoanswls@naver.com'];

export function getBearerToken(event) {
  const h = event?.headers || {};
  const raw = h.authorization || h.Authorization || '';
  if (!raw.startsWith('Bearer ')) return '';
  return raw.slice(7).trim();
}

/**
 * 요청의 JWT를 검증한다.
 * @returns {{ ok: true, user: object, token: string, isAdmin: boolean }}
 *        | {{ ok: false, statusCode: number, error: string }}
 */
export async function requireUser(event) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[auth] SUPABASE_URL / SUPABASE_ANON_KEY 환경변수 없음');
    return { ok: false, statusCode: 500, error: '서버 인증 설정 오류입니다.' };
  }

  const token = getBearerToken(event);
  if (!token) return { ok: false, statusCode: 401, error: '로그인이 필요합니다.' };

  let data;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    data = await res.json().catch(() => null);
    if (!res.ok || !data?.id) {
      return { ok: false, statusCode: 401, error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
    }
  } catch (e) {
    console.error('[auth] 토큰 검증 실패:', e?.message);
    return { ok: false, statusCode: 401, error: '인증 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  return {
    ok: true,
    token,
    user: data,
    isAdmin: !!data.email && ADMIN_EMAILS.includes(data.email),
  };
}
