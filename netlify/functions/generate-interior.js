// netlify/functions/generate-interior.js
// Flux 2 Pro (txt2img) + Flux Kontext Pro (img2img)
// ESM: export const handler
//
// ★ 수정 사항 (2026-07-07)
// 1. 변화범위(changeScope)가 "간판만/최소"인데도 무조건 "New materials/New color palette"를
//    프롬프트에 박아 넣던 모순을 제거 → tier(변화 강도 1~5)에 따라 조건부로만 추가.
// 2. Kontext Pro는 "새 장면 묘사"보다 "이 사진을 편집해라"는 직접 지시문에 더 잘 반응하므로
//    프롬프트 최상단에 EDIT-ONLY 지시를 강하게 명시하고, 라벨 나열식 문장을 더 간결하게 정리.

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

async function submitFluxImg2Img(prompt, inputImageBase64, fluxApiKey) {
  const b64 = extractBase64(inputImageBase64);
  if (!b64) throw new Error('입력 이미지 없음');
  const res = await fetch('https://api.bfl.ai/v1/flux-kontext-pro', {
    method:'POST', headers:{'Content-Type':'application/json','x-key':fluxApiKey},
    body: JSON.stringify({ prompt, input_image:b64, output_format:'jpeg' }),
  });
  if (!res.ok) { const e=await res.json().catch(()=>({})); throw new Error(JSON.stringify(e)||`Kontext 실패 ${res.status}`); }
  const data = await res.json();
  if (!data.polling_url) throw new Error('Kontext polling_url 없음');
  return data.polling_url;
}

// ── 변화범위 + 예산 → 변환 강도 ──────────────────────────
// tier: 1(간판/소품만) ~ 5(완전 전환). 이 값으로 "새 소재/새 컬러"를
// 프롬프트에 얼마나 강하게, 어디까지 넣을지 결정한다. (모순 방지 핵심)
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

  // 변화범위 우선
  if (changeScope === 'sign' || noConstruction) return {
    tier: 1,
    label: '간판·소품 교체 수준',
    interior: 'MINIMAL CHANGE ONLY: Keep all furniture, tables, chairs, flooring, wall color and material EXACTLY as in the input photo — do not redesign the room. Change ONLY: signage text/design, accent lighting color temperature, and small decorative items placed on existing surfaces.',
    exterior: 'MINIMAL CHANGE ONLY: Keep building structure, facade color, awning EXACTLY as in the input photo. Change ONLY: the signage/logo design and small brand elements near the entrance.',
    menu:     'MINIMAL CHANGE ONLY: Keep the same plate and plating style as the input photo. Change ONLY: plate/surface color to match the new brand palette. Keep identical food arrangement.',
    memoStr,
  };
  if (changeScope === 'partial') return {
    tier: 2,
    label: '부분 리뉴얼 수준',
    interior: 'PARTIAL RENOVATION: Keep building structure, floor plan, window/door positions, ceiling height exactly as in the input photo. Replace: all chairs and tables with new style, all lighting fixtures, wall color/wallpaper, wall art, signage, decorative items. Keep structural columns and floor plan layout unchanged.',
    exterior: 'PARTIAL RENOVATION: Keep building structure and shape exactly as in the input photo. Replace: signage, awning/canopy color and style, exterior paint color, entrance door design, window frame color.',
    menu:     'MODERATE CHANGE: Same food item as in the input photo. New plate/bowl style and material. New background surface. New garnish and sauce presentation. Similar overhead angle.',
    memoStr,
  };
  if (changeScope === 'full') return {
    tier: 4,
    label: '전면 리모델링 수준',
    interior: 'FULL RENOVATION: Keep ONLY the room footprint shape and window/door opening positions from the input photo. COMPLETELY REPLACE: flooring material and color, all wall treatment, ceiling design and material, all lighting fixtures and placement, all furniture (chairs, tables, booths), all decorative elements. Transform into a completely different premium restaurant while preserving the room footprint.',
    exterior: 'FULL RENOVATION: Keep ONLY the building footprint shape from the input photo. COMPLETELY REDESIGN: all facade materials, colors, signage, awning, entrance, window frames, exterior lighting.',
    menu:     'COMPLETE REINVENTION: Keep only the food type (same dish as input photo). Completely new: plating style, plate/vessel material and color, food arrangement, garnish approach, background surface, lighting mood.',
    memoStr,
  };
  // 예산으로 판단 (changeScope가 안 넘어온 경우 대비)
  if (budget.includes('500만원 미만')||budget.includes('500만 미만')) return {
    tier: 1,
    label: '500만원 미만 (소품·간판)',
    interior: 'MINIMAL BUDGET: Keep all major elements exactly as in the input photo. Change ONLY: signage, small accent items on tables, ambient lighting color.',
    exterior: 'MINIMAL BUDGET: Change ONLY the signage/logo, keep everything else identical to the input photo.',
    menu:     'MINIMAL CHANGE: Same plate and arrangement as input photo. Only change plate color or small garnish.',
    memoStr,
  };
  if (budget.includes('500~1,000')||budget.includes('1,000만')) return {
    tier: 2,
    label: '500~1,000만원 (조명·도색·간판)',
    interior: 'LIGHT RENOVATION: Keep furniture and flooring from the input photo. Replace: all lighting fixtures, wall paint color, signage, tablecloths, cushion covers, decorative items.',
    exterior: 'LIGHT RENOVATION: New signage, new exterior paint color, updated small entrance elements. Keep the building shape identical.',
    menu:     'LIGHT CHANGE: New plate/bowl. Same plating style but updated presentation with fresh garnish.',
    memoStr,
  };
  if (budget.includes('1,000~3,000')||budget.includes('3,000만')) return {
    tier: 3,
    label: '1,000~3,000만원 (가구·조명·벽)',
    interior: 'MID RENOVATION: Keep room layout and structure from the input photo. Replace: all furniture (chairs, tables), all lighting, wall color and treatment, flooring accent, signage. Major interior redesign within the existing structure.',
    exterior: 'MID RENOVATION: New signage, new awning, new paint, entrance redesign, updated window frames. Keep the building shape identical.',
    menu:     'FULL PLATING CHANGE: Same food as input photo. New plate/vessel style, new arrangement, new garnish approach.',
    memoStr,
  };
  if (budget.includes('3,000~5,000')||budget.includes('5,000만')) return {
    tier: 4,
    label: '3,000~5,000만원 (대규모 리뉴얼)',
    interior: 'MAJOR RENOVATION: Keep only structural elements (footprint, windows, doors) from the input photo. Completely replace furniture, flooring, walls, ceiling treatment, all lighting, all interior design. Premium transformation.',
    exterior: 'MAJOR RENOVATION: New facade materials, complete signage redesign, new awning, entrance redesign, exterior lighting. Keep only the building footprint.',
    menu:     'PREMIUM REINVENTION: Same food as input photo. Michelin-star level new plating, premium vessel, artistic arrangement.',
    memoStr,
  };
  if (budget.includes('5,000만원 이상')||budget.includes('5,000만 이상')) return {
    tier: 5,
    label: '5,000만원 이상 (전면 변환)',
    interior: 'COMPLETE TRANSFORMATION: Keep only the camera angle and room footprint from the input photo. Everything else is completely new and premium. New flooring, walls, ceiling, furniture, lighting, decor.',
    exterior: 'COMPLETE TRANSFORMATION: Keep only the building footprint from the input photo. Completely new premium facade design.',
    menu:     'COMPLETE PREMIUM REINVENTION: Same food type only (as input photo). Everything else is completely new — premium vessel, artistic arrangement, professional food styling.',
    memoStr,
  };
  // 기본값
  return {
    tier: 3,
    label: '기본 리브랜딩',
    interior: 'STANDARD CHANGE: Keep room layout and building structure from the input photo. Replace furniture, lighting fixtures, wall colors, signage, decorative elements.',
    exterior: 'STANDARD CHANGE: New signage, updated colors, entrance refresh. Keep the building shape identical.',
    menu:     'STANDARD CHANGE: Same food as input photo. New plate and presentation style.',
    memoStr,
  };
}

// tier에 따라 "새 소재/새 컬러" 문구를 어떻게(혹은 넣을지 말지) 결정한다.
// tier 1: 재질/컬러는 signage·소품 등 "허용된 요소"에만 한정해서 언급.
// tier 2 이상: 실제로 교체 대상이 되는 요소(가구/벽 등)에 새 소재·컬러를 적용해도 모순이 없음.
function materialColorLines(tier, matStr, colorStr, kind) {
  if (tier <= 1) {
    const scopeNote = kind === 'menu' ? 'the plate/surface only' : kind === 'exterior' ? 'the signage only' : 'the signage and small accent items only';
    const lines = [];
    if (colorStr) lines.push(`Apply the new brand color palette (${colorStr}) to ${scopeNote} — do NOT repaint or replace anything else.`);
    return lines;
  }
  const lines = [];
  if (matStr)   lines.push(`New materials for the replaced elements: ${matStr}.`);
  if (colorStr) lines.push(`New color palette for the replaced elements: ${colorStr}.`);
  return lines;
}

// ★ 핵심: 사진 타입(exterior/interior/menu) 별로 완전히 다른 프롬프트
function buildRebrandPrompt(imageType, rebrandContext, photoIndex = 0) {
  const {
    newBrandName='', newConcept='', overallMood='',
    materials=[], colors=[], signatureSpot='',
    changeScope='', budget='', budgetMemo='',
  } = rebrandContext || {};
  const matStr   = materials.slice(0,3).join(', ');
  const colorStr = colors.slice(0,2).join(', ');
  const transform = getTransformLevel(changeScope, budget, budgetMemo);

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
    const mcLines = materialColorLines(transform.tier, matStr, colorStr, 'menu');
    return [
      `EDIT TASK — DO NOT GENERATE A NEW SCENE. The attached photo is a real food photo; edit it in place, keep the same food and camera framing.`,
      `CAMERA: Use the EXACT SAME camera angle and perspective as the input photo (overhead, side, or 3/4 angle — match exactly).`,
      `FOOD: Identify the EXACT food in the photo. Keep the SAME food type. Do NOT change what food it is.`,
      ``,
      `TRANSFORMATION LEVEL (${transform.label}): ${transform.menu}`,
      transform.tier >= 2 ? `NEW PLATING STYLE (${photoIndex+1}/5): ${ps.style} — ${ps.desc}` : '',
      ``,
      `Brand: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
      ...mcLines,
      transform.memoStr ? transform.memoStr : '',
      ``,
      `OUTPUT MUST BE: An edited version of the SAME input photo. No restaurant interior in background. Studio/clean background.`,
      `Professional food photography. 4K ultra-detailed. Perfect lighting.`,
      NO_KOREAN_TEXT, `No people. No text.`,
    ].filter(Boolean).join(' ');
  }

  // ── 외관 사진 ────────────────────────────────────────────
  if (imageType === 'exterior') {
    const mcLines = materialColorLines(transform.tier, matStr, colorStr, 'exterior');
    return [
      `EDIT TASK — DO NOT GENERATE A NEW SCENE. The attached photo is a real street-level exterior photo of a restaurant; edit it in place.`,
      `CAMERA: Use the EXACT SAME street-level camera angle, perspective, and framing as the input photo.`,
      `BUILDING: Keep the EXACT SAME building shape, footprint, number of floors, and street position as the input photo.`,
      ``,
      `TRANSFORMATION LEVEL (${transform.label}): ${transform.exterior}`,
      ``,
      `NEW BRAND: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
      ...mcLines,
      transform.memoStr ? transform.memoStr : '',
      ``,
      `OUTPUT MUST BE: An edited version of the SAME input photo — same street, same surroundings, same perspective.`,
      `Photorealistic architectural photography. Daytime, natural lighting.`,
      NO_KOREAN_TEXT, `No people. No text on building.`,
    ].filter(Boolean).join(' ');
  }

  // ── 내부 사진 (interior) ──────────────────────────────────
  const cameraAngles = [
    'Use the EXACT SAME wide-angle view and camera height as the input photo.',
    'Use the EXACT SAME camera angle, perspective depth, and field of view as the input photo.',
    'Use the EXACT SAME framing, shooting direction, and focal length as the input photo.',
    'Use the EXACT SAME composition and viewpoint as the input photo.',
    'Use the EXACT SAME establishing shot perspective as the input photo.',
  ];
  const angleNote = cameraAngles[photoIndex % cameraAngles.length];
  const mcLines = materialColorLines(transform.tier, matStr, colorStr, 'interior');

  return [
    `EDIT TASK — DO NOT GENERATE A NEW SCENE. The attached photo is a real interior photo of this restaurant; edit it in place, do not invent a different room.`,
    `CAMERA: ${angleNote}`,
    `SPACE: Keep the EXACT SAME room shape — ceiling height, window positions, door locations, room proportions, overall space layout — as the input photo.`,
    ``,
    `TRANSFORMATION LEVEL (${transform.label}): ${transform.interior}`,
    ``,
    `NEW BRAND: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
    ...mcLines,
    signatureSpot && transform.tier >= 2 ? `Feature: ${signatureSpot}.` : '',
    transform.memoStr ? transform.memoStr : '',
    ``,
    `OUTPUT MUST BE: An edited version of the SAME input photo — same space proportions, only the elements named above are changed.`,
    `Photorealistic commercial interior. Professional lighting. 4K quality.`,
    NO_KOREAN_TEXT, `No people. No text.`,
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
      let pollingUrl;
      if (inputImage && rebrandContext) {
        const rebrandPrompt = buildRebrandPrompt(imageType, rebrandContext, photoIndex);
        pollingUrl = await submitFluxImg2Img(rebrandPrompt, inputImage, fluxApiKey);
      } else {
        pollingUrl = await submitFluxTxt2Img(directPrompt, fluxApiKey);
      }
      return jsonResponse(200, { ok:true, pollingUrl, model:inputImage?'flux-kontext-pro':'flux-2-pro', warning:'' });
    } catch (err) {
      return jsonResponse(500, { ok:false, error:err?.message||'Flux 요청 실패' });
    }
  }

  // sectionPrompt 방식 (브랜드보스 기존 방식)
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