// netlify/functions/generate-interior.js
// Flux 2 Pro (txt2img) 단일 파이프라인
// ESM: export const handler
//
// ★★★ 구조 변경 (2026-07-07) ★★★
// 기존: 리브랜드 시 Flux Kontext Pro(img2img)로 원본 사진을 "편집" → 보수적/일관성 없는 결과.
// 변경: 브랜드보스와 동일하게 Flux 2 Pro(txt2img)로 "새로 생성"하되, 생성 직전에
//       Gemini Vision으로 원본 사진에서 "건물/공간의 고정 구조"(층수, 창문 위치, 룸 형태,
//       카메라 앵글 / 메뉴는 실제 요리 정체성)만 뽑아내 프롬프트 최상단에 하드 제약으로 삽입.
//       → 브랜드보스 수준의 과감하고 완성도 높은 이미지 + 실제 매장 구조 보존을 동시에 달성.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}
function safeParse(body) { try { return JSON.parse(body || '{}'); } catch { return null; } }
function clean(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeArray(v) { return Array.isArray(v) ? v : []; }
function escapeXml(v) {
  return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{parts:[{text:`Describe interior design for "${referenceStyle}" in ONE paragraph: hex colors, materials, furniture, lighting. English only.`}]}], generationConfig:{temperature:0.5, maxOutputTokens:200, thinkingConfig:{thinkingBudget:0}} }) }
    );
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('').trim() || referenceStyle;
  } catch { return referenceStyle; }
}

async function generateSceneDescription(sceneIndex, brandContext, themeBlock, geminiApiKey) {
  const sceneNames = ['메인 다이닝 홀', '테이블 경험', '시그니처 존'];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{parts:[{text:`인테리어 디자인 제안서. 레스토랑 컨셉: ${brandContext.storeConcept||''}, 분위기: ${brandContext.overallMood||''}\n"${sceneNames[sceneIndex]||'장면'}" 제목과 설명 한국어로.\n형식:\n제목: []\n설명: []`}]}], generationConfig:{temperature:0.8, maxOutputTokens:150, thinkingConfig:{thinkingBudget:0}} }) }
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
function extractMimeType(imageData) {
  if (typeof imageData !== 'string') return 'image/jpeg';
  const m = imageData.match(/^data:(image\/\w+);/);
  return m?.[1] || 'image/jpeg';
}

async function submitFluxTxt2Img(prompt, fluxApiKey) {
  const res = await fetch('https://api.bfl.ai/v1/flux-2-pro', {
    method:'POST', headers:{'Content-Type':'application/json','x-key':fluxApiKey},
    body: JSON.stringify({ prompt, width:1440, height:960, output_format:'jpeg' }),
  });
  if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(JSON.stringify(e)||`Flux 실패 ${res.status}`); }
  const data = await res.json();
  if (!data.polling_url) throw new Error('polling_url 없음');
  return data.polling_url;
}

// ── ★ NEW: Gemini Vision으로 원본 사진의 "고정 구조"만 추출 ──────────
async function analyzePhotoStructure(imageType, inputImageBase64, geminiApiKey) {
  const b64 = extractBase64(inputImageBase64);
  if (!b64 || !geminiApiKey) return '';
  const mimeType = extractMimeType(inputImageBase64);

  const instructions = {
    interior: 'This is a real restaurant interior photo. Describe ONLY the fixed physical facts in ONE concise English paragraph (max 4 sentences): approximate room shape and proportions, ceiling height impression, window positions, door/entrance position, and the camera angle/framing of this shot. Do NOT mention colors, furniture style, materials, or decor — ONLY spatial facts a renovation could not easily change.',
    exterior: 'This is a real restaurant building exterior photo. Describe ONLY the fixed physical facts in ONE concise English paragraph (max 4 sentences): number of visible floors, building width/footprint impression, window arrangement, entrance position, the street-level camera angle/framing, and any fixed surrounding context (sidewalk, neighboring buildings). Do NOT mention colors, signage content, or decor — ONLY structural facts.',
    menu: 'This is a real food photo. Describe ONLY the dish identity in ONE concise English paragraph (max 3 sentences): the type/name of dish, the main visible ingredients, and the camera angle (overhead / side / 3-4 angle). Do NOT mention plate style or garnish styling — ONLY what the dish itself fundamentally is, so the same dish can be re-plated later without becoming a different dish.',
  };
  const instruction = instructions[imageType] || instructions.interior;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role:'user', parts: [
            { inlineData: { mimeType, data: b64 } },
            { text: instruction },
          ] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 220, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) return '';
    return data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('').trim() || '';
  } catch { return ''; }
}

// ── 변화범위 + 예산 → 어느 정도까지 새로 디자인할지 (창의적 강도) ──
function getTransformLevel(changeScope, budget, budgetMemo) {
  const memo = (budgetMemo||'').toLowerCase();
  const noConstruction = memo.includes('공사') && (memo.includes('못')||memo.includes('안')||memo.includes('없'));
  const memoHints = [];
  if (noConstruction)                              memoHints.push('Budget/construction is very limited — favor cosmetic-level changes (signage, lighting color, small decor) over structural-looking redesign.');
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
    interior: 'Redesign ONLY the signage, wall art/graphics, and small tabletop decor to match the new brand. Furniture, flooring, and wall color should stay close to a realistic version of what a small budget renovation would allow — understated, not a full redesign.',
    exterior: 'Redesign ONLY the signage/logo and small entrance accents. Facade material and color should remain close to a typical unrenovated building.',
    menu:     'Keep the plating simple and close to the original style — only refresh the plate color/surface to match the new brand palette.',
    memoStr,
  };
  if (changeScope === 'partial') return {
    tier: 2, label: '부분 리뉴얼 수준',
    interior: 'Fully redesign furniture (chairs, tables), lighting fixtures, wall color/wallpaper, wall art, and signage to match the new brand. Keep the redesign realistic for a mid-size renovation budget.',
    exterior: 'Redesign signage, awning/canopy, exterior paint color, and entrance door design to match the new brand.',
    menu:     'Redesign the plate/bowl style, background surface, and garnish/sauce presentation with a moderate, fresh new look.',
    memoStr,
  };
  if (changeScope === 'full') return {
    tier: 4, label: '전면 리모델링 수준',
    interior: 'Completely redesign flooring material and color, all wall treatment, ceiling design, all lighting fixtures, all furniture, and all decorative elements — transform into a completely different premium restaurant interior.',
    exterior: 'Completely redesign all facade materials, colors, signage, awning, entrance, window frames, and exterior lighting — make it look like a brand new premium restaurant.',
    menu:     'Completely reinvent the plating style, vessel material and color, food arrangement, garnish approach, and background — premium presentation.',
    memoStr,
  };
  if (budget.includes('500만원 미만')||budget.includes('500만 미만')) return {
    tier: 1, label: '500만원 미만 (소품·간판)',
    interior: 'Redesign ONLY the signage, small accent items, and ambient lighting color — keep it modest, matching a very small budget.',
    exterior: 'Redesign ONLY the signage/logo.',
    menu:     'Only refresh plate color or small garnish — keep it modest.',
    memoStr,
  };
  if (budget.includes('500~1,000')||budget.includes('1,000만')) return {
    tier: 2, label: '500~1,000만원 (조명·도색·간판)',
    interior: 'Redesign lighting fixtures, wall paint color, signage, and small decorative items. Keep furniture reasonably close to typical existing pieces (light renovation).',
    exterior: 'New signage, new exterior paint color, updated small entrance elements.',
    menu:     'New plate/bowl with an updated presentation and fresh garnish.',
    memoStr,
  };
  if (budget.includes('1,000~3,000')||budget.includes('3,000만')) return {
    tier: 3, label: '1,000~3,000만원 (가구·조명·벽)',
    interior: 'Fully redesign furniture, lighting, wall color/treatment, flooring accent, and signage — a major interior redesign.',
    exterior: 'New signage, new awning, new paint, entrance redesign, updated window frames.',
    menu:     'Full plating change: new plate/vessel, new arrangement, new garnish approach.',
    memoStr,
  };
  if (budget.includes('3,000~5,000')||budget.includes('5,000만')) return {
    tier: 4, label: '3,000~5,000만원 (대규모 리뉴얼)',
    interior: 'Completely replace furniture, flooring, walls, ceiling treatment, and all lighting — premium transformation.',
    exterior: 'New facade materials, complete signage redesign, new awning, entrance redesign, exterior lighting.',
    menu:     'Premium reinvention: Michelin-star level new plating, premium vessel, artistic arrangement.',
    memoStr,
  };
  if (budget.includes('5,000만원 이상')||budget.includes('5,000만 이상')) return {
    tier: 5, label: '5,000만원 이상 (전면 변환)',
    interior: 'Everything is completely new and premium — new flooring, walls, ceiling, furniture, lighting, decor.',
    exterior: 'Completely new premium facade design.',
    menu:     'Complete premium reinvention — everything about the presentation is new and professional.',
    memoStr,
  };
  return {
    tier: 3, label: '기본 리브랜딩',
    interior: 'Redesign furniture, lighting fixtures, wall colors, signage, and decorative elements.',
    exterior: 'New signage, updated colors, entrance refresh.',
    menu:     'New plate and presentation style.',
    memoStr,
  };
}

const PLATING_STYLES = [
  { style:'Minimalist Japanese', desc:'pure white ceramic, geometric zen arrangement, microgreens, maximum negative space, precision sauce drops' },
  { style:'Nordic fine dining',  desc:'earthy matte ceramic, organic arrangement, edible wildflowers, smear sauce, foraged elements' },
  { style:'French bistro',       desc:'rustic copper pan or cream ceramic, hearty rustic presentation, fresh herb garnish, golden sauce' },
  { style:'Korean fusion',       desc:'dark slate plate, high-contrast bold presentation, sesame oil gloss, scallion julienne' },
  { style:'Modern deconstructed',desc:'multiple small vessels, deconstructed components spread artfully, colorful sauce dots' },
];

const INTERIOR_SHOTS = [
  'Wide establishing shot from the entrance.',
  'Same space viewed from the back toward the entrance.',
  'Close-up of the signature zone/feature area.',
];

// ★ 핵심: 브랜드보스 스타일 txt2img 프롬프트 + 원본 사진의 구조 제약을 최상단에 하드 삽입
function buildStructuredCreativePrompt(imageType, rebrandContext, photoIndex, structureDesc) {
  const {
    newBrandName='', newConcept='', overallMood='',
    materials=[], colors=[], furniture=[], signatureSpot='',
    changeScope='', budget='', budgetMemo='', rawMenu='',
  } = rebrandContext || {};
  const matStr       = materials.slice(0,4).join(', ');
  const colorStr      = colors.slice(0,3).join(', ');
  const furnitureStr = (furniture||[]).slice(0,3).join(', ');
  const transform     = getTransformLevel(changeScope, budget, budgetMemo);

  if (imageType === 'menu') {
    const ps = PLATING_STYLES[photoIndex % PLATING_STYLES.length];
    return [
      structureDesc ? `DISH IDENTITY (must stay recognizably the same dish): ${structureDesc}` : (rawMenu?`DISH: "${rawMenu}" — keep it recognizably the same dish.`:''),
      'Photorealistic professional food photography with a completely new plating and presentation.',
      `Brand: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
      `TRANSFORMATION (${transform.label}): ${transform.menu}`,
      `Plating direction: ${ps.style} — ${ps.desc}.`,
      matStr    ? `Tableware materials: ${matStr}.` : '',
      colorStr  ? `Colors: ${colorStr}.` : '',
      transform.memoStr || '',
      'Studio/clean background, no restaurant interior visible. Professional food photography. 4K ultra-detailed. Perfect lighting.',
      NO_KOREAN_TEXT, 'No people. No text.',
    ].filter(Boolean).join(' ');
  }

  if (imageType === 'exterior') {
    return [
      structureDesc ? `BUILDING STRUCTURE (must match exactly — do not change the shape, floor count, or footprint): ${structureDesc}` : '',
      'Photorealistic architectural exterior photography. Completely redesign everything EXCEPT the structural facts above.',
      `New brand: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
      `TRANSFORMATION (${transform.label}): ${transform.exterior}`,
      matStr   ? `Facade materials: ${matStr}.` : '',
      colorStr ? `Color palette: ${colorStr}.` : '',
      transform.memoStr || '',
      'Daytime, natural lighting, premium commercial architectural photography, no people, no readable text on building.',
      NO_KOREAN_TEXT,
    ].filter(Boolean).join(' ');
  }

  // interior
  const shot = INTERIOR_SHOTS[photoIndex % INTERIOR_SHOTS.length];
  return [
    structureDesc ? `ROOM STRUCTURE (must match exactly — do not change the room shape, ceiling height, or window/door positions): ${structureDesc}` : '',
    `${shot} Photorealistic commercial restaurant interior photography. Completely redesign everything EXCEPT the structural facts above.`,
    `Brand: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
    `TRANSFORMATION (${transform.label}): ${transform.interior}`,
    matStr        ? `Materials: ${matStr}.` : '',
    colorStr      ? `Colors: ${colorStr}.` : '',
    furnitureStr  ? `Furniture: ${furnitureStr}.` : '',
    signatureSpot ? `Feature: ${signatureSpot}.` : '',
    transform.memoStr || '',
    'Wide-angle, eye-level, realistic commercial lighting, premium atmosphere, no people, no text.',
    NO_KOREAN_TEXT,
  ].filter(Boolean).join(' ');
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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok:true });
  if (event.httpMethod !== 'POST')    return jsonResponse(405, { error:'POST만 허용됩니다.' });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error:'잘못된 JSON' });

  const fluxApiKey   = process.env.FLUX_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!fluxApiKey) return jsonResponse(200, { ok:true, dataUrl:buildFallbackSvg({}), model:'svg-fallback', warning:'FLUX_API_KEY 없음' });

  const directPrompt   = clean(payload.directPrompt);
  const inputImage     = payload.inputImage     || null;
  const rebrandContext = payload.rebrandContext  || null;
  // ★ imageType은 프론트에서 반드시 명시적으로 전달해야 함: 'interior' | 'exterior' | 'menu'
  const imageType      = clean(payload.imageType) || 'interior';
  const photoIndex     = typeof payload.photoIndex === 'number' ? payload.photoIndex : 0;

  if (directPrompt) {
    try {
      let pollingUrl, model, finalPrompt, structureDesc = '';
      if (inputImage && rebrandContext) {
        // ★ 리브랜드: 원본 사진에서 구조만 추출 → 브랜드보스 스타일 txt2img로 새로 생성
        structureDesc = await analyzePhotoStructure(imageType, inputImage, geminiApiKey);
        finalPrompt   = buildStructuredCreativePrompt(imageType, rebrandContext, photoIndex, structureDesc);
        pollingUrl    = await submitFluxTxt2Img(finalPrompt, fluxApiKey);
        model = 'flux-2-pro+structure';
      } else {
        finalPrompt = directPrompt;
        pollingUrl  = await submitFluxTxt2Img(directPrompt, fluxApiKey);
        model = 'flux-2-pro';
      }
      return jsonResponse(200, { ok:true, pollingUrl, model, prompt:finalPrompt, structureDesc, warning:'' });
    } catch (err) {
      return jsonResponse(500, { ok:false, error:err?.message||'Flux 요청 실패' });
    }
  }

  // sectionPrompt 방식 (브랜드보스 기존 방식 — 사진 없이 처음부터 생성)
  const sectionPrompt  = clean(payload.sectionPrompt);
  const negativePrompt = clean(payload.negativePrompt);
  const editRequest    = clean(payload.editRequest);
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