// src/hooks/useUsageLimit.js
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = ['qoanswls09@gmail.com', 'qoanswls81@gmail.com', 'qoanswls@naver.com'];
const COSTS = { brand: 10, space: 30, image: 10, guideline: 100, regen: 10, brandname: 0 };

export function useUsageLimit(user) {
  const [credits, setCredits] = useState({ remain: 50, total: 50, used: 0 });
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

  // 크레딧 차감 (서버)
  const useCredit = useCallback(async (type) => {
    if (isAdmin) return { ok: true, remain: 999999 };
    try {
      const token = await getToken();
      const res = await fetch('/.netlify/functions/bb-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'use', type }),
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

  // 차감 전 체크
  const checkLimit = useCallback((type) => {
    if (isAdmin) return { allowed: true, remain: 999999 };
    const cost = COSTS[type] ?? 10;
    return { allowed: credits.remain >= cost, remain: credits.remain, cost };
  }, [credits, isAdmin]);

  const incrementLocal = useCallback(() => {}, []);
  const usage = { brand_count: 0, image_count: 0 };
  const plan = isAdmin ? 'admin' : 'free';

  return { credits, loading, checkLimit, useCredit, useCoupon, incrementLocal, refetch: fetchCredits, usage, plan };
}
