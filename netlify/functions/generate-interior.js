// netlify/functions/generate-interior.js
// 이미지 엔진 2종 병행: Stability Structure Control(공간 사진) + Flux 2 Pro(그 외)
//
// ★ Functions v2 (export default async (req) => Response) 형식이다.
//   (2026-08-11) 기존 v1(export const handler)에서 옮겼다. v1은 netlify dev에서
//   "Lambda compatibility mode"로 로드되는데 이 모드에는 Blobs 환경이 주입되지 않아
//   생성 결과를 Blobs에 저장하는 경로를 로컬에서 아예 검증할 수 없었다.
//   Blobs를 쓰는 다른 함수들(rebrand-upload/poll/image)도 모두 v2다.
//
// ★★★ 구조 변경 (2026-07-07, 4차) ★★★
// 1차: Kontext Pro img2img → 너무 보수적(거의 안 바뀜)
// 2차: txt2img + Gemini 구조분석(텍스트만) → 원본과 무관한 완전히 새 사진
// 3차: Kontext Pro img2img + 공격적 프롬프트 → 그래도 여전히 변화폭 2~3/10 수준, 부족
// 4차: Flux Kontext Pro를 버리고, brandboss가 쓰는 것과 동일한 flux-2-pro 엔드포인트를
//      "편집 모드"(input_image 파라미터)로 사용. 변화폭은 충분해졌다.
//
// ★★★ 구조 변경 (2026-08-11, 5차 — 현재) ★★★
// 4차의 남은 문제: flux-2-pro의 input_image는 "참조"일 뿐 구조를 고정하지 않는다. 그래서
// 변화폭을 키우면(tier 2 이상) 벽 위치·창문·천장 높이까지 같이 바뀌어버려, 사장님이
// "우리 가게가 저렇게 되는 거냐"고 물으면 답할 수 없는 그림이 나왔다.
// → 매장 "공간" 사진(interior/exterior)은 Stability AI Structure Control로 교체한다.
//   이 엔드포인트는 입력 사진의 기하 구조(윤곽/원근/개구부)를 control_strength로 고정한 채
//   프롬프트대로 재질·색·조명·가구만 다시 그린다. 즉 "같은 공간, 다른 브랜드"가 보장된다.
//
// 엔진 분기 (buildEnginePlan 참고):
//   - interior / exterior + 사진  → Stability Structure Control
//   - menu + 사진                 → flux-2-pro 편집 모드 (구조 고정은 오히려 방해:
//                                   메뉴 사진은 접시·플레이팅 자체를 바꾸는 게 목적이라
//                                   그릇 윤곽까지 고정하면 "새 플레이팅"이 불가능해진다)
//   - 정밀 수정(editRequest)      → flux-2-pro 편집 모드 (한 군데만 고치는 수술적 편집.
//                                   Structure Control은 프롬프트 기준 전체 재생성이라 부적합)
//   - 사진 없음(txt2img)          → flux-2-pro (Structure Control은 입력 이미지가 필수)

import { getStore } from '@netlify/blobs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode, body) {
  return new Response(JSON.stringify(body), { status: statusCode, headers: CORS_HEADERS });
}
function safeParse(body) { try { return JSON.parse(body || '{}'); } catch { return null; } }
function clean(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeArray(v) { return Array.isArray(v) ? v : []; }
function escapeXml(v) {
  return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const HAS_HANGUL = /[가-힣]/;
const NO_KOREAN_TEXT = 'STRICT RULE: Do NOT generate any Korean, Chinese, Japanese, or any non-Latin text. No signage text, no labels, no watermarks.';

function convertStoreSizeToEnglish(storeSize) {
  if (!storeSize) return '';
  const str = String(storeSize);
  const m = str.match(/(\d+)\s*평/);
  if (m) {
    const pyeong = parseInt(m[1]);
    const sqm = Math.round(pyeong * 3.3058);
    let s = pyeong <= 10 ? 'very small' : pyeong <= 20 ? 'small' : pyeong <= 30 ? 'medium' : pyeong <= 50 ? 'medium-large' : 'large';
    return `${pyeong} pyeong (~${sqm} sqm), ${s} restaurant.`;
  }
  return storeSize;
}

async function translateReferenceToVisuals(referenceStyle, apiKey) {
  if (!referenceStyle?.trim()) return '';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{parts:[{text:`Describe interior design for "${referenceStyle}" in ONE paragraph: hex colors, materials, furniture, lighting. English only.`}]}], generationConfig:{temperature:0.5, maxOutputTokens:2000, thinkingConfig:{thinkingBudget:-1}} }) }
    );
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('').trim() || referenceStyle;
  } catch { return referenceStyle; }
}

// ★ 2026-08-27: 사용자가 지정한 "부각시킬 소품"을 영문으로 옮긴다.
//
//   왜 번역이 필요한가. 소품 카드는 directPrompt(영문)로 FLUX를 부른다. 거기에
//   "빈티지 촛대, 황동 트레이" 같은 한국어를 그대로 끼워 넣으면 모델에 사실상
//   도달하지 못한다 — 이미 translateReferenceToVisuals를 둔 것과 같은 이유다.
//   문장이 아니라 명사구 목록이라 지시만 다르다.
//
//   실패하면 원문을 그대로 돌려준다. 번역이 안 됐다고 생성을 막을 이유는 없고,
//   최악의 경우 "소품 지정이 약하게 먹는" 정도로 끝난다.
async function translatePropFocus(text, apiKey) {
  const t = clean(text);
  if (!t || !HAS_HANGUL.test(t) || !apiKey) return t;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      { method:'POST', headers:{'Content-Type':'application/json; charset=utf-8'},
        body: JSON.stringify({ contents:[{parts:[{text:`Translate this Korean list of decorative objects into short English noun phrases, comma-separated. Keep it under 15 words. Output ONLY the translation, no quotes, no explanation.

${t}`}]}], generationConfig:{temperature:0.2, maxOutputTokens:2000, thinkingConfig:{thinkingLevel:'minimal'}} }) }
    );
    const data = await res.json();
    const raw = clean(data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join(''));
    // 번역이 실패해 한국어가 그대로 남아 오면 원문과 다를 게 없다.
    if (!raw || HAS_HANGUL.test(raw)) return t;
    return raw;
  } catch { return t; }
}

async function generateSceneDescription(sceneIndex, brandContext, themeBlock, geminiApiKey) {
  const sceneNames = ['메인 다이닝 홀', '테이블 경험', '시그니처 존'];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{parts:[{text:`인테리어 디자인 제안서. 레스토랑 컨셉: ${brandContext.storeConcept||''}, 분위기: ${brandContext.overallMood||''}\n"${sceneNames[sceneIndex]||'장면'}" 제목과 설명 한국어로.\n형식:\n제목: []\n설명: []`}]}], generationConfig:{temperature:0.8, maxOutputTokens:1500, thinkingConfig:{thinkingBudget:-1}} }) }
    );
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('').trim()||'';
    const titleMatch = text.match(/제목:\s*(.+)/);
    const descMatch  = text.match(/설명:\s*(.+)/s);
    return { sceneName:sceneNames[sceneIndex]||`장면 ${sceneIndex+1}`, sceneNum:`SCENE 0${sceneIndex+1}`, title:titleMatch?.[1]?.trim()||'', desc:descMatch?.[1]?.trim()||'' };
  } catch { return null; }
}

function buildFallbackSvg({ brandName='', concept='' }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960"><rect width="1440" height="960" fill="#1A2A3A"/><text x="100" y="240" font-size="72" font-family="Arial" font-weight="bold" fill="#F2EFE8">${escapeXml(brandName)}</text><text x="100" y="295" font-size="26" font-family="Arial" fill="#AACAD8">${escapeXml(concept)}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function extractBase64(imageData) {
  if (!imageData) return null;
  return imageData.includes(',') ? imageData.split(',')[1] : imageData;
}

// ── ★ NEW: 이미 생성된 이미지의 https URL을 base64로 변환 (정밀 수정 모드용) ──
// 들어올 수 있는 형태가 셋이다:
//   · data: URI               — Blobs 저장이 실패했던 경우. 그대로 쓴다.
//   · rebrand-image 상대경로   — 우리 Blobs. 상대경로는 fetch할 수 없으니 직접 읽는다.
//   · 외부 https URL          — Flux 결과. 그대로 받아온다.
async function fetchImageAsBase64(url) {
  if (typeof url !== 'string' || !url) throw new Error('원본 이미지 주소가 없습니다.');
  if (url.startsWith('data:')) return url;

  const blobKey = url.match(/^\/\.netlify\/functions\/rebrand-image\?key=([A-Za-z0-9_-]{8,80})$/)?.[1];
  if (blobKey) {
    const store = getStore({ name: 'rebrand-images', consistency: 'strong' });
    const res = await store.getWithMetadata(blobKey, { type: 'arrayBuffer' });
    if (!res?.data) throw new Error('원본 이미지를 찾지 못했습니다.');
    const ct = res.metadata?.contentType || 'image/jpeg';
    return `data:${ct};base64,${Buffer.from(res.data).toString('base64')}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`원본 이미지를 불러오지 못했습니다 (${res.status})`);
  const buf = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const b64 = Buffer.from(buf).toString('base64');
  return `data:${contentType};base64,${b64}`;
}

// ── ★ NEW: 정밀 수정 전용 프롬프트 — tier/변환강도 로직과 완전히 별개.
// "이 사진을 참고해서 새로 만들어라"가 아니라 "이 사진을 그대로 두고 딱 이 부분만 고쳐라".
function buildPreciseEditPrompt(editRequest, imageType) {
  const subject = imageType === 'menu' ? 'food photo' : imageType === 'exterior' ? 'exterior photo' : 'interior photo';
  return [
    `PRECISE EDIT ONLY — this is a surgical single edit, not a redesign.`,
    `Apply EXACTLY this one change to the ${subject} and NOTHING else: "${editRequest}"`,
    `CRITICAL: Preserve everything else in the image exactly as it is — identical composition, camera angle, objects, colors, materials, lighting, and layout. Do NOT regenerate the scene. Do NOT apply any creative reinterpretation beyond the single requested change.`,
    `The only visible difference from the input image should be the specific change requested above.`,
    NO_KOREAN_TEXT,
  ].join(' ');
}

// ── Flux 2 Pro: input_image가 있으면 편집 모드, 없으면 순수 txt2img ──
async function submitFlux2Pro(prompt, fluxApiKey, opts = {}) {
  const body = { prompt, width: 1440, height: 960, output_format: 'jpeg' };
  if (opts.inputImageBase64) {
    const b64 = extractBase64(opts.inputImageBase64);
    if (!b64) throw new Error('입력 이미지 없음');
    body.input_image = b64;
    // 편집 모드에서 prompt_upsampling을 켜면 모델이 지시를 스스로 확장해 더 과감하게 반영한다.
    if (opts.promptUpsampling) body.prompt_upsampling = true;
  }
  const res = await fetch('https://api.bfl.ai/v1/flux-2-pro', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-key': fluxApiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(JSON.stringify(e) || `Flux 실패 ${res.status}`); }
  const data = await res.json();
  if (!data.polling_url) throw new Error('polling_url 없음');
  return data.polling_url;
}

// (구) 순수 txt2img 전용 래퍼 — 기존 호출부와 호환 유지
async function submitFluxTxt2Img(prompt, fluxApiKey) {
  return submitFlux2Pro(prompt, fluxApiKey);
}

// ══════════════════════════════════════════════════════════════════════
//  Stability AI — Structure Control
//  POST https://api.stability.ai/v2beta/stable-image/control/structure
//  스펙 출처: https://api.stability.ai/v2alpha/openapi (공식 OpenAPI, v2beta)
//    · multipart/form-data
//    · 필수: prompt(1~10000자), image(jpeg/png/webp)
//    · 선택: control_strength(0~1, 기본 0.7), negative_prompt(~10000자),
//            seed(0~4294967294), output_format(png|jpeg|webp, 기본 png), style_preset
//    · 헤더: authorization: Bearer <key>, accept: image/* | application/json
//    · 출력 해상도 = 입력 해상도. 성공 1건당 5크레딧(실패는 과금 없음).
// ══════════════════════════════════════════════════════════════════════
const STABILITY_STRUCTURE_URL = 'https://api.stability.ai/v2beta/stable-image/control/structure';

// 입력 이미지 제약 (공식 스펙)
const ST_MIN_SIDE       = 64;
const ST_MIN_PIXELS     = 4096;
const ST_MAX_PIXELS     = 9437184;   // 9.4MP — 요즘 폰 원본(12MP+)은 초과하므로 클라이언트에서 축소 필요
const ST_MAX_ASPECT     = 2.5;       // 1:2.5 ~ 2.5:1
const ST_MAX_REQ_BYTES  = 10 * 1024 * 1024; // 요청 전체 10MiB 초과 시 413

// Netlify 동기 함수는 이 플랜에서 CDN이 30초에 강제 종료한다(netlify.toml의 timeout=120은 적용 안 됨).
// 그 전에 우리가 먼저 끊어야 502 대신 정상적인 ok:false 응답을 돌려줄 수 있다.
// 실측 소요는 13~18초. 여기에 Blobs 저장(1~2초)과 부대비용을 더해도 30초 안에 끝나도록 20초로 잡는다.
const ST_TIMEOUT_MS = 20000;

// data URI / 순수 base64 → { buffer, mime }
function decodeImagePayload(imageData) {
  const b64 = extractBase64(imageData);
  if (!b64) return null;
  const m = typeof imageData === 'string' ? imageData.match(/^data:([^;,]+)[;,]/) : null;
  let mime = m?.[1] || '';
  const buffer = Buffer.from(b64, 'base64');
  if (!mime) mime = sniffMime(buffer) || 'image/jpeg';
  return { buffer, mime };
}

function sniffMime(buf) {
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// PNG/JPEG 헤더에서 픽셀 크기를 읽는다. 알 수 없는 포맷이면 null →
// 우리 쪽 사전검증은 건너뛰고 Stability의 422 응답에 맡긴다.
function readImageSize(buf) {
  // PNG: IHDR의 width/height (big-endian)
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: SOFn 마커에서 추출
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
      const len = buf.readUInt16BE(off + 2);
      // SOF0~SOF15 중 DHT(c4)/JPG(c8)/DAC(cc) 제외
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      off += 2 + len;
    }
  }
  return null;
}

// 사전검증: 통과하면 null, 실패하면 사장님이 읽을 수 있는 한국어 메시지를 반환
function validateStabilityImage(buffer) {
  if (buffer.length > ST_MAX_REQ_BYTES) {
    return '사진 용량이 너무 커요(10MB 초과). 더 작은 사진으로 다시 시도해주세요.';
  }
  const size = readImageSize(buffer);
  if (!size) return null; // 크기를 못 읽는 포맷 → API 검증에 맡김
  const { width, height } = size;
  if (width < ST_MIN_SIDE || height < ST_MIN_SIDE) {
    return `사진이 너무 작아요(${width}x${height}). 가로·세로 모두 64픽셀 이상이어야 해요.`;
  }
  const pixels = width * height;
  if (pixels < ST_MIN_PIXELS)  return `사진 해상도가 너무 낮아요(${width}x${height}).`;
  if (pixels > ST_MAX_PIXELS)  return `사진 해상도가 너무 높아요(${width}x${height}). 긴 변이 3000픽셀 이하가 되도록 줄여주세요.`;
  const aspect = Math.max(width / height, height / width);
  if (aspect > ST_MAX_ASPECT) {
    return `사진 비율이 너무 길쭉해요(${width}x${height}). 가로:세로가 2.5:1 이내인 사진을 올려주세요.`;
  }
  return null;
}

function parseStabilityError(status, raw) {
  let detail;
  try {
    const j = JSON.parse(raw);
    detail = Array.isArray(j?.errors) && j.errors.length ? j.errors.join(' / ') : (j?.name || j?.message || '');
  } catch { detail = (raw || '').slice(0, 300); }
  if (status === 401 || status === 403) {
    if (status === 403) return '요청이 콘텐츠 정책에 걸렸어요. 다른 사진이나 다른 문구로 다시 시도해주세요.';
    return 'Stability 인증에 실패했어요. API 키를 확인해주세요.';
  }
  if (status === 413) return '사진 용량이 너무 커요(10MB 초과). 더 작은 사진으로 다시 시도해주세요.';
  if (status === 429) return '요청이 몰렸어요. 잠시 후 다시 시도해주세요.';
  if (status === 402 || /balance|credit/i.test(detail)) return 'Stability 크레딧이 부족해요.';
  return `이미지 생성 실패 (${status})${detail ? `: ${detail}` : ''}`;
}

// 성공 시 { dataUrl, seed, finishReason } 반환. 실패는 throw.
async function submitStabilityStructure({ imageData, prompt, negativePrompt, controlStrength, outputFormat = 'jpeg', seed, apiKey }) {
  const decoded = decodeImagePayload(imageData);
  if (!decoded) throw new Error('입력 이미지가 없습니다.');

  const invalid = validateStabilityImage(decoded.buffer);
  if (invalid) throw new Error(invalid);

  const form = new FormData();
  // multipart 파트명/파일명은 스펙 그대로. content-type 헤더는 직접 넣지 않는다(boundary 자동 생성).
  form.append('image', new Blob([decoded.buffer], { type: decoded.mime }), 'input.jpg');
  form.append('prompt', String(prompt || '').slice(0, 10000));
  form.append('control_strength', String(controlStrength));
  form.append('output_format', outputFormat);
  if (negativePrompt) form.append('negative_prompt', String(negativePrompt).slice(0, 10000));
  if (typeof seed === 'number' && seed > 0) form.append('seed', String(seed));

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(STABILITY_STRUCTURE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      body: form,
      signal: ac.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('이미지 생성이 시간 내에 끝나지 않았어요. 잠시 후 다시 시도해주세요.', { cause: err });
    }
    throw new Error(err?.message || 'Stability 요청 실패', { cause: err });
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  if (!res.ok) throw new Error(parseStabilityError(res.status, raw));

  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Stability 응답을 해석하지 못했습니다.'); }
  if (data?.finish_reason === 'CONTENT_FILTERED') {
    throw new Error('생성 결과가 콘텐츠 필터에 걸렸어요. 다른 사진이나 문구로 다시 시도해주세요.');
  }
  if (!data?.image) throw new Error('Stability 응답에 이미지가 없습니다.');

  const mime = outputFormat === 'png' ? 'image/png' : outputFormat === 'webp' ? 'image/webp' : 'image/jpeg';
  return {
    buffer: Buffer.from(data.image, 'base64'),
    mime,
    dataUrl: `data:${mime};base64,${data.image}`,
    seed: data.seed,
    finishReason: data.finish_reason || '',
  };
}

// ── 생성 결과를 Blobs에 저장하고 짧은 URL을 돌려준다 ─────────
// 실패하면 null. 호출부는 그때만 data URI로 폴백한다(이미지를 잃지 않는 게 우선).
// 자세한 이유는 netlify/functions/rebrand-image.js 주석 참고.
async function storeGeneratedImage(buffer, contentType) {
  try {
    const key = crypto.randomUUID().replace(/-/g, '');
    const store = getStore({ name: 'rebrand-images', consistency: 'strong' });
    await store.set(key, buffer, { metadata: { contentType } });
    return `/.netlify/functions/rebrand-image?key=${key}`;
  } catch (err) {
    console.error('rebrand-image 저장 실패 — data URI로 폴백:', err?.message);
    return null;
  }
}

// ── tier(1~5) → control_strength ────────────────────────────
// control_strength가 높을수록 입력 사진의 구조를 강하게 붙든다.
// tier 1(간판만 교체) = 최대한 그대로 → 0.9 / tier 5(전면 리모델링) = 스타일 여지를 더 줌 → 0.72.
// 0.7 밑으로는 내리지 않는다. 구조 보존이 이 엔진을 쓰는 이유 자체이기 때문.
const CONTROL_STRENGTH_BY_TIER = { 1: 0.9, 2: 0.85, 3: 0.82, 4: 0.78, 5: 0.72 };
function controlStrengthForTier(tier) {
  return CONTROL_STRENGTH_BY_TIER[tier] ?? 0.82;
}

// ── Structure Control 전용 프롬프트 ──────────────────────────
// Flux 편집 모드용 프롬프트(buildRebrandPrompt)와 목적이 다르다.
// Structure Control은 "구조는 이미 고정됐다"는 전제라서,
//   · "카메라 앵글을 맞춰라" / "FOOTPRINT ANCHOR" 같은 구조 유지 지시가 불필요하고
//   · "더 과감하게 바꿔라"는 압박도 뺄 수 있다(구조가 안 무너지므로 스타일은 마음껏 밀어도 됨).
// 대신 "완성된 장면이 어떻게 보여야 하는가"를 묘사하는 문장으로 쓴다.
const STRUCTURE_NEGATIVE_PROMPT = [
  'cluttered, messy, dirty, run-down, cheap plastic furniture, fluorescent office lighting',
  'cartoon, illustration, 3d render, cgi, painting, watermark, signature',
  'Korean text, Japanese text, Chinese text, readable lettering, gibberish text',
  'people, faces, crowds, distorted geometry, warped walls, blurry, low quality, overexposed',
].join(', ');

function buildStructurePrompt(imageType, rebrandContext, photoIndex = 0) {
  const {
    newBrandName = '', newConcept = '', overallMood = '',
    materials = [], colors = [], signatureSpot = '',
    changeScope = '', budget = '', budgetMemo = '',
  } = rebrandContext || {};

  const transform = getTransformLevel(changeScope, budget, budgetMemo);
  const tier      = transform.tier;
  const matStr    = materials.slice(0, 3).join(', ');
  const colorStr  = colors.slice(0, 2).join(', ');
  const isExterior = imageType === 'exterior';

  // 같은 매장의 여러 장을 만들 때 장면마다 초점을 달리한다(구조는 각 사진이 알아서 고정).
  const interiorFocus = [
    'Wide view of the main dining area.',
    'View across the dining room toward the seating.',
    'View of the signature feature area of the room.',
    'View of the seating and service area.',
    'Establishing view of the whole space.',
  ];

  const subject = isExterior
    ? `Photorealistic street-level photograph of the storefront of "${newBrandName || 'a restaurant'}"`
    : `Photorealistic interior photograph of "${newBrandName || 'a restaurant'}"`;

  const lines = [
    `${subject}, a ${newConcept || 'restaurant'}.`,
    isExterior ? '' : interiorFocus[photoIndex % interiorFocus.length],
    overallMood ? `Atmosphere: ${overallMood}.` : '',
    ``,
    // 구조는 고정돼 있으니, tier 문구는 "무엇을 새로 그릴지"의 범위로만 읽히면 된다.
    `RENOVATION SCOPE (${transform.label}): ${isExterior ? transform.exterior : transform.interior}`,
    ``,
    // tier 1은 "간판·소품만 교체" 수준이므로 새 팔레트를 공간 전체에 풀면 안 된다.
    // Flux 쪽 materialColorLines()와 같은 규칙을 그대로 따른다.
    ...(tier <= 1
      ? [colorStr ? `Apply the new brand color palette (${colorStr}) to the signage and small accent items only; keep the existing wall, floor, and furniture colors.` : '']
      : [matStr   ? `Materials: ${matStr}.` : '',
         colorStr ? `Color palette: ${colorStr}.` : '']),
    !isExterior && signatureSpot && tier >= 2 ? `Signature feature: ${signatureSpot}.` : '',
    transform.memoStr || '',
    ``,
    isExterior
      ? 'Professional architectural photography, premium commercial quality, natural daylight, sharp and clean.'
      : 'Professional commercial interior photography, magazine quality, warm layered lighting, sharp and clean, 4K detail.',
    'Freshly renovated and immaculate.',
    NO_KOREAN_TEXT,
    'No people. No readable text or signage lettering.',
  ].filter(Boolean);

  return {
    prompt: lines.join(' '),
    negativePrompt: STRUCTURE_NEGATIVE_PROMPT,
    controlStrength: controlStrengthForTier(tier),
    tier,
    label: transform.label,
  };
}

// ── 엔진 선택 ────────────────────────────────────────────────
// 공간 사진(interior/exterior)만 Stability로 보낸다. 이유는 파일 상단 주석 참고.
const STABILITY_IMAGE_TYPES = ['interior', 'exterior'];
function shouldUseStability(imageType, hasInputImage, stabilityApiKey) {
  return Boolean(stabilityApiKey) && hasInputImage && STABILITY_IMAGE_TYPES.includes(imageType);
}

// ── 변화범위 + 예산 → 변환 강도(tier 1~5) ────────────────────
function getTransformLevel(changeScope, budget, budgetMemo) {
  const memo = (budgetMemo||'').toLowerCase();
  const noConstruction = memo.includes('공사') && (memo.includes('못')||memo.includes('안')||memo.includes('없'));
  const memoHints = [];
  if (noConstruction)                              memoHints.push('NO construction work allowed — cosmetic changes only.');
  if (memo.includes('소품'))                       memoHints.push('Focus on decorative props changes.');
  if (memo.includes('조명'))                       memoHints.push('Lighting upgrade is a priority.');
  if (memo.includes('메뉴판')||memo.includes('메뉴 판')) memoHints.push('Menu board redesign included.');
  if (memo.includes('간판'))                       memoHints.push('Signage replacement is the key change.');
  if (memo.includes('페인트')||memo.includes('도색')) memoHints.push('Wall painting/color change included.');
  if (memo.includes('테이블')||memo.includes('의자')||memo.includes('가구')) memoHints.push('Furniture replacement included.');
  if (memo.includes('바닥'))                       memoHints.push('Flooring replacement included.');
  const amountMatch = memo.match(/(\d+)만원/);
  if (amountMatch)                                 memoHints.push(`Budget ~${amountMatch[1]}만원.`);
  const memoStr = memoHints.length > 0 ? `USER NOTES: ${memoHints.join(' ')}` : '';

  if (changeScope === 'sign' || noConstruction) return {
    tier: 1, label: '간판·소품 교체 수준',
    interior: 'Keep the furniture, tables, chairs, flooring, and wall color close to the input photo — do not do a full redesign. Change: signage text/design, accent lighting color, and small decorative items.',
    exterior: 'Keep the building structure, facade color, and awning close to the input photo. Change: the signage/logo design and small brand elements near the entrance.',
    menu:     'Keep the plate and plating style close to the input photo. Change: plate/surface color to match the new brand palette.',
    memoStr,
  };
  if (changeScope === 'partial') return {
    tier: 2, label: '부분 리뉴얼 수준',
    interior: 'Keep the building structure, floor plan, and window/door positions from the input photo. Replace: all chairs and tables, all lighting fixtures, wall color/wallpaper, wall art, signage, decorative items.',
    exterior: 'Keep the building structure and shape from the input photo. Replace: signage, awning/canopy, exterior paint color, entrance door design.',
    menu:     'Same food item as the input photo. New plate/bowl style and material, new background surface, new garnish and sauce presentation.',
    memoStr,
  };
  if (changeScope === 'full') return {
    tier: 4, label: '전면 리모델링 수준',
    interior: 'Keep only the room footprint shape and window/door opening positions from the input photo — everything else is a bold, complete redesign: new flooring, new wall treatment, new ceiling, all new lighting, all new furniture, all new decor. Make it look like a completely different premium restaurant.',
    exterior: 'Keep only the building footprint shape from the input photo — everything else is a bold, complete redesign: new facade materials, new colors, new signage, new awning, new entrance, new window frames, new exterior lighting.',
    menu:     'Keep only the food type (same dish as input photo) — everything else is a bold reinvention: new plating style, new vessel, new arrangement, new garnish, new background.',
    memoStr,
  };
  if (budget.includes('500만원 미만')||budget.includes('500만 미만')) return {
    tier: 1, label: '500만원 미만 (소품·간판)',
    interior: 'Keep the major elements close to the input photo. Change: signage, small accent items, ambient lighting color.',
    exterior: 'Change only the signage/logo, keep the rest close to the input photo.',
    menu:     'Same plate and arrangement as input photo. Only change plate color or small garnish.',
    memoStr,
  };
  if (budget.includes('500~1,000')||budget.includes('1,000만')) return {
    tier: 2, label: '500~1,000만원 (조명·도색·간판)',
    interior: 'Keep furniture and flooring close to the input photo. Replace: all lighting fixtures, wall paint color, signage, decorative items.',
    exterior: 'New signage, new exterior paint color, updated entrance elements. Keep the building shape.',
    menu:     'New plate/bowl with an updated presentation and fresh garnish.',
    memoStr,
  };
  if (budget.includes('1,000~3,000')||budget.includes('3,000만')) return {
    tier: 3, label: '1,000~3,000만원 (가구·조명·벽)',
    interior: 'Keep the room layout from the input photo. Boldly replace: all furniture, all lighting, wall color/treatment, flooring accent, signage — a clearly noticeable, major interior redesign.',
    exterior: 'Keep the building shape. Boldly new: signage, awning, paint, entrance, window frames.',
    menu:     'Clearly new plating: new plate/vessel, new arrangement, new garnish approach.',
    memoStr,
  };
  if (budget.includes('3,000~5,000')||budget.includes('5,000만')) return {
    tier: 4, label: '3,000~5,000만원 (대규모 리뉴얼)',
    interior: 'Keep only the structural footprint from the input photo — completely replace furniture, flooring, walls, ceiling treatment, all lighting. Premium, dramatic transformation.',
    exterior: 'Keep only the building footprint — completely new facade materials, signage, awning, entrance, exterior lighting.',
    menu:     'Premium reinvention: Michelin-star level new plating, premium vessel, artistic arrangement.',
    memoStr,
  };
  if (budget.includes('5,000만원 이상')||budget.includes('5,000만 이상')) return {
    tier: 5, label: '5,000만원 이상 (전면 변환)',
    interior: 'Keep only the camera angle and room footprint from the input photo — everything else is completely new and premium: new flooring, walls, ceiling, furniture, lighting, decor.',
    exterior: 'Keep only the building footprint — completely new premium facade design.',
    menu:     'Complete premium reinvention — everything about the presentation is new and professional.',
    memoStr,
  };
  return {
    tier: 3, label: '기본 리브랜딩',
    interior: 'Keep the room layout and building structure from the input photo. Boldly replace furniture, lighting fixtures, wall colors, signage, decorative elements.',
    exterior: 'Keep the building shape. New signage, updated colors, entrance refresh.',
    menu:     'Same food as input photo. Clearly new plate and presentation style.',
    memoStr,
  };
}

// tier <=1: 재질/컬러는 signage·소품 등 "허용된 요소"에만 한정.
// tier >=2: 실제 교체 대상 요소(가구/벽 등)에 새 소재·컬러 적용.
function materialColorLines(tier, matStr, colorStr, kind) {
  if (tier <= 1) {
    const scopeNote = kind === 'menu' ? 'the plate/surface only' : kind === 'exterior' ? 'the signage only' : 'the signage and small accent items only';
    const lines = [];
    if (colorStr) lines.push(`Apply the new brand color palette (${colorStr}) to ${scopeNote}.`);
    return lines;
  }
  const lines = [];
  if (matStr)   lines.push(`New materials for the replaced elements: ${matStr}.`);
  if (colorStr) lines.push(`New color palette for the replaced elements: ${colorStr}.`);
  return lines;
}

// tier가 낮으면(1) "차분한 편집" 톤, tier가 2 이상이면 "브랜드보스급 과감한 재창조" 톤.
function openingLine(tier, kind) {
  const subject = kind==='menu' ? 'food photo' : kind==='exterior' ? 'street-level exterior photo of a restaurant' : 'interior photo of a restaurant';
  if (tier >= 2) {
    return `Use this ${subject} ONLY as the visual reference for shape, geometry, and camera angle — beyond that, treat this as a full creative redesign, not an edit. BOLDLY reimagine it as a premium, professionally redesigned space, the kind of dramatic "before/after" transformation seen in high-end renovation photography and interior design magazines. Push every changeable element hard: if in doubt, change MORE, not less. A result that still looks like "the same place with a few tweaks" is a FAILURE — the viewer must react with "wow, this same building became THIS." Only the elements explicitly protected under FOOTPRINT ANCHOR below may stay recognizable; everything else should look freshly, dramatically redesigned.`;
  }
  return `Use this ${subject} as the visual reference and make small, targeted edits — do NOT redesign it beyond what TRANSFORMATION LEVEL below specifies.`;
}

// ★ 핵심: 사진 타입(exterior/interior/menu) 별로 완전히 다른 프롬프트
// 반환값: { finalPrompt, tier }
function buildRebrandPrompt(imageType, rebrandContext, photoIndex = 0) {
  const {
    newBrandName='', newConcept='', overallMood='',
    materials=[], colors=[], signatureSpot='',
    changeScope='', budget='', budgetMemo='',
    rawMenu='',
  } = rebrandContext || {};
  const matStr   = materials.slice(0,3).join(', ');
  const colorStr = colors.slice(0,2).join(', ');
  const transform = getTransformLevel(changeScope, budget, budgetMemo);
  const tier = transform.tier;

  // ── 메뉴 사진 ────────────────────────────────────────────
  if (imageType === 'menu') {
    const platingStyles = [
      { style:'Minimalist Japanese', desc:'pure white ceramic, geometric zen arrangement, microgreens, maximum negative space, precision sauce drops' },
      { style:'Nordic fine dining',  desc:'earthy matte ceramic, organic arrangement, edible wildflowers, smear sauce, foraged elements' },
      { style:'French bistro',       desc:'rustic copper pan or cream ceramic, hearty rustic presentation, fresh herb garnish, golden sauce' },
      { style:'Korean fusion',       desc:'dark slate plate, high-contrast bold presentation, sesame oil gloss, scallion julienne' },
      { style:'Modern deconstructed',desc:'multiple small vessels, deconstructed components spread artfully, colorful sauce dots' },
    ];
    const ps = platingStyles[photoIndex % platingStyles.length];
    const mcLines = materialColorLines(tier, matStr, colorStr, 'menu');
    const finalPrompt = [
      openingLine(tier, 'menu'),
      `FOOD ANCHOR (do not violate): the dish is "${rawMenu || 'the exact food shown in the reference photo'}". Keep it unmistakably the same dish — same main ingredients, same identity — only the plating/vessel/styling changes.`,
      `Match the camera angle and perspective of the reference photo (overhead, side, or 3/4 angle).`,
      ``,
      `TRANSFORMATION LEVEL (${transform.label}): ${transform.menu}`,
      tier >= 2 ? `NEW PLATING STYLE (${photoIndex+1}/5): ${ps.style} — ${ps.desc}` : '',
      ``,
      `Brand: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
      ...mcLines,
      transform.memoStr ? transform.memoStr : '',
      ``,
      `Studio/clean background, no restaurant interior visible. Professional food photography. 4K ultra-detailed. Perfect lighting.`,
      NO_KOREAN_TEXT, `No people. No text.`,
    ].filter(Boolean).join(' ');
    return { finalPrompt, tier };
  }

  // ── 외관 사진 ────────────────────────────────────────────
  if (imageType === 'exterior') {
    const mcLines = materialColorLines(tier, matStr, colorStr, 'exterior');
    const finalPrompt = [
      openingLine(tier, 'exterior'),
      `Match the street-level camera angle, perspective, and framing of the reference photo.`,
      `FOOTPRINT ANCHOR (keep constant): building shape, footprint, number of floors, and street position must match the reference photo.`,
      ``,
      `TRANSFORMATION LEVEL (${transform.label}): ${transform.exterior}`,
      ``,
      `NEW BRAND: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
      ...mcLines,
      transform.memoStr ? transform.memoStr : '',
      ``,
      `Same street, same surroundings, same perspective as the reference — but the transformation above must be clearly, obviously visible.`,
      `Photorealistic architectural photography, premium commercial quality. Daytime, natural lighting.`,
      NO_KOREAN_TEXT, `No people. No text on building.`,
    ].filter(Boolean).join(' ');
    return { finalPrompt, tier };
  }

  // ── 내부 사진 (interior) ──────────────────────────────────
  const cameraAngles = [
    'Match the wide-angle view and camera height of the reference photo.',
    'Match the camera angle, perspective depth, and field of view of the reference photo.',
    'Match the framing, shooting direction, and focal length of the reference photo.',
    'Match the composition and viewpoint of the reference photo.',
    'Match the establishing shot perspective of the reference photo.',
  ];
  const angleNote = cameraAngles[photoIndex % cameraAngles.length];
  const mcLines = materialColorLines(tier, matStr, colorStr, 'interior');

  const finalPrompt = [
    openingLine(tier, 'interior'),
    angleNote,
    `FOOTPRINT ANCHOR (keep constant): ceiling height, window positions, door locations, and room proportions must match the reference photo.`,
    ``,
    `TRANSFORMATION LEVEL (${transform.label}): ${transform.interior}`,
    ``,
    `NEW BRAND: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
    ...mcLines,
    signatureSpot && tier >= 2 ? `Feature: ${signatureSpot}.` : '',
    transform.memoStr ? transform.memoStr : '',
    ``,
    `Same space proportions and camera framing as the reference — but the transformation above must be clearly, obviously visible, not a subtle tweak.`,
    `Photorealistic commercial interior, premium magazine-quality photography. Professional lighting. 4K quality.`,
    NO_KOREAN_TEXT, `No people. No text.`,
  ].filter(Boolean).join(' ');
  return { finalPrompt, tier };
}

function detectSectionType(sectionPrompt) {
  const p = sectionPrompt.toLowerCase();
  if (p.includes('section_type:menu_plating'))   return 'menu';
  if (p.includes('section_type:staff_uniform'))  return 'service';
  if (p.includes('section_type:props_detail'))   return 'prop';
  if (p.includes('section_type:space_interior')) return 'space';
  if (p.includes('food plating')||p.includes('plating')) return 'menu';
  if (p.includes('staff uniform')||p.includes('uniform')) return 'service';
  return 'space';
}

function extractMenuType(bd, pkg) {
  const combined = ((bd.storeConcept||'')+' '+(bd.menuDirection||'')).toLowerCase();
  if (combined.match(/생선|fish|seafood/)) return 'grilled whole fish';
  if (combined.match(/돼지|pork|삼겹|갈비/)) return 'Korean pork BBQ';
  if (combined.match(/소고기|beef|한우/)) return 'Korean beef BBQ';
  if (combined.match(/치킨|chicken|닭/)) return 'Korean fried chicken';
  if (combined.match(/파스타|pasta/)) return 'pasta';
  if (combined.match(/초밥|sushi|일식/)) return 'sushi';
  if (combined.match(/디저트|dessert|카페/)) return 'Korean dessert';
  return (bd.storeConcept||'').substring(0,60)||'restaurant dish';
}

function buildSectionFinalPrompt(sectionType, brandContext, themeBlock, editRequest, sceneIndex) {
  const { storeConcept='', menuDirection='', serviceDirection='', propDirection='', overallMood='', menuType='' } = brandContext;
  const neg = 'cartoon, illustration, watermark, Korean text, Japanese text, readable text, distorted, low quality, overexposed, generic, cheap';
  if (editRequest?.trim()) return { finalPrompt:`MOST IMPORTANT: ${editRequest}. Consistent with: ${storeConcept}. ${overallMood}. ${themeBlock}. ${NO_KOREAN_TEXT}. Photorealistic.`, negativePrompt:neg };
  let finalPrompt;
  switch (sectionType) {
    case 'menu':
      finalPrompt = ['OVERHEAD BIRD\'S EYE VIEW.','EXTREME CLOSE-UP: plate 80-90% of frame.',NO_KOREAN_TEXT,
        brandContext.rawMenu?`DISH: "${brandContext.rawMenu}".`:'',menuType?`Food: "${menuType}".`:'',
        menuDirection?`Style: ${menuDirection}.`:'',storeConcept?`Restaurant: ${storeConcept}.`:'',
        themeBlock?`Theme: ${themeBlock}`:'','Michelin-star plating. Studio lighting.'].filter(Boolean).join(' '); break;
    case 'service':
      finalPrompt = [`Professional staff uniform. ${NO_KOREAN_TEXT}`,storeConcept?`Restaurant: ${storeConcept}.`:'',serviceDirection?`Direction: ${serviceDirection}.`:'',overallMood?`Mood: ${overallMood}.`:'','2-3 staff in uniform.'].filter(Boolean).join(' '); break;
    case 'prop':
      finalPrompt = [`Close-up interior props. ${NO_KOREAN_TEXT}`,storeConcept?`Concept: ${storeConcept}.`:'',propDirection?`Props: ${propDirection}.`:'',themeBlock?`Theme: ${themeBlock}`:'','Bokeh background.'].filter(Boolean).join(' '); break;
    default: {
      const idx=typeof sceneIndex==='number'?sceneIndex:0;
      const block=['CONSISTENCY: SAME restaurant.',brandContext.materials?.join(', ')?`Materials: ${brandContext.materials.join(', ')}.`:'',brandContext.colors?.join(', ')?`Colors: ${brandContext.colors.join(', ')}.`:'',overallMood?`Mood: ${overallMood}.`:'',themeBlock||''].filter(Boolean).join(' ');
      const base=[storeConcept?`Restaurant: "${storeConcept}".`:'',NO_KOREAN_TEXT,'No people. No text. Photorealistic.'].filter(Boolean).join(' ');
      if (idx===0)      finalPrompt=`${block} SHOT 1/3: Wide-angle from entrance. ${base}`;
      else if (idx===1) finalPrompt=`${block} SHOT 2/3: From back toward entrance. ${base}`;
      else              finalPrompt=`${block} SHOT 3/3: Signature zone${brandContext.signatureSpot?`: "${brandContext.signatureSpot}"`:''}. ${base}`;
    }
  }
  return { finalPrompt, negativePrompt:neg };
}

function buildDefaultPrompt(payload, referenceVisuals) {
  const pkg = payload?.interiorImagePackage || {};
  const bd  = payload?.brandDecision        || {};
  const brandName = clean(pkg.selectedBrandName)||clean(bd.brandName)||'브랜드';
  const concept   = clean(pkg.selectedConcept)||clean(bd.storeConcept)||'';
  const mood      = clean(pkg.moodTone)||clean(bd.overallMood)||'';
  const rawSize   = clean(pkg.storeSize)||clean(bd.storeSize)||'20평대';
  const storeSize = convertStoreSizeToEnglish(rawSize)||rawSize;
  const materials = safeArray(pkg.materialKeywords).map(clean).filter(Boolean);
  const colors    = safeArray(pkg.colorKeywords).map(clean).filter(Boolean);
  const furniture = safeArray(pkg.furnitureKeywords).map(clean).filter(Boolean);
  const masterPrompt = [
    'Photorealistic commercial restaurant interior photography.', NO_KOREAN_TEXT,
    `Brand: ${brandName}.`, concept?`Concept: ${concept}.`:'',
    referenceVisuals?`CRITICAL THEME: ${referenceVisuals}.`:'',
    `STORE SIZE: ${storeSize}`, mood?`Mood: ${mood}.`:'',
    materials.length?`Materials: ${materials.join(', ')}.`:'',
    colors.length?`Colors: ${colors.join(', ')}.`:'',
    furniture.length?`Furniture: ${furniture.join(', ')}.`:'',
    'Wide-angle, eye-level, realistic commercial lighting, premium atmosphere, no people, no text.',
  ].filter(Boolean).join(' ');
  return { brandName, concept, masterPrompt, negativePrompt:'cartoon, illustration, watermark, text, Korean text, distorted, low quality, generic, cheap', storeSize:rawSize, mood };
}

export default async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse(200, { ok:true });
  if (req.method !== 'POST')    return jsonResponse(405, { error:'POST만 허용됩니다.' });

  const payload = safeParse(await req.text().catch(() => ''));
  if (!payload) return jsonResponse(400, { error:'잘못된 JSON' });

  const fluxApiKey      = process.env.FLUX_API_KEY;
  const geminiApiKey    = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const stabilityApiKey = process.env.STABILITY_API_KEY;

  if (!fluxApiKey) return jsonResponse(200, { ok:true, dataUrl:buildFallbackSvg({}), model:'svg-fallback', warning:'FLUX_API_KEY 없음' });

  const directPrompt   = clean(payload.directPrompt);
  const inputImage     = payload.inputImage     || null;
  const rebrandContext = payload.rebrandContext  || null;
  // ★ imageType은 프론트에서 반드시 명시적으로 전달해야 함: 'interior' | 'exterior' | 'menu'
  const imageType      = clean(payload.imageType) || 'interior';
  const photoIndex     = typeof payload.photoIndex === 'number' ? payload.photoIndex : 0;

  // ★ NEW: 정밀 수정 모드 — 이미 생성된 이미지에 텍스트 요청 한 가지만 반영, 나머지는 완전 유지.
  // tier/변화강도 로직과 무관하게 항상 가장 보수적으로 동작 (prompt_upsampling도 끔).
  const editRequest      = clean(payload.editRequest);
  const editBaseImageUrl = clean(payload.editBaseImageUrl);
  if (editRequest && (editBaseImageUrl || inputImage)) {
    try {
      const baseImage = inputImage || await fetchImageAsBase64(editBaseImageUrl);
      const editPrompt = buildPreciseEditPrompt(editRequest, imageType);
      const pollingUrl = await submitFlux2Pro(editPrompt, fluxApiKey, { inputImageBase64: baseImage, promptUpsampling: false });
      return jsonResponse(200, { ok:true, pollingUrl, model:'flux-2-pro (precise-edit)', warning:'' });
    } catch (err) {
      return jsonResponse(200, { ok:false, error: err?.message || '이미지 수정 실패',
        fallbackResult:{ dataUrl:'', model:'none' } });
    }
  }

  // ── ★ 5차: 공간 사진(interior/exterior)은 Stability Structure Control로 구조를 고정한 채 재생성 ──
  // 동기 호출이라 pollingUrl 없이 dataUrl을 바로 돌려준다(프론트는 두 형태를 모두 처리).
  if (inputImage && rebrandContext && shouldUseStability(imageType, true, stabilityApiKey)) {
    const { prompt, negativePrompt, controlStrength, tier, label } =
      buildStructurePrompt(imageType, rebrandContext, photoIndex);
    try {
      const { buffer, mime, dataUrl, seed } = await submitStabilityStructure({
        imageData: inputImage,
        prompt, negativePrompt, controlStrength,
        outputFormat: 'jpeg',
        apiKey: stabilityApiKey,
      });
      // 저장에 성공하면 짧은 URL만 넘긴다(응답 ~1KB). 실패하면 data URI로 폴백(응답 ~0.7MB).
      const imageUrl = await storeGeneratedImage(buffer, mime);
      return jsonResponse(200, {
        ok: true,
        ...(imageUrl ? { imageUrl } : { dataUrl }),
        model: 'stability-structure', engine: 'stability',
        controlStrength, tier, tierLabel: label, seed, prompt, warning: '',
      });
    } catch (err) {
      // 실패 시 크레딧이 헛되이 나가지 않도록 ok:false + fallbackResult 패턴
      // (프론트는 ok:false를 보면 차감을 건너뛰고 fallbackResult를 자리표시자로 쓴다)
      return jsonResponse(200, {
        ok: false,
        error: err?.message || '이미지 생성 실패',
        engine: 'stability',
        fallbackResult: {
          dataUrl: buildFallbackSvg({ brandName: rebrandContext.newBrandName || '', concept: rebrandContext.newConcept || '' }),
          model: 'svg-fallback',
        },
      });
    }
  }

  if (directPrompt) {
    try {
      let pollingUrl;
      if (inputImage && rebrandContext) {
        const { finalPrompt, tier } = buildRebrandPrompt(imageType, rebrandContext, photoIndex);
        // ★ flux-2-pro를 편집 모드(input_image)로 사용 — Kontext보다 훨씬 과감한 결과
        pollingUrl = await submitFlux2Pro(finalPrompt, fluxApiKey, { inputImageBase64: inputImage, promptUpsampling: true });
      } else {
        // ★ 2026-08-27: 소품 카드에서 "부각시킬 소품"을 지정했으면 여기서 붙인다.
        //   프롬프트 조립을 프론트에 두고 이 문장만 서버에서 붙이는 이유는 번역 때문이다.
        //   키(GEMINI_API_KEY)는 서버에만 있고, 번역 없이 한국어를 실으면 안 먹는다.
        const propFocusEn = await translatePropFocus(payload.propFocus, geminiApiKey);
        const finalDirect = propFocusEn
          ? `${directPrompt} MOST CRITICAL: the hero props to feature are ${propFocusEn}. Put these closest to the camera, fully lit, sharp and unobstructed. They must be the first thing the eye lands on.`
          : directPrompt;
        pollingUrl = await submitFlux2Pro(finalDirect, fluxApiKey);
      }
      return jsonResponse(200, { ok:true, pollingUrl, model:inputImage?'flux-2-pro (edit)':'flux-2-pro', warning:'' });
    } catch (err) {
      return jsonResponse(200, { ok:false, error:err?.message||'Flux 요청 실패',
        fallbackResult:{ dataUrl:buildFallbackSvg({}), model:'svg-fallback' } });
    }
  }

  // sectionPrompt 방식 (브랜드보스 기존 방식 — 사진 없이 처음부터 생성)
  const sectionPrompt  = clean(payload.sectionPrompt);
  const negativePrompt = clean(payload.negativePrompt);
  // (editRequest는 위에서 이미 선언됨 — 정밀수정 분기에서 안 걸렸다면 여기선 보통 빈 문자열)
  const sceneIndex     = typeof payload.sceneIndex==='number' ? payload.sceneIndex : -1;
  const bd  = payload?.brandDecision        || {};
  const pkg = payload?.interiorImagePackage || {};
  const brandContext = {
    brandName:clean(bd.brandName)||clean(pkg.selectedBrandName)||'',
    storeConcept:clean(bd.storeConcept)||clean(pkg.selectedConcept)||'',
    menuDirection:clean(bd.menuDirection)||'', serviceDirection:clean(bd.serviceDirection)||'',
    propDirection:clean(bd.propDirection)||'', overallMood:clean(bd.overallMood)||clean(pkg.moodTone)||'',
    menuType:extractMenuType(bd, pkg),
    storeSize:clean(payload.formData?.storeSize)||clean(pkg.storeSize)||'',
    materials:safeArray(pkg.materialKeywords).map(clean).filter(Boolean),
    colors:safeArray(pkg.colorKeywords).map(clean).filter(Boolean),
    furniture:safeArray(pkg.furnitureKeywords).map(clean).filter(Boolean),
    signatureSpot:clean(pkg.signatureSpot)||'',
    rawMenu:clean(payload.formData?.menu)||'',
    rawCategory:clean(payload.formData?.category)||'',
    rawOwnerStyle:clean(payload.formData?.ownerStyle)||'',
  };
  const referenceStyle = clean(payload.referenceStyle)||'';
  if (sectionPrompt) {
    let refVisuals = clean(payload.cachedRefVisuals)||'';
    if (!refVisuals && referenceStyle && geminiApiKey) refVisuals = await translateReferenceToVisuals(referenceStyle, geminiApiKey);
    const themeBlock  = refVisuals?`CRITICAL THEME (${referenceStyle}): ${refVisuals}`:'';
    const sectionType = detectSectionType(sectionPrompt);
    const { finalPrompt, negativePrompt:negBase } = buildSectionFinalPrompt(sectionType, brandContext, themeBlock, editRequest, sceneIndex);
    const neg = negativePrompt||negBase;
    let sceneInfo = null;
    if (sectionType==='space' && sceneIndex>=0 && geminiApiKey) sceneInfo = await generateSceneDescription(sceneIndex, brandContext, themeBlock, geminiApiKey);
    try {
      const pollingUrl = await submitFluxTxt2Img(finalPrompt, fluxApiKey);
      return jsonResponse(200, { ok:true, brandName:brandContext.brandName||'브랜드', pollingUrl, prompt:finalPrompt, negativePrompt:neg, referenceStyle, referenceVisuals:refVisuals, brandContext, sectionType, sceneInfo, model:'flux-2-pro', warning:'' });
    } catch (err) {
      return jsonResponse(200, { ok:true, brandName:brandContext.brandName, dataUrl:buildFallbackSvg({brandName:brandContext.brandName,concept:brandContext.storeConcept}), model:'svg-fallback', warning:err?.message||'Flux 요청 실패' });
    }
  }
  let referenceVisuals='';
  if (referenceStyle && geminiApiKey) referenceVisuals = await translateReferenceToVisuals(referenceStyle, geminiApiKey);
  const promptInfo = buildDefaultPrompt(payload, referenceVisuals);
  try {
    const pollingUrl = await submitFluxTxt2Img(promptInfo.masterPrompt, fluxApiKey);
    return jsonResponse(200, { ok:true, brandName:promptInfo.brandName, pollingUrl, prompt:promptInfo.masterPrompt, negativePrompt:promptInfo.negativePrompt, referenceStyle, referenceVisuals, model:'flux-2-pro', warning:'' });
  } catch (err) {
    return jsonResponse(200, { ok:true, brandName:promptInfo.brandName, dataUrl:buildFallbackSvg(promptInfo), model:'svg-fallback', warning:err?.message||'Flux 요청 실패' });
  }
};