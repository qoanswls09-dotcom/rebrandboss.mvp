// src/lib/api.js
// Netlify Functions 호출용 공통 fetch — Supabase 액세스 토큰을 자동으로 실어 보낸다.
//
// ★ 보안 (C-3, 2026-08-24): AI 함수들(generate-interior / flux-poll / gemini-brandboss /
//   gemini-brandboss-franchise / bb-menu / bb-logo / bb-brandname / kakao-brand-search)이
//   이제 로그인을 요구한다. 기존 fetch 호출은 Authorization 헤더를 보내지 않았으므로
//   전부 이 헬퍼로 바꿔야 한다.
//
// 사용법은 fetch와 동일하다 — 두 번째 인자를 그대로 넘기면 Authorization만 얹어준다.
//   const res = await authedFetch('/.netlify/functions/bb-menu', {
//     method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
//   });

import { supabase } from './supabase';

export async function getAccessToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  } catch {
    return '';
  }
}

export async function authedFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { ...options, headers });
}

// 크레딧 부족 응답 판별 — 서버는 402 + { ok:false, error, creditRequired, remain } 을 준다.
export function isCreditError(res, data) {
  return res?.status === 402 || !!data?.creditRequired;
}

// 로그인 만료 판별
export function isAuthError(res) {
  return res?.status === 401;
}
