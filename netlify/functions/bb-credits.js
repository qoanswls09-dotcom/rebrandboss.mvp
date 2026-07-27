// netlify/functions/bb-credits.js
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = ['qoanswls09@gmail.com', 'qoanswls81@gmail.com', 'qoanswls@naver.com'];

// ── 액션별 기본 크레딧 비용 ────────────────────────────────
const BASE_COSTS = { brand: 10, space: 10, image: 10, guideline: 100, regen: 10, brandname: 0 };

// brand/regen: 기본 요금에 포함되는 사진 장수. 이를 초과하는 사진 1장당 추가 차감.
// (Gemini 멀티모달 호출은 첨부 이미지 수에 비례해 입력 토큰 비용이 늘어나므로,
//  사진을 더 많이 첨부할수록 원가가 커지는 구조를 요금에도 반영한다.)
const INCLUDED_STORE_PHOTOS = 5; // 매장 사진 5장까지는 기본 요금에 포함 (최대 10장)
const INCLUDED_MENU_PHOTOS  = 3; // 메뉴 사진 3장까지는 기본 요금에 포함 (최대 5장)
const EXTRA_PHOTO_COST      = 1; // 포함 장수 초과 시 1장당 추가 크레딧

// 실제 차감액 계산. meta는 클라이언트가 보낸 참고값(사진 장수 등) — 서버가 최종 권위를 가진다.
function calcAmount(type, meta = {}) {
  const base = BASE_COSTS[type] ?? 10;

  if (type === 'brand' || type === 'regen') {
    const storeCount = Math.max(0, Number(meta.storeCount) || 0);
    const menuCount  = Math.max(0, Number(meta.menuCount)  || 0);
    const extraStore = Math.max(0, storeCount - INCLUDED_STORE_PHOTOS);
    const extraMenu  = Math.max(0, menuCount  - INCLUDED_MENU_PHOTOS);
    return base + (extraStore + extraMenu) * EXTRA_PHOTO_COST;
  }

  if (type === 'space') {
    // space는 첨부된 사진 1장당 이미지 1장을 실제로 생성하므로(최대 5장),
    // 고정 30크레딧이 아니라 "생성되는 이미지 수 × 이미지 단가"로 계산한다.
    const imageCount = Math.max(1, Math.min(Number(meta.imageCount) || 1, 5));
    return (BASE_COSTS.image ?? 10) * imageCount;
  }

  return base;
}

export const handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: '로그인 필요' }) };

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: '인증 실패' }) };

  const isAdmin = ADMIN_EMAILS.includes(user.email);
  const body = JSON.parse(event.body || '{}');
  const { action, type, code, amount, reason, referrerId, meta } = body;

  try {
    // 크레딧 조회
    if (action === 'get') {
      if (isAdmin) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, remain: 999999, total: 999999, used: 0 }) };
      const { data, error } = await supabase.rpc('get_credits', { p_user_id: user.id });
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ...data }) };
    }

    // 크레딧 차감
    if (action === 'use') {
      if (isAdmin) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, remain: 999999 }) };
      const amt = calcAmount(type, meta || {});
      if (amt === 0) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, free: true }) };
      const { data, error } = await supabase.rpc('use_credits', { p_user_id: user.id, p_amount: amt });
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ ...data, charged: amt }) };
    }

    // 쿠폰 사용
    if (action === 'coupon') {
      const { data, error } = await supabase.rpc('use_coupon', { p_user_id: user.id, p_code: code?.trim().toUpperCase() });
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // ── 친구초대: 초대받은 사람 크레딧 적립 ──────────────────
    // 현재 로그인한 유저(초대받은 사람)에게 적립
    if (action === 'invite_bonus') {
      const bonusAmount = typeof amount === 'number' && amount > 0 ? amount : 50;
      const bonusReason = reason || '친구 초대 가입 보상';
      const { data, error } = await supabase.rpc('use_credits', {
        p_user_id: user.id,
        p_amount: -bonusAmount, // 음수 = 적립
      });
      // use_credits가 차감 전용이면 아래 직접 INSERT 방식 사용
      if (error) {
        // fallback: profiles 테이블 직접 업데이트
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            credits_total: supabase.rpc('get_credits', { p_user_id: user.id }).then(r => (r.data?.total ?? 0) + bonusAmount),
          })
          .eq('id', user.id);
        if (updateErr) throw updateErr;
      }
      console.log(`invite_bonus: ${user.id} +${bonusAmount}cr (${bonusReason})`);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, amount: bonusAmount }) };
    }

    // ── 친구초대: 초대한 사람(referrer) 크레딧 적립 ──────────
    // service_role 없이 anon key로 다른 유저 크레딧 적립하는 방법:
    // Supabase RPC 함수 add_credits_to_user(p_user_id, p_amount) 를 SECURITY DEFINER로 만들어야 함
    if (action === 'invite_bonus_referrer') {
      if (!referrerId) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'referrerId 없음' }) };
      const bonusAmount = typeof amount === 'number' && amount > 0 ? amount : 50;
      const bonusReason = reason || '친구 초대 보상';

      // Supabase RPC로 referrer에게 적립 (아래 SQL을 Supabase에 등록해야 함)
      const { data, error } = await supabase.rpc('add_credits_to_user', {
        p_user_id: referrerId,
        p_amount: bonusAmount,
      });
      if (error) throw error;
      console.log(`invite_bonus_referrer: ${referrerId} +${bonusAmount}cr (${bonusReason})`);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, amount: bonusAmount }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: '알 수 없는 액션' }) };
  } catch (err) {
    console.error('bb-credits error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};