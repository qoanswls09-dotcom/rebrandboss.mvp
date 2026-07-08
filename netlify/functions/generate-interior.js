// netlify/functions/generate-interior.js
// Flux 2 Pro 단일 엔진 (txt2img + input_image 기반 편집)
// ESM: export const handler
//
// ★★★ 구조 변경 (2026-07-07, 4차) ★★★
// 1차: Kontext Pro img2img → 너무 보수적(거의 안 바뀜)
// 2차: txt2img + Gemini 구조분석(텍스트만) → 원본과 무관한 완전히 새 사진
// 3차: Kontext Pro img2img + 공격적 프롬프트 → 그래도 여전히 변화폭 2~3/10 수준, 부족
// 4차(현재): Flux Kontext Pro를 버리고, brandboss가 쓰는 것과 동일한 flux-2-pro 엔드포인트를
//            "편집 모드"(input_image 파라미터)로 사용. flux-2-pro는 Kontext처럼 "정밀 편집"에
//            튜닝된 모델이 아니라 "과감한 생성"에 특화된 모델이라, 같은 프롬프트를 줘도 훨씬
//            더 브랜드보스다운 드라마틱한 결과가 나오면서도 input_image를 참조하므로 원본의
//            형태/구도가 자연스럽게 반영된다.

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

// ── ★ NEW: 이미 생성된 이미지의 https URL을 base64로 변환 (정밀 수정 모드용) ──
async function fetchImageAsBase64(url) {
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
      return jsonResponse(500, { ok:false, error: err?.message || '이미지 수정 실패' });
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
        pollingUrl = await submitFlux2Pro(directPrompt, fluxApiKey);
      }
      return jsonResponse(200, { ok:true, pollingUrl, model:inputImage?'flux-2-pro (edit)':'flux-2-pro', warning:'' });
    } catch (err) {
      return jsonResponse(500, { ok:false, error:err?.message||'Flux 요청 실패' });
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