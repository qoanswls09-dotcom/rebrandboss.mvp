// src/hooks/useUsageLimit.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = ['qoanswls09@gmail.com', 'qoanswls81@gmail.com', 'qoanswls@naver.com'];

// ── 서버(bb-credits.js)의 calcAmount()와 동일한 공식 ──────
// 여기서는 UI에 "예상 차감액"을 미리 보여주기 위한 용도로만 쓰이고,
// 실제 차감은 항상 서버에서 다시 계산해 처리한다(서버가 최종 권위).
const BASE_COSTS = { brand: 10, space: 10, image: 10, guideline: 100, regen: 10, brandname: 0 };
const INCLUDED_STORE_PHOTOS = 5;
const INCLUDED_MENU_PHOTOS  = 3;
const EXTRA_PHOTO_COST      = 1;

function estimateCost(type, meta = {}) {
  const base = BASE_COSTS[type] ?? 10;
  if (type === 'brand' || type === 'regen') {
    const extraStore = Math.max(0, (Number(meta.storeCount) || 0) - INCLUDED_STORE_PHOTOS);
    const extraMenu  = Math.max(0, (Number(meta.menuCount)  || 0) - INCLUDED_MENU_PHOTOS);
    return base + (extraStore + extraMenu) * EXTRA_PHOTO_COST;
  }
  if (type === 'space') {
    const imageCount = Math.max(1, Math.min(Number(meta.imageCount) || 1, 5));
    return (BASE_COSTS.image ?? 10) * imageCount;
  }
  return base;
}

export function useUsageLimit(user) {
  // ★ 수정: 초기값이 50으로 하드코딩되어 있어서, 새로고침할 때마다 실제 값을 서버에서
  //   받아오기 전까지 잠깐 "50"이 화면에 보였다가 진짜 값으로 바뀌는 깜빡임이 있었음.
  //   null로 시작해서, 실제 값이 오기 전까진 화면에서 로딩 표시(…)를 하도록 함.
  const [credits, setCredits] = useState({ remain: null, total: null, used: 0 });
  const [loading, setLoading] = useState(false);
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchCredits = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch('/.netlify/functions/bb-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'get' }),
      });
      const data = await res.json();
      if (data.ok) setCredits({ remain: data.remain, total: data.total, used: data.used });
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  // 크레딧 차감 (서버) — meta: { storeCount, menuCount, imageCount } 등 액션별 참고값
  const useCredit = useCallback(async (type, meta) => {
    if (isAdmin) return { ok: true, remain: 999999 };
    try {
      const token = await getToken();
      const res = await fetch('/.netlify/functions/bb-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'use', type, meta }),
      });
      const data = await res.json();
      if (data.ok) setCredits(prev => ({ ...prev, remain: data.remain ?? prev.remain }));
      return data;
    } catch (e) { return { ok: false, error: e.message }; }
  }, [isAdmin]);

  // 쿠폰 사용
  const useCoupon = useCallback(async (code) => {
    try {
      const token = await getToken();
      const res = await fetch('/.netlify/functions/bb-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'coupon', code }),
      });
      const data = await res.json();
      if (data.ok) await fetchCredits(); // 충전 후 즉시 갱신
      return data;
    } catch (e) { return { ok: false, error: e.message }; }
  }, [fetchCredits]);

  // 차감 전 체크 (meta로 예상 비용을 계산해 잔액과 비교)
  const checkLimit = useCallback((type, meta) => {
    if (isAdmin) return { allowed: true, remain: 999999 };
    const cost = estimateCost(type, meta);
    const remain = credits.remain ?? 0; // 아직 서버 값 로딩 전이면 0으로 취급(과다사용 방지)
    return { allowed: remain >= cost, remain, cost };
  }, [credits, isAdmin]);

  const incrementLocal = useCallback(() => {}, []);
  const usage = { brand_count: 0, image_count: 0 };
  const plan = isAdmin ? 'admin' : 'free';

  return { credits, loading, checkLimit, useCredit, useCoupon, incrementLocal, refetch: fetchCredits, usage, plan };
}