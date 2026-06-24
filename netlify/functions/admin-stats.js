// netlify/functions/admin-stats.js
// get_admin_stats() Supabase 함수 호출 — SUPABASE_SERVICE_KEY 불필요

import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = [
  'qoanswls09@gmail.com',
  'qoanswls81@gmail.com',
  'qoanswls@naver.com',
];

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  // anon key로 충분 — get_admin_stats는 SECURITY DEFINER
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  // 요청자 이메일로 관리자 확인
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: '로그인이 필요합니다' }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);

  if (authErr || !user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: '인증 실패' }) };
  }
  if (!ADMIN_EMAILS.includes(user.email)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: '관리자만 접근 가능합니다' }) };
  }

  try {
    const { data, error } = await supabase.rpc('get_admin_stats');
    if (error) throw new Error(error.message);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        generatedAt: new Date().toISOString(),
        users:      data.users,
        brands:     data.brands,
        dailyStats: data.dailyStats,
      }),
    };
  } catch (err) {
    console.error('admin-stats error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
