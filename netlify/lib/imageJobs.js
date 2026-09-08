import { randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { requireUser } from './auth.js';

const headers = { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type, Authorization', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
export function providerUrl(value, polling = false) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') &&
      (polling ? /(^|\.)bfl\.ai$/i : /(^|\.)(bfl\.ai|bfl\.delivery)$/i).test(u.hostname);
  } catch { return false; }
}
async function rpc(name, args, auth) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method:'POST', headers:{ 'Content-Type':'application/json', apikey:process.env.SUPABASE_ANON_KEY, Authorization:`Bearer ${auth.token}` },
    body:JSON.stringify(args), signal:AbortSignal.timeout(15000),
  });
  const data = await r.json();
  if (!r.ok || data?.ok === false) throw new Error(data?.error || '크레딧 처리에 실패했습니다.');
  return data;
}
export async function checkBalance(auth, amount = 10) {
  if (auth.isAdmin) return;
  const data = await rpc('get_credits', { p_user_id:auth.user.id }, auth);
  if (!Number.isFinite(Number(data?.remain)) || Number(data.remain) < amount) throw new Error('크레딧이 부족합니다.');
}
export const chargeBalance = (auth, amount = 10) => auth.isAdmin ? Promise.resolve({ remain:999999 }) : rpc('use_credits', { p_user_id:auth.user.id, p_amount:amount }, auth);
const defaults = {
  authenticate: req => requireUser({ headers:Object.fromEntries(req.headers) }),
  store: () => getStore({ name:'rebrand-image-jobs-v1', consistency:'strong' }),
  precheck: auth => checkBalance(auth),
  charge: auth => chargeBalance(auth),
  fetch: (...args) => fetch(...args),
};

// Persist the result before attempting billing. A conditional claim prevents repeated
// polls from charging twice. An uncertain billing response is never automatically retried.
export function imageJobHandlers(generate, overrides = {}) {
  const deps = { ...defaults, ...overrides };
  const finish = async (store, key, job, imageUrl, auth) => {
    await store.setJSON(`${key}/result`, { imageUrl });
    const claim = await store.setJSON(`${key}/billing`, { state:'started', at:Date.now() }, { onlyIfNew:true });
    if (claim.modified) {
      try {
        const credit = await deps.charge(auth);
        await store.setJSON(`${key}/billing`, { state:'charged', remain:credit.remain });
      } catch {
        // The user keeps the completed image even if the balance service is unavailable.
        console.error('[image-billing] reconciliation required', key);
      }
    }
    return reply(200, { ok:true, status:'Ready', imageUrl });
  };
  async function authorize(req) {
    const auth = await deps.authenticate(req);
    return auth.ok ? auth : reply(auth.statusCode, { ok:false, status:'Error', error:auth.error });
  }
  return {
    generate: async req => {
      if (req.method === 'OPTIONS') return reply(200, {});
      if (req.method !== 'POST') return reply(405, { ok:false, error:'POST만 허용됩니다.' });
      const auth = await authorize(req); if (auth instanceof Response) return auth;
      let body;
      try { body = await req.clone().json(); } catch { return reply(400, { ok:false, error:'잘못된 JSON' }); }
      if (!body || Array.isArray(body) || typeof body !== 'object') return reply(400, { ok:false, error:'잘못된 요청' });
      try { await deps.precheck(auth); } catch (e) { return reply(402, { ok:false, creditRequired:10, error:e.message }); }
      try {
        const store = deps.store();
        const key = randomUUID();
        const job = { userId:auth.user.id, created:Date.now() };
        // Fail before calling the provider if durable job storage is unavailable.
        await store.setJSON(key, job);
        const response = await generate(req);
        const data = await response.json();
        if (!response.ok || !data.ok || data.model === 'svg-fallback') return reply(response.ok ? 502 : response.status, { ok:false, error:data.error || '이미지 생성에 실패했습니다. 다시 시도해 주세요.' });
        if (data.pollingUrl) {
          if (!providerUrl(data.pollingUrl, true)) throw new Error('이미지 공급자 응답 오류');
          await store.setJSON(key, { ...job, pollingUrl:data.pollingUrl });
          return reply(200, { ok:true, pollingUrl:key });
        }
        const imageUrl = data.imageUrl || data.dataUrl;
        if (!imageUrl) throw new Error('생성된 이미지가 없습니다.');
        return await finish(store, key, job, imageUrl, auth);
      } catch { return reply(503, { ok:false, error:'이미지 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.' }); }
    },
    poll: async req => {
      if (req.method === 'OPTIONS') return reply(200, {});
      if (req.method !== 'POST') return reply(405, { status:'Error' });
      const auth = await authorize(req); if (auth instanceof Response) return auth;
      try {
        const { pollingUrl:key } = await req.json();
        if (typeof key !== 'string' || !/^[0-9a-f-]{36}$/.test(key)) return reply(400, { status:'Error', error:'페이지를 새로고침하고 다시 생성해 주세요.' });
        const store = deps.store();
        const job = await store.get(key, { type:'json' });
        if (!job || job.userId !== auth.user.id || Date.now()-job.created > 86400000) return reply(404, { status:'Error', error:'이미지 요청을 찾을 수 없습니다.' });
        const saved = await store.get(`${key}/result`, { type:'json' });
        if (saved?.imageUrl) return reply(200, { ok:true, status:'Ready', imageUrl:saved.imageUrl });
        if (!providerUrl(job.pollingUrl, true)) return reply(400, { status:'Error' });
        const response = await deps.fetch(job.pollingUrl, { headers:{ 'x-key':process.env.FLUX_API_KEY }, redirect:'error', signal:AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error('공급자 조회 실패');
        const result = await response.json();
        if (['Error','Failed','Request Moderated','Content Moderated'].includes(result.status)) return reply(200, { status:'Error', error:'이미지를 생성하지 못했습니다. 크레딧은 차감되지 않았습니다.' });
        if (result.status !== 'Ready') return reply(200, { status:'Pending' });
        if (!providerUrl(result.result?.sample)) throw new Error('이미지 주소 오류');
        const image = await deps.fetch(result.result.sample, { redirect:'error', signal:AbortSignal.timeout(15000) });
        if (!image.ok) throw new Error('이미지 조회 실패');
        const mime = image.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
        if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw new Error('이미지 형식 오류');
        const bytes = Buffer.from(await image.arrayBuffer());
        if (!bytes.length || bytes.length > 15*1024*1024) throw new Error('이미지 크기 오류');
        return await finish(store, key, job, `data:${mime};base64,${bytes.toString('base64')}`, auth);
      } catch { return reply(503, { status:'Error', error:'이미지 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.' }); }
    },
  };
}
