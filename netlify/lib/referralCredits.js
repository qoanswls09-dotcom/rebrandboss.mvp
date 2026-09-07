// netlify/functions/bb-credits.js
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, preflight } from './http.js';
import { COSTS, TYPE_LABELS } from './credits.js';

const ADMIN_EMAILS = ['qoanswls09@gmail.com', 'qoanswls81@gmail.com', 'qoanswls@naver.com'];

// ★ 보안 (C-4, 2026-08-24): 초대 보상 금액/한도는 반드시 서버 상수여야 한다.
//   기존에는 요청 본문의 amount를 그대로 믿었고, 한도 검사는 클라이언트(App.jsx)에만 있었다.
//   프론트의 같은 이름 상수는 화면 안내 문구용이며, 실제 기준은 여기다.
const INVITE_BONUS       = 50;
const INVITE_DAILY_LIMIT = 5;
const INVITE_TOTAL_LIMIT = 10;
// 월 무료 지급량. 실제 지급은 claim_free_credits RPC가 하고 이 값은 ledger 기록용 폴백이다
// (RPC가 amount를 안 돌려주는 구버전일 때만 쓰인다). 금액 기준은 DB 함수가 단일 출처.
const FREE_MONTHLY_CREDITS = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// service_role로 Supabase REST/Admin API를 호출한다 (RLS 우회).
// 초대 자격 판정처럼 "클라이언트가 볼 수도, 우회할 수도 없어야 하는" 조회에만 쓴다.
async function adminFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      ...(method === 'POST' ? { Prefer: 'return=representation' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = { _raw: text.slice(0, 200) }; }
  return { ok: res.ok, status: res.status, data };
}

// ★ NEW: 거래 내역을 bb_credit_ledger에 기록 (실패해도 크레딧 처리 자체는 막지 않음)
//
// ★ 2026-08-25: 실패를 조용히 넘기지 않는다.
//   supabase-js의 .insert()는 권한 오류(42501)나 RLS 거부에 throw하지 않고
//   { error }로 돌려준다. 예전 코드는 그 error를 확인하지 않고 try/catch만 걸어서,
//   내역 기록이 실패해도 아무 흔적 없이 통과했다 — "잔액은 빠졌는데 내역이 없다"가
//   조용히 만들어지는 경로였다. 이제 error를 검사하고 error 레벨로 남긴다.
//   (여전히 throw하지는 않는다 — 기록 실패가 크레딧 처리 자체를 막으면 안 된다)
async function logLedger(supabase, userId, type, amount, description, balanceAfter) {
  try {
    const { error } = await supabase.from('bb_credit_ledger').insert({
      user_id: userId,
      type,
      amount,
      description: description || '',
      balance_after: typeof balanceAfter === 'number' ? balanceAfter : null,
    });
    if (error) {
      console.error('🚨 크레딧 내역 기록 실패 — 잔액은 변경됨, 내역만 누락 🚨', {
        userId, type, amount, description, code: error.code, message: error.message,
      });
    }
  } catch (e) {
    console.error('🚨 크레딧 내역 기록 실패 (예외) 🚨', {
      userId, type, amount, description, error: e?.message,
    });
  }
}

export const handler = async (event) => {
  // ★ 보안 (C-3): CORS 전체 개방(*) → 허용 오리진 제한
  const headers = corsHeaders(event);
  const json = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
  if (event.httpMethod === 'OPTIONS') return preflight(event);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: '로그인 필요' }) };

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: '인증 실패' }) };

  // ★ 사용자 토큰으로 RLS가 적용되는 클라이언트 (ledger insert는 이 클라이언트로 해야 auth.uid() 정상 인식됨)
  const userSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const isAdmin = ADMIN_EMAILS.includes(user.email);
  const body = JSON.parse(event.body || '{}');
  const { action, type, code, amount, reason, referrerId, count } = body;


  try {
    // 크레딧 조회
    if (action === 'get') {
      if (isAdmin) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, remain: 999999, total: 999999, used: 0 }) };
      const { data, error } = await supabase.rpc('get_credits', { p_user_id: user.id });
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...data }) };
    }

    // ★ NEW: 충전/차감 내역 조회 (KG이니시스 심사 요건 대응)
    if (action === 'get_ledger') {
      const limit = typeof amount === 'number' && amount > 0 ? Math.min(amount, 200) : 50;
      const { data, error } = await userSupabase.rpc('get_my_credit_ledger', { p_limit: limit });
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ledger: data || [] }) };
    }

    // ★ NEW: FREE 플랜 - 월 1회 무료 크레딧 50개 받기
    //
    // ★ 2026-08-25: 지급 내역을 ledger에 남긴다.
    //   이 경로는 잔액을 바꾸면서 bb_credit_ledger에는 아무것도 쓰지 않는 유일한
    //   차감/지급 경로였다. foodrunk 계정에서 결제분 260이 사라졌을 때 ledger에
    //   흔적이 전혀 없었던 이유가 이것이다 — 무슨 일이 있었는지 사후에 알 방법이 없었다.
    //   (덮어쓰기 자체는 DB 함수 쪽 버그이며 sql/bb_claim_free_credits_fix.sql로 고친다)
    if (action === 'claim_free') {
      if (isAdmin) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, remain: 999999 }) };
      const { data, error } = await userSupabase.rpc('claim_free_credits', { p_user_id: user.id });
      if (error) throw error;
      // 실제로 지급됐을 때만 기록한다. 이미 받은 달이면 data.ok가 false다.
      if (data?.ok) {
        const granted = typeof data.amount === 'number' ? data.amount : FREE_MONTHLY_CREDITS;
        await logLedger(userSupabase, user.id, 'free', granted, '월 무료 크레딧', data?.remain);
      }
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 크레딧 차감
    if (action === 'use') {
      if (isAdmin) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, remain: 999999 }) };
      // 단가는 netlify/lib/credits.js가 단일 기준 (generate-interior 등도 같은 표를 쓴다)
      // ★ NEW: count — 한 번에 여러 건 차감 (매장 사진 여러 장 생성 등). 없으면 1건.
      const n   = Math.max(1, Math.min(20, Math.trunc(Number(count)) || 1));
      const amt = (COSTS[type] ?? 10) * n;
      if (amt === 0) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, free: true }) };
      const { data, error } = await supabase.rpc('use_credits', { p_user_id: user.id, p_amount: amt });
      if (error) throw error;
      // ★ NEW: 차감 내역 기록
      await logLedger(userSupabase, user.id, 'use', -amt, `${TYPE_LABELS[type] || type}${n > 1 ? ` ×${n}장` : ''}`, data?.remain);
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 쿠폰 사용
    if (action === 'coupon') {
      const { data, error } = await supabase.rpc('use_coupon', { p_user_id: user.id, p_code: code?.trim().toUpperCase() });
      if (error) throw error;
      // ★ NEW: 쿠폰 적립 내역 기록 (성공했을 때만)
      if (data?.ok && data?.bonus) {
        await logLedger(userSupabase, user.id, 'coupon', data.bonus, `쿠폰 등록 (${code?.trim().toUpperCase()})`, data?.remain);
      }
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // ── 친구초대 보상 (C-4, 2026-08-24 전면 재작성) ──────────────────────
    //
    // 기존 문제: invite_bonus는 요청 본문의 amount를 그대로 믿고 호출자에게 적립했다.
    //   초대 기록이 실제로 있는지 확인하지 않았고, 한도도 중복 방지도 없었다.
    //   `{"action":"invite_bonus","amount":999999}` 한 번이면 크레딧이 무한 생성됐다.
    //   남용 방지 로직(일일/총 한도, 중복 확인)은 전부 App.jsx — 즉 클라이언트에 있었고,
    //   서버는 그 검사를 거쳤는지 알 방법이 없었다.
    //
    // 이제: 금액은 서버 상수(INVITE_BONUS)로 고정하고, 검증 전체를 서버에서 수행한다.
    //   1) referrerId 형식 검증 + 자기 자신 초대 차단
    //   2) 이 사용자가 이미 초대 보상을 받았는지 확인 (referrals.invitee_id)
    //   3) 초대한 사람의 일일/총 한도 확인
    //   4) referrals 행 생성 (이 행 자체가 중복 방지 기록이 된다)
    //   5) 양쪽에 고정 금액 적립
    if (action === 'referral_claim' || action === 'invite_bonus') {
      const refId = typeof referrerId === 'string' ? referrerId.trim() : '';

      // 1) 형식 검증 — UUID가 아니면 즉시 거절 (임의 문자열로 RPC를 때리지 못하게)
      if (!UUID_RE.test(refId)) {
        return json(400, { ok: false, error: '초대 코드가 올바르지 않습니다.' });
      }
      if (refId === user.id) {
        return json(400, { ok: false, error: '자기 자신은 초대할 수 없습니다.' });
      }

      // ★ 2026-08-24 실측: referrals 테이블에는 authenticated 역할 권한이 아예 없다
      //   (42501 permission denied — GRANT가 없음). 즉 사용자 토큰으로는 조회도 삽입도 안 된다.
      //
      //   ⚠️ 이것이 기존 코드에서 실제로 일으키던 일:
      //     구 handleReferral(App.jsx)은 브라우저에서 이 테이블을 읽고 썼는데, supabase-js는
      //     권한 오류를 throw하지 않고 { error }로 돌려준다. 그래서
      //       · 중복 확인  → existing이 undefined → "안 받았음"으로 통과
      //       · 한도 확인  → rows가 undefined → (?.length ?? 0) === 0 → 항상 통과
      //       · insert     → 실패했는데 무시
      //     세 방어선이 전부 조용히 무력화된 채 그 다음 줄의 적립 요청만 실행됐다.
      //     결과적으로 초대 보상이 기록도 없이, 중복 제한도 없이 지급되고 있었다.
      //
      //   그래서 이 검증은 service_role로 수행한다. 이건 권한 우회가 아니라 제자리 찾기다 —
      //   "이 사용자가 보상을 받을 자격이 있는가"는 애초에 클라이언트가 볼 수 없어야 하는 판단이고,
      //   RLS 정책에 의존하면 정책이 바뀌는 순간 다시 조용히 뚫린다.
      if (!SUPABASE_SERVICE_KEY) {
        console.error('🚨 SUPABASE_SERVICE_ROLE_KEY 없음 — 초대 보상을 검증할 수 없어 거절 🚨');
        return json(503, { ok: false, error: '초대 보상을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.' });
      }

      // 2) 초대한 사람이 실재하는 계정인가 — 아무 UUID나 넣어 자기에게 50을 주는 것을 막는다
      const refUser = await adminFetch(`/auth/v1/admin/users/${refId}`);
      if (!refUser.ok || !refUser.data?.id) {
        return json(400, { ok: false, error: '초대 코드가 올바르지 않습니다.' });
      }

      // 3) 이미 받았는지 — invitee 1명당 평생 1회
      const dup = await adminFetch(`/rest/v1/referrals?select=id&invitee_id=eq.${encodeURIComponent(user.id)}&limit=1`);
      if (!dup.ok) {
        // ★ 2026-08-24 실측: referrals에 service_role 권한조차 없어 42501이 난다.
        //   자격을 확인할 수 없으면 적립하지 않는다 — 확인 못 한 채로 주는 것이 정확히
        //   기존 버그(무제한 지급)였다. 운영자가 바로 조치할 수 있게 실행할 SQL을 로그에 남긴다.
        if (dup.data?.code === '42501') {
          console.error('🚨 referrals 테이블 권한 없음 — 초대 보상 중단 🚨',
            'sql/bb_referrals_fix.sql 을 Supabase SQL 에디터에서 실행하세요.', dup.data?.hint || '');
          return json(503, { ok: false, error: '초대 보상 처리를 일시적으로 사용할 수 없습니다. 담당자에게 문의해 주세요.', needsSetup: true });
        }
        throw new Error('초대 기록 조회 실패: ' + JSON.stringify(dup.data).slice(0, 200));
      }
      if (Array.isArray(dup.data) && dup.data.length > 0) {
        return json(200, { ok: false, error: '이미 초대 보상을 받으셨습니다.', alreadyClaimed: true });
      }

      // 4) 초대한 사람의 한도 — 하루 INVITE_DAILY_LIMIT명, 평생 INVITE_TOTAL_LIMIT명
      const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
      const [dayRes, allRes] = await Promise.all([
        adminFetch(`/rest/v1/referrals?select=id&referrer_id=eq.${encodeURIComponent(refId)}&created_at=gte.${todayStart}`),
        adminFetch(`/rest/v1/referrals?select=id&referrer_id=eq.${encodeURIComponent(refId)}`),
      ]);
      if (!dayRes.ok || !allRes.ok) throw new Error('초대 한도 조회 실패');
      if ((dayRes.data?.length ?? 0) >= INVITE_DAILY_LIMIT) {
        return json(200, { ok: false, error: '이 초대 링크는 오늘 한도를 모두 사용했습니다.', limitReached: true });
      }
      if ((allRes.data?.length ?? 0) >= INVITE_TOTAL_LIMIT) {
        return json(200, { ok: false, error: '이 초대 링크는 초대 한도를 모두 사용했습니다.', limitReached: true });
      }

      // 5) 초대 기록 생성 — 이 insert가 성공해야만 적립한다.
      //    동시 요청 대비 최종 방어선은 DB의 unique(invitee_id) 인덱스다 —
      //    sql/bb_referrals_fix.sql 참고. 인덱스가 있으면 두 번째 요청은 여기서 실패한다.
      const ins = await adminFetch('/rest/v1/referrals', {
        method: 'POST',
        body: { referrer_id: refId, invitee_id: user.id },
      });
      if (!ins.ok) {
        console.warn('referral insert 실패(중복 가능성):', JSON.stringify(ins.data).slice(0, 200));
        return json(200, { ok: false, error: '초대 보상을 처리하지 못했습니다.', alreadyClaimed: true });
      }

      // 6) 적립 — 금액은 서버 상수. 요청 본문의 amount는 완전히 무시한다.
      let inviteeOk = false, referrerOk = false;

      const inv = await supabase.rpc('add_credits_to_user', { p_user_id: user.id, p_amount: INVITE_BONUS });
      if (!inv.error) inviteeOk = true;
      else {
        // 폴백: use_credits에 음수 (기존 코드가 쓰던 방식)
        const alt = await supabase.rpc('use_credits', { p_user_id: user.id, p_amount: -INVITE_BONUS });
        inviteeOk = !alt.error;
        if (alt.error) console.error('🚨 초대받은 사람 적립 실패 🚨', { userId: user.id, detail: alt.error.message, first: inv.error.message });
      }
      if (inviteeOk) await logLedger(userSupabase, user.id, 'invite', INVITE_BONUS, '친구 초대 가입 보상', null);

      const ref = await supabase.rpc('add_credits_to_user', { p_user_id: refId, p_amount: INVITE_BONUS });
      referrerOk = !ref.error;
      if (ref.error) console.error('🚨 초대한 사람 적립 실패 🚨', { referrerId: refId, detail: ref.error.message });
      // referrer 쪽 ledger는 본인 토큰이 없어 여기서 기록할 수 없다.
      // (add_credits_to_user를 SECURITY DEFINER로 ledger까지 쓰도록 고치면 해결됨)

      console.log(`referral_claim: invitee=${user.id}(${inviteeOk}) referrer=${refId}(${referrerOk}) +${INVITE_BONUS}cr each`);
      return json(200, { ok: inviteeOk, amount: INVITE_BONUS, inviteeGranted: inviteeOk, referrerGranted: referrerOk });
    }

    // ── 레거시 액션 ──────────────────────────────────────────────
    // 배포 직후 구버전 번들을 들고 있는 브라우저가 호출할 수 있다.
    // 위 referral_claim이 양쪽 적립을 모두 처리하므로 여기서는 아무것도 하지 않는다.
    // (예전처럼 amount를 믿고 적립하면 C-4 취약점이 그대로 남는다)
    if (action === 'invite_bonus_referrer') {
      return json(200, { ok: true, skipped: true, note: 'referral_claim에서 함께 처리됩니다.' });
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: '알 수 없는 액션' }) };
  } catch (err) {
    console.error('bb-credits error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
