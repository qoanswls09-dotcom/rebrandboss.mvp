// netlify/lib/credits.js
// 서버 사이드 크레딧 잔액 확인 / 차감.
//
// ★ 보안 (C-3): 기존에는 크레딧 차감이 100% 프론트엔드에서만 일어났다.
//   React 컴포넌트가 bb-credits를 호출해 차감한 뒤 AI 함수를 불렀을 뿐,
//   AI 함수는 그 차감이 실제로 있었는지 확인하지 않았다.
//   → 프론트를 건너뛰고 함수를 직접 호출하면 크레딧 없이 무제한 생성이 가능했다.
//   이제 차감은 서버(이 파일)에서 일어나고, 프론트의 차감 호출은 제거되었다.
//
// ── 왜 "선차감 + 실패 시 환불"이 아니라 "사전 잔액확인 + 성공 후 차감"인가 ──
//   목표는 같다: "실패하면 크레딧이 나가지 않는다".
//   그런데 환불 방식은 add_credits_to_user / use_credits(음수) 같은 Supabase RPC의
//   동작에 의존하는데, 환불 호출이 실패하면 사용자는 결과도 못 받고 크레딧도 잃는다.
//   성공 후 차감은 그 실패 경로 자체가 존재하지 않는다 — 실패하면 애초에 차감을 안 한다.
//   (프론트가 브랜드 생성에서 이미 쓰던 검증된 패턴이며, 이제 서버로 옮긴 것이다)
//
//   순서: precheckCredits() → 실제 AI 작업 → 성공 시 chargeCredits()
//   AI가 실패하면 차감 코드에 도달하지 않는다.
//
// bb-credits.js와 동일한 RPC를 쓴다. COSTS는 여기가 단일 기준이며 bb-credits.js가 import한다.
// (프론트 src/hooks/useUsageLimit.js의 COSTS는 버튼 활성화 표시용 사본일 뿐 실제 차감 기준이 아니다.)

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const COSTS = {
  brand: 10, space: 30, image: 10, guideline: 100, regen: 10, brandname: 0,
  franchise_analysis: 10, franchise_upgrade: 100,
};

export const TYPE_LABELS = {
  brand: '브랜드 결정안 생성', space: '공간 이미지 생성', image: '이미지 생성',
  guideline: '가이드라인 자동생성', regen: '이미지 재생성/수정', brandname: '브랜드명 재제안',
  franchise_analysis: '프랜차이즈 브랜드 분석', franchise_upgrade: '프랜차이즈 일괄 업그레이드 제안',
};

export const INSUFFICIENT_MSG = '보유하신 크레딧을 다 소진했습니다. 플랜을 업그레이드 해주세요';

function normCount(count) {
  return Math.max(1, Math.min(20, Math.trunc(Number(count)) || 1));
}

export function costOf(type, count = 1) {
  return (COSTS[type] ?? 10) * normCount(count);
}

// PostgREST RPC 호출. token을 주면 그 사용자 권한으로, 안 주면 anon 권한으로 실행된다.
async function rpc(fnName, args, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(args || {}),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

// 거래 내역 기록 — 실패해도 차감 자체는 막지 않는다 (bb-credits.js와 동일 정책).
// RLS의 auth.uid()가 맞아야 하므로 반드시 사용자 토큰으로 insert한다.
//
// ★ 2026-08-25: 실패를 조용히 넘기지 않는다.
//   fetch는 401/403/42501 같은 HTTP 오류에 throw하지 않는다 — 응답이 왔으면 성공이다.
//   그래서 예전 코드의 try/catch는 네트워크 단절만 잡았고, 권한 거부로 내역이
//   통째로 유실되어도 catch에 걸리지 않아 아무 로그도 남지 않았다.
//   실제로 bb_credit_ledger는 권한 오류(42501)를 뱉는 상태였던 적이 있다.
//   이제 res.ok를 검사하고, 무엇이 유실됐는지 알 수 있게 사용자·금액과 함께 남긴다.
async function logLedger(token, userId, type, amount, description, balanceAfter) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bb_credit_ledger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId, type, amount,
        description: description || '',
        balance_after: typeof balanceAfter === 'number' ? balanceAfter : null,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('🚨 크레딧 내역 기록 실패 — 잔액은 변경됨, 내역만 누락 🚨', {
        userId, type, amount, description,
        status: res.status, detail: detail.slice(0, 200),
      });
    }
  } catch (e) {
    console.error('🚨 크레딧 내역 기록 실패 (네트워크) 🚨', {
      userId, type, amount, description, error: e?.message,
    });
  }
}

/**
 * 작업 시작 전 잔액 확인. 여기서 막으면 AI 비용 자체가 발생하지 않는다.
 * @returns {{ ok: true, cost: number, remain: number|null }}
 *        | {{ ok: false, statusCode: 402, error: string, cost: number, remain: number }}
 */
export async function precheckCredits({ user, isAdmin, type, count = 1 }) {
  const cost = costOf(type, count);
  if (isAdmin || cost === 0) return { ok: true, cost: 0, remain: null };

  const { ok, data } = await rpc('get_credits', { p_user_id: user.id });
  if (!ok) {
    // 잔액 조회 자체가 실패하면 사용자를 막지 않는다 — 차감은 어차피 뒤에서 한 번 더 검증된다.
    console.warn('[credits] 잔액 조회 실패, 사전확인 건너뜀:', data);
    return { ok: true, cost, remain: null };
  }

  const remain = Number(data?.remain ?? 0);
  if (remain < cost) {
    return { ok: false, statusCode: 402, error: INSUFFICIENT_MSG, cost, remain };
  }
  return { ok: true, cost, remain };
}

/**
 * 크레딧 차감 — 반드시 작업이 성공한 뒤에만 호출한다.
 * @returns {{ ok:true, amount:number, remain:number|null }}
 *        | {{ ok:false, statusCode:402, error:string }}
 */
export async function chargeCredits({ token, user, isAdmin, type, count = 1, note = '' }) {
  if (isAdmin) return { ok: true, amount: 0, remain: 999999, admin: true };

  const n = normCount(count);
  const amount = costOf(type, n);
  if (amount === 0) return { ok: true, amount: 0, remain: null, free: true };

  const { ok, data } = await rpc('use_credits', { p_user_id: user.id, p_amount: amount });
  if (!ok || data?.ok === false) {
    return { ok: false, statusCode: 402, error: data?.error || INSUFFICIENT_MSG, remain: data?.remain ?? null };
  }

  const label = `${TYPE_LABELS[type] || type}${n > 1 ? ` ×${n}장` : ''}${note ? ` — ${note}` : ''}`;
  await logLedger(token, user.id, 'use', -amount, label, data?.remain);

  return { ok: true, amount, remain: data?.remain ?? null };
}
