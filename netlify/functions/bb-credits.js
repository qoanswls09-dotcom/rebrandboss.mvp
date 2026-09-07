import { handler as referralHandler } from '../lib/referralCredits.js';
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
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode:400, headers, body:JSON.stringify({ ok:false, error:'잘못된 JSON' }) }; }
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
      // Older open pages must refresh before switching to server-owned image billing.
      if (type === 'brand' || type === 'image' || type === 'space' || (type === 'regen' && !meta)) return { statusCode:409, headers, body:JSON.stringify({ ok:false, error:'페이지를 새로고침한 뒤 다시 시도해 주세요.' }) };
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

    if (['referral_claim','invite_bonus','invite_bonus_referrer'].includes(action)) return referralHandler(event);

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: '알 수 없는 액션' }) };
  } catch (err) {
    console.error('bb-credits error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};