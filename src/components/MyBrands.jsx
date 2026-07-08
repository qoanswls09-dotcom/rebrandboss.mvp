// netlify/functions/bb-save.js
// 브랜드 프로젝트 저장 + 사용량 카운터 증가 + 트렌드 데이터 축적
// 기존 기능 100% 유지 + 트렌드 저장 + ★ 최대 5개 저장 제한 추가

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

// ★ 프로젝트당 최대 저장 개수
const MAX_PROJECTS = 5;

function jsonResponse(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}
function safeParse(body) {
  try { return JSON.parse(body || '{}'); } catch { return null; }
}

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function sbFetch(method, path, body, userToken) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': userToken ? `Bearer ${userToken}` : `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'return=representation',
  };
  const res  = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

// ── 월간 사용량 upsert (기존 그대로) ─────────────────────
async function incrementUsage(userId, userToken, type) {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const { data: existing } = await sbFetch('GET', `bb_usage?user_id=eq.${userId}&year_month=eq.${yearMonth}`, null, userToken);
  if (existing && existing.length > 0) {
    const current = existing[0];
    const updates = type === 'brand' ? { brand_count: (current.brand_count||0)+1 } : { image_count: (current.image_count||0)+1 };
    await sbFetch('PATCH', `bb_usage?user_id=eq.${userId}&year_month=eq.${yearMonth}`, updates, userToken);
  } else {
    await sbFetch('POST', 'bb_usage', { user_id:userId, year_month:yearMonth, brand_count: type==='brand'?1:0, image_count: type==='image'?1:0 }, userToken);
  }
}

// ── 트렌드 데이터 저장 (새로 추가 — 실패해도 메인 저장에 영향 없음) ──
async function saveTrendData(userId, userToken, formData, brandDecision, interiorImagePackage, refineType) {
  try {
    const pkg = interiorImagePackage || {};
    const bd  = brandDecision        || {};
    await sbFetch('POST', 'bb_trend_data', {
      user_id:           userId,
      category:          formData?.categoryResolved || formData?.category || '',
      region_type:       formData?.region           || '',
      store_size:        formData?.storeSize         || '',
      target_audience:   formData?.targetAudience    || '',
      mood_tone:         formData?.moodTone          || bd.overallMood || '',
      brand_name:        bd.brandName                || '',
      store_concept:     bd.storeConcept             || '',
      color_palette:     pkg.colorKeywords           || [],
      material_keywords: pkg.materialKeywords        || [],
      furniture_style:   pkg.furnitureKeywords?.join(', ') || '',
      refine_type:       refineType || 'default',
    }, userToken);
  } catch (e) {
    console.warn('트렌드 데이터 저장 실패 (무시):', e.message);
  }
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error: '잘못된 JSON' });

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const userToken  = authHeader.replace('Bearer ', '').trim();
  if (!userToken) return jsonResponse(401, { error: '로그인이 필요합니다.' });

  const userRes  = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${userToken}` } });
  const userData = await userRes.json();
  if (!userRes.ok || !userData?.id) return jsonResponse(401, { error: '유효하지 않은 토큰입니다.' });
  const userId = userData.id;

  const { action } = payload;

  // ── 1. 프로젝트 저장 ─────────────────────────────────
  if (action === 'save_project') {
    const { formData, referenceStyle, brandDecision, interiorImagePackage, images, projectId, refineType } = payload;

    if (projectId) {
      // 기존 프로젝트 업데이트 — 개수 제한과 무관 (새로 만드는 게 아니므로)
      const { ok, data } = await sbFetch('PATCH', `bb_projects?id=eq.${projectId}&user_id=eq.${userId}`, {
        form_data: formData||{}, reference_style: referenceStyle||'',
        brand_decision: brandDecision||{}, interior_image_package: interiorImagePackage||{},
        images: images||{}, status: 'completed',
      }, userToken);
      if (!ok) return jsonResponse(400, { error:'프로젝트 업데이트 실패', detail:data });
      return jsonResponse(200, { ok:true, project: data?.[0]||null });
    } else {
      // ★ NEW: 신규 저장 시 최대 5개 제한 체크
      const { data: existingList } = await sbFetch('GET', `bb_projects?user_id=eq.${userId}&select=id`, null, userToken);
      if (Array.isArray(existingList) && existingList.length >= MAX_PROJECTS) {
        return jsonResponse(400, {
          ok: false,
          error: `저장 가능한 브랜드는 최대 ${MAX_PROJECTS}개입니다. "내 브랜드"에서 기존 항목을 삭제한 뒤 다시 시도해주세요.`,
          limitReached: true,
        });
      }

      const { ok, data } = await sbFetch('POST', 'bb_projects', {
        user_id: userId, form_data: formData||{}, reference_style: referenceStyle||'',
        brand_decision: brandDecision||{}, interior_image_package: interiorImagePackage||{},
        images: images||{}, status: 'completed',
      }, userToken);
      if (!ok) return jsonResponse(400, { error:'프로젝트 저장 실패', detail:data });

      // 사용량 카운터 증가
      await incrementUsage(userId, userToken, 'brand');

      // 트렌드 데이터 저장 (비동기, 실패 무시)
      saveTrendData(userId, userToken, formData, brandDecision, interiorImagePackage, refineType);

      return jsonResponse(200, { ok:true, project: data?.[0]||null });
    }
  }

  // ── 2. 이미지 저장 (기존 그대로) ─────────────────────
  if (action === 'save_images') {
    const { projectId, section, urls } = payload;
    if (!projectId) return jsonResponse(400, { error:'projectId 필요' });
    const { data: existing } = await sbFetch('GET', `bb_projects?id=eq.${projectId}&user_id=eq.${userId}&select=images`, null, userToken);
    const currentImages  = existing?.[0]?.images || {};
    const updatedImages  = { ...currentImages, [section]: urls };
    const { ok, data }   = await sbFetch('PATCH', `bb_projects?id=eq.${projectId}&user_id=eq.${userId}`, { images: updatedImages }, userToken);
    if (!ok) return jsonResponse(400, { error:'이미지 저장 실패', detail:data });
    await incrementUsage(userId, userToken, 'image');
    return jsonResponse(200, { ok:true, images: updatedImages });
  }

  // ── 3. 공유 링크 활성화 (기존 그대로) ────────────────
  if (action === 'toggle_share') {
    const { projectId, isPublic } = payload;
    if (!projectId) return jsonResponse(400, { error:'projectId 필요' });
    const { ok, data } = await sbFetch('PATCH', `bb_projects?id=eq.${projectId}&user_id=eq.${userId}`, { is_public: isPublic, status: isPublic?'shared':'completed' }, userToken);
    if (!ok) return jsonResponse(400, { error:'공유 설정 실패', detail:data });
    return jsonResponse(200, { ok:true, project: data?.[0]||null });
  }

  // ── 4. 사용량 조회 (기존 그대로) ─────────────────────
  if (action === 'get_usage') {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const { data }  = await sbFetch('GET', `bb_usage?user_id=eq.${userId}&year_month=eq.${yearMonth}`, null, userToken);
    const usage = data?.[0] || { brand_count:0, image_count:0 };
    return jsonResponse(200, { ok:true, usage });
  }

  // ── 5. 트렌드 조회 (새로 추가 — 관리자용) ───────────
  if (action === 'get_trends') {
    const { category } = payload;
    try {
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_trend_summary`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'apikey':SUPABASE_ANON_KEY, 'Authorization':`Bearer ${userToken}` },
        body: JSON.stringify({ p_category: category || null }),
      });
      const trendData = await rpcRes.json();
      return jsonResponse(200, { ok:true, trends: trendData });
    } catch (e) {
      return jsonResponse(500, { ok:false, error: e.message });
    }
  }

  return jsonResponse(400, { error:'알 수 없는 action' });
};
