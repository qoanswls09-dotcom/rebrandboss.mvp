// netlify/functions/bb-projects.js
// 프로젝트 목록 조회 / 상세 조회 / 공유 페이지 조회
// ESM: export const handler

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}
function safeParse(body) {
  try { return JSON.parse(body || '{}'); } catch { return null; }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function supabaseGet(path, userToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': userToken ? `Bearer ${userToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

async function getUserId(userToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${userToken}`,
    },
  });
  const data = await res.json();
  return res.ok ? data?.id : null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });

  const params = event.queryStringParameters || {};
  const { action, projectId, shareId } = params;

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const userToken = authHeader.replace('Bearer ', '').trim();

  // ── 1. 내 프로젝트 목록 ───────────────────────────────
  if (action === 'list') {
    if (!userToken) return jsonResponse(401, { error: '로그인 필요' });
    const userId = await getUserId(userToken);
    if (!userId) return jsonResponse(401, { error: '유효하지 않은 토큰' });

    // 최신순, 필요한 컬럼만
    const { ok, data } = await supabaseGet(
      `bb_projects?user_id=eq.${userId}&order=created_at.desc&select=id,share_id,is_public,status,created_at,updated_at,brand_decision,images,form_data,reference_style`,
      userToken
    );
    if (!ok) return jsonResponse(400, { error: '목록 조회 실패' });

    // 목록용 요약 데이터만 추출
    const projects = (data || []).map(p => ({
      id:           p.id,
      shareId:      p.share_id,
      isPublic:     p.is_public,
      status:       p.status,
      createdAt:    p.created_at,
      updatedAt:    p.updated_at,
      brandName:    p.brand_decision?.brandName || '',
      tagline:      p.brand_decision?.tagline || '',
      storeConcept: p.brand_decision?.storeConcept || '',
      // 대표 이미지: 공간 첫 번째 or 메뉴 첫 번째
      thumbUrl:     p.images?.space?.[0] || p.images?.menu?.[0] || '',
      category:     p.form_data?.category || '',
      district:     p.form_data?.district || '',
    }));

    return jsonResponse(200, { ok: true, projects });
  }

  // ── 2. 프로젝트 상세 (내 것) ──────────────────────────
  if (action === 'detail') {
    if (!userToken) return jsonResponse(401, { error: '로그인 필요' });
    if (!projectId) return jsonResponse(400, { error: 'projectId 필요' });

    const userId = await getUserId(userToken);
    if (!userId) return jsonResponse(401, { error: '유효하지 않은 토큰' });

    const { ok, data } = await supabaseGet(
      `bb_projects?id=eq.${projectId}&user_id=eq.${userId}`,
      userToken
    );
    if (!ok || !data?.length) return jsonResponse(404, { error: '프로젝트를 찾을 수 없습니다.' });

    return jsonResponse(200, { ok: true, project: data[0] });
  }

  // ── 3. 공유 페이지 (비로그인 접근 가능) ───────────────
  if (action === 'shared') {
    if (!shareId) return jsonResponse(400, { error: 'shareId 필요' });

    // is_public = true인 경우만 반환 (RLS 정책에 의해 자동 필터)
    const { ok, data } = await supabaseGet(
      `bb_projects?share_id=eq.${shareId}&is_public=eq.true&select=id,share_id,brand_decision,interior_image_package,images,form_data,created_at`,
      null  // 토큰 없이 — anon key로 RLS 적용
    );
    if (!ok || !data?.length) return jsonResponse(404, { error: '공유된 프로젝트를 찾을 수 없습니다.' });

    // 공유 페이지에서 보여줄 데이터만
    const p = data[0];
    return jsonResponse(200, {
      ok: true,
      project: {
        id:                   p.id,
        shareId:              p.share_id,
        brandDecision:        p.brand_decision,
        interiorImagePackage: p.interior_image_package,
        images:               p.images,
        category:             p.form_data?.category || '',
        district:             p.form_data?.district || '',
        createdAt:            p.created_at,
      }
    });
  }

  // ── 4. 프로젝트 삭제 ─────────────────────────────────
  if (action === 'delete') {
    if (!userToken) return jsonResponse(401, { error: '로그인 필요' });
    if (!projectId) return jsonResponse(400, { error: 'projectId 필요' });

    const userId = await getUserId(userToken);
    if (!userId) return jsonResponse(401, { error: '유효하지 않은 토큰' });

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bb_projects?id=eq.${projectId}&user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
        },
      }
    );
    if (!res.ok) return jsonResponse(400, { error: '삭제 실패' });
    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(400, { error: '알 수 없는 action' });
};