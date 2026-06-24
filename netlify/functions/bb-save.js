// netlify/functions/bb-save.js
// 브랜드 프로젝트 저장 + 사용량 카운터 증가
// ESM: export const handler

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
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

// ── Supabase REST API 헬퍼 ────────────────────────────────
async function supabase(method, path, body, userToken) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': userToken ? `Bearer ${userToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (method === 'GET' || method === 'DELETE') {
    headers['Prefer'] = 'return=representation';
  } else {
    headers['Prefer'] = 'return=representation';
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

// ── 월간 사용량 upsert ────────────────────────────────────
async function incrementUsage(userId, userToken, type) {
  const yearMonth = new Date().toISOString().slice(0, 7); // '2026-06'

  // 현재 사용량 조회
  const { data: existing } = await supabase(
    'GET',
    `bb_usage?user_id=eq.${userId}&year_month=eq.${yearMonth}`,
    null,
    userToken
  );

  if (existing && existing.length > 0) {
    // 기존 행 업데이트
    const current = existing[0];
    const updates = type === 'brand'
      ? { brand_count: (current.brand_count || 0) + 1 }
      : { image_count: (current.image_count || 0) + 1 };

    await supabase(
      'PATCH',
      `bb_usage?user_id=eq.${userId}&year_month=eq.${yearMonth}`,
      updates,
      userToken
    );
  } else {
    // 새 행 삽입
    const insert = {
      user_id: userId,
      year_month: yearMonth,
      brand_count: type === 'brand' ? 1 : 0,
      image_count: type === 'image' ? 1 : 0,
    };
    await supabase('POST', 'bb_usage', insert, userToken);
  }
}

// ── 플랜별 한도 체크 ─────────────────────────────────────
function checkLimit(plan, usage, type) {
  const LIMITS = {
    free:    { brand: 2,  image: 3   },
    starter: { brand: 5,  image: 20  },
    pro:     { brand: 15, image: 60  },
    studio:  { brand: 40, image: 180 },
  };
  const limit = LIMITS[plan] || LIMITS.free;
  const current = type === 'brand' ? (usage?.brand_count || 0) : (usage?.image_count || 0);
  const max = type === 'brand' ? limit.brand : limit.image;
  return { allowed: current < max, current, max };
}

// ── handler ──────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error: '잘못된 JSON' });

  // Authorization 헤더에서 유저 토큰 추출
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const userToken = authHeader.replace('Bearer ', '').trim();

  if (!userToken) {
    return jsonResponse(401, { error: '로그인이 필요합니다.' });
  }

  // 유저 정보 확인
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${userToken}`,
    },
  });
  const userData = await userRes.json();
  if (!userRes.ok || !userData?.id) {
    return jsonResponse(401, { error: '유효하지 않은 토큰입니다.' });
  }
  const userId = userData.id;

  const { action } = payload;

  // ── 1. 프로젝트 저장 ─────────────────────────────────
  if (action === 'save_project') {
    const {
      formData, referenceStyle,
      brandDecision, interiorImagePackage,
      images, projectId
    } = payload;

    // 기존 프로젝트 업데이트 or 새로 생성
    if (projectId) {
      // 업데이트
      const { ok, data } = await supabase(
        'PATCH',
        `bb_projects?id=eq.${projectId}&user_id=eq.${userId}`,
        {
          form_data: formData || {},
          reference_style: referenceStyle || '',
          brand_decision: brandDecision || {},
          interior_image_package: interiorImagePackage || {},
          images: images || {},
          status: 'completed',
        },
        userToken
      );
      if (!ok) return jsonResponse(400, { error: '프로젝트 업데이트 실패', detail: data });
      return jsonResponse(200, { ok: true, project: data?.[0] || null });
    } else {
      // 새 프로젝트 생성
      const { ok, data } = await supabase(
        'POST',
        'bb_projects',
        {
          user_id: userId,
          form_data: formData || {},
          reference_style: referenceStyle || '',
          brand_decision: brandDecision || {},
          interior_image_package: interiorImagePackage || {},
          images: images || {},
          status: 'completed',
        },
        userToken
      );
      if (!ok) return jsonResponse(400, { error: '프로젝트 저장 실패', detail: data });

      // 브랜드 생성 카운터 증가
      await incrementUsage(userId, userToken, 'brand');

      return jsonResponse(200, { ok: true, project: data?.[0] || null });
    }
  }

  // ── 2. 이미지 저장 (이미지 생성 후 URL 업데이트) ──────
  if (action === 'save_images') {
    const { projectId, section, urls } = payload;
    if (!projectId) return jsonResponse(400, { error: 'projectId 필요' });

    // 현재 images 조회
    const { data: existing } = await supabase(
      'GET',
      `bb_projects?id=eq.${projectId}&user_id=eq.${userId}&select=images`,
      null,
      userToken
    );

    const currentImages = existing?.[0]?.images || {};
    const updatedImages = { ...currentImages, [section]: urls };

    const { ok, data } = await supabase(
      'PATCH',
      `bb_projects?id=eq.${projectId}&user_id=eq.${userId}`,
      { images: updatedImages },
      userToken
    );
    if (!ok) return jsonResponse(400, { error: '이미지 저장 실패', detail: data });

    // 이미지 카운터 증가
    await incrementUsage(userId, userToken, 'image');

    return jsonResponse(200, { ok: true, images: updatedImages });
  }

  // ── 3. 공유 링크 활성화 ───────────────────────────────
  if (action === 'toggle_share') {
    const { projectId, isPublic } = payload;
    if (!projectId) return jsonResponse(400, { error: 'projectId 필요' });

    const { ok, data } = await supabase(
      'PATCH',
      `bb_projects?id=eq.${projectId}&user_id=eq.${userId}`,
      {
        is_public: isPublic,
        status: isPublic ? 'shared' : 'completed',
      },
      userToken
    );
    if (!ok) return jsonResponse(400, { error: '공유 설정 실패', detail: data });

    return jsonResponse(200, { ok: true, project: data?.[0] || null });
  }

  // ── 4. 사용량 조회 ────────────────────────────────────
  if (action === 'get_usage') {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const { data } = await supabase(
      'GET',
      `bb_usage?user_id=eq.${userId}&year_month=eq.${yearMonth}`,
      null,
      userToken
    );
    const usage = data?.[0] || { brand_count: 0, image_count: 0 };
    return jsonResponse(200, { ok: true, usage });
  }

  return jsonResponse(400, { error: '알 수 없는 action' });
};
