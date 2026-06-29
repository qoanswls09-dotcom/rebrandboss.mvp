// netlify/functions/generate-interior.js
// 이미지 생성: Flux 2 Pro (txt2img) + Flux Kontext Pro (img2img)
// ESM: export const handler

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

const NO_KOREAN_TEXT = [
  'STRICT RULE: Do NOT generate any Korean, Chinese, Japanese, or any non-Latin text in the image.',
  'Do NOT add any signage, labels, or typography in any language.',
  'No watermarks, no text overlays.',
].join(' ');

function convertStoreSizeToEnglish(storeSize) {
  if (!storeSize) return '';
  const str = String(storeSize);
  const pyeongMatch = str.match(/(\d+)\s*평/);
  if (pyeongMatch) {
    const pyeong = parseInt(pyeongMatch[1]);
    const sqm = Math.round(pyeong * 3.3058);
    let scaleDesc = '';
    if (pyeong <= 10)       scaleDesc = 'very small intimate space, tight seating, compact layout';
    else if (pyeong <= 20)  scaleDesc = 'small cozy restaurant, 8-12 tables maximum';
    else if (pyeong <= 30)  scaleDesc = 'medium restaurant, 12-20 tables, comfortable spacing';
    else if (pyeong <= 50)  scaleDesc = 'medium-large restaurant, 20-35 tables, open floor plan';
    else if (pyeong <= 80)  scaleDesc = 'large restaurant, 35-60 tables, spacious layout with clear zones';
    else if (pyeong <= 120) scaleDesc = 'very large restaurant, 60-100 tables, multiple dining sections';
    else                    scaleDesc = 'grand restaurant space, over 100 tables, landmark scale';
    return `${pyeong} pyeong (approximately ${sqm} sqm). ${scaleDesc}.`;
  }
  return storeSize;
}

async function translateReferenceToVisuals(referenceStyle, apiKey) {
  if (!referenceStyle || !referenceStyle.trim()) return '';
  const prompt = `You are a world-class interior design consultant. A restaurant owner gave you this reference: "${referenceStyle}". Describe its interior design in ONE paragraph with specific hex codes, material names, furniture terms, lighting, and atmosphere. English only.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      { method:'POST', headers:{'Content-Type':'application/json; charset=utf-8'}, signal:controller.signal,
        body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.5, maxOutputTokens:300, thinkingConfig:{thinkingBudget:0}} }) }
    );
    const data = await response.json();
    if (!response.ok) return referenceStyle;
    return data?.candidates?.[0]?.content?.parts?.map(p => p?.text||'').join('').trim() || referenceStyle;
  } catch { return referenceStyle; }
  finally { clearTimeout(timeout); }
}

async function generateSceneDescription(sceneIndex, brandContext, themeBlock, geminiApiKey) {
  const sceneNames = ['메인 다이닝 홀', '테이블 경험', '시그니처 존'];
  const sceneName = sceneNames[sceneIndex] || `장면 ${sceneIndex + 1}`;
  const prompt = `당신은 인테리어 디자인 제안서를 작성하는 전문 카피라이터입니다.
레스토랑 컨셉: ${brandContext.storeConcept || ''}, 분위기: ${brandContext.overallMood || ''}
"${sceneName}"에 대한 제목과 설명을 작성하세요.
형식:
제목: [시적인 한 문장]
설명: [디자인 포인트와 분위기 1-2문장]
한국어로, 간결하게.`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      { method:'POST', headers:{'Content-Type':'application/json; charset=utf-8'}, signal:controller.signal,
        body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.8, maxOutputTokens:150, thinkingConfig:{thinkingBudget:0}} }) }
    );
    const data = await response.json();
    if (!response.ok) return null;
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p?.text||'').join('').trim() || '';
    const titleMatch = text.match(/제목:\s*(.+)/);
    const descMatch  = text.match(/설명:\s*(.+)/s);
    return { sceneName, sceneNum:`SCENE 0${sceneIndex+1}`, title:titleMatch?.[1]?.trim()||sceneName, desc:descMatch?.[1]?.trim()||'' };
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

function buildPrompt(payload, referenceVisuals) {
  const pkg = payload?.interiorImagePackage || payload?.result?.interiorImagePackage || {};
  const bd  = payload?.brandDecision        || payload?.result?.brandDecision        || {};
  const brandName = clean(pkg.selectedBrandName)||clean(bd.brandName)||'브랜드';
  const concept   = clean(pkg.selectedConcept)  ||clean(bd.storeConcept)||'';
  const mood      = clean(pkg.moodTone)         ||clean(bd.overallMood)||'';
  const rawSize   = clean(pkg.storeSize)        ||clean(bd.storeSize)||'20평대';
  const storeSize = convertStoreSizeToEnglish(rawSize)||rawSize;
  const materials = safeArray(pkg.materialKeywords).map(clean).filter(Boolean);
  const colors    = safeArray(pkg.colorKeywords).map(clean).filter(Boolean);
  const furniture = safeArray(pkg.furnitureKeywords).map(clean).filter(Boolean);
  const mustHave  = safeArray(pkg.mustHaveElements).map(clean).filter(Boolean);
  const avoid     = safeArray(pkg.shouldAvoidElements).map(clean).filter(Boolean);
  const refLine   = referenceVisuals ? `CRITICAL THEME: ${referenceVisuals}.` : '';
  const masterPrompt = [
    'Photorealistic commercial restaurant interior photography.', NO_KOREAN_TEXT,
    `Brand: ${brandName}.`, concept?`Concept: ${concept}.`:'', refLine,
    `STORE SIZE: ${storeSize}`, mood?`Mood: ${mood}.`:'',
    mustHave.length  ?`Must-have: ${mustHave.join(', ')}.` :'',
    avoid.length     ?`Avoid: ${avoid.join(', ')}.`        :'',
    materials.length ?`Materials: ${materials.join(', ')}.`:'',
    colors.length    ?`Colors: ${colors.join(', ')}.`      :'',
    furniture.length ?`Furniture: ${furniture.join(', ')}.`:'',
    'Wide-angle, eye-level, realistic commercial lighting, premium atmosphere, no people, no text.',
  ].filter(Boolean).join(' ');
  return { brandName, concept, masterPrompt, negativePrompt:'cartoon, illustration, watermark, text, Korean text, distorted, low quality, generic, cheap', storeSize:rawSize, mood };
}

function buildFallbackSvg({ brandName, concept }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960"><rect width="1440" height="960" fill="#1A2A3A"/><text x="100" y="240" font-size="72" font-family="Arial" font-weight="bold" fill="#F2EFE8">${escapeXml(brandName)}</text><text x="100" y="295" font-size="26" font-family="Arial" fill="#AACAD8">${escapeXml(concept)}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function extractBase64(imageData) {
  if (!imageData) return null;
  if (imageData.includes(',')) return imageData.split(',')[1];
  return imageData;
}

async function submitFluxTxt2Img(prompt, fluxApiKey) {
  const res = await fetch('https://api.bfl.ai/v1/flux-2-pro', {
    method:'POST', headers:{'Content-Type':'application/json','x-key':fluxApiKey},
    body: JSON.stringify({ prompt, width:1440, height:960, output_format:'jpeg' }),
  });
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(JSON.stringify(err)||`Flux 요청 실패 (${res.status})`); }
  const data = await res.json();
  const pollingUrl = data.polling_url;
  if (!pollingUrl) throw new Error(`Flux polling_url 없음: ${JSON.stringify(data)}`);
  return pollingUrl;
}

async function submitFluxImg2Img(prompt, inputImageBase64, fluxApiKey) {
  const pureBase64 = extractBase64(inputImageBase64);
  if (!pureBase64) throw new Error('입력 이미지 없음');
  const res = await fetch('https://api.bfl.ai/v1/flux-kontext-pro', {
    method:'POST', headers:{'Content-Type':'application/json','x-key':fluxApiKey},
    body: JSON.stringify({ prompt, input_image:pureBase64, output_format:'jpeg' }),
  });
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(JSON.stringify(err)||`Flux Kontext 요청 실패 (${res.status})`); }
  const data = await res.json();
  const pollingUrl = data.polling_url;
  if (!pollingUrl) throw new Error(`Flux Kontext polling_url 없음: ${JSON.stringify(data)}`);
  return pollingUrl;
}

// ★ 핵심 수정: 구도만 참고하고 완전히 새로 디자인
function buildRebrandPrompt(imageType, rebrandContext, photoIndex = 0) {
  const { newBrandName='', newConcept='', overallMood='', materials=[], colors=[], signatureSpot='' } = rebrandContext || {};
  const matStr   = materials.slice(0,3).join(', ');
  const colorStr = colors.slice(0,2).join(', ');

  if (imageType === 'menu') {
    // ★ 5가지 완전히 다른 플레이팅 스타일 — 원본 음식 종류만 유지, 나머지는 완전 새로 디자인
    const platingStyles = [
      {
        style: 'Minimalist Japanese-inspired',
        desc:  'pure white ceramic plate, geometric zen arrangement, microgreens accent, maximum negative space, drops of sauce placed with precision',
      },
      {
        style: 'Nordic fine dining',
        desc:  'earthy matte ceramic, organic flowing arrangement, edible wildflowers, smear of sauce, foraged elements, muted natural tones',
      },
      {
        style: 'French bistro classic',
        desc:  'rustic copper pan or deep cream ceramic, hearty rustic presentation, fresh herb garnish, golden sauce reduction',
      },
      {
        style: 'Contemporary Korean fusion',
        desc:  'dark slate or black stone plate, bold high-contrast presentation, sesame oil gloss, scallion julienne, dramatic shadows',
      },
      {
        style: 'Modern tapas / deconstructed',
        desc:  'multiple small vessels and spoons, deconstructed components spread artfully, colorful sauce dots, avant-garde presentation',
      },
    ];
    const ps = platingStyles[photoIndex % platingStyles.length];

    return [
      // ★ 핵심: 구도만 참고 + 완전히 새로운 플레이팅
      `USE THE ORIGINAL PHOTO ONLY FOR: camera angle, perspective, and composition framing.`,
      `COMPLETELY REDESIGN everything else with this new plating style.`,
      ``,
      `NEW PLATING STYLE (variation ${photoIndex + 1}/5): ${ps.style}.`,
      `Plating details: ${ps.desc}`,
      ``,
      `Brand: "${newBrandName}". Concept: ${newConcept}. Mood: ${overallMood}.`,
      matStr   ? `Tableware material: ${matStr}.`   : '',
      colorStr ? `Color palette: ${colorStr}.`       : '',
      ``,
      `MANDATORY: Same food type as original photo but COMPLETELY different plating presentation.`,
      `Michelin-star level food photography. Professional studio lighting from above.`,
      `4K ultra-detailed food photography. Rich textures. Perfect focus.`,
      NO_KOREAN_TEXT, `No people. No text. No background clutter.`,
    ].filter(s => s !== undefined).join(' ');
  }

  if (imageType === 'exterior') {
    // ★ 구도만 참고 + 완전히 새로운 외관 디자인
    return [
      `USE THE ORIGINAL PHOTO ONLY FOR: camera angle, street perspective, and building silhouette shape.`,
      `COMPLETELY REDESIGN the facade with a brand new design.`,
      ``,
      `NEW BRAND: "${newBrandName}". New concept: ${newConcept}. Mood: ${overallMood}.`,
      colorStr ? `New exterior color palette: ${colorStr}.` : '',
      matStr   ? `New facade materials: ${matStr}.`         : '',
      ``,
      `REDESIGN: Replace all signage, colors, awning, entrance design, lighting fixtures completely.`,
      `Make it look like a completely different, premium restaurant with the same building footprint.`,
      `Photorealistic architectural rendering. Professional photography.`,
      NO_KOREAN_TEXT, `No people. No text.`,
    ].filter(Boolean).join(' ');
  }

  // ★ interior — 구도/각도만 참고, 완전히 새로운 인테리어 디자인
  const cameraAngles = [
    `Same wide-angle establishing shot from entrance perspective as the original photo.`,
    `Same camera angle and depth of field as the original photo.`,
    `Same framing and viewpoint as the original photo.`,
    `Same shooting direction and focal length as the original photo.`,
    `Same composition and field of view as the original photo.`,
  ];
  const angleNote = cameraAngles[photoIndex % cameraAngles.length];

  return [
    `USE THE ORIGINAL PHOTO ONLY FOR: ${angleNote}`,
    `COMPLETELY REDESIGN the entire interior with a brand new design. Do NOT preserve old furniture, colors, or decor.`,
    ``,
    `NEW BRAND: "${newBrandName}". New concept: ${newConcept}. Mood: ${overallMood}.`,
    matStr    ? `New materials throughout: ${matStr}.`       : '',
    colorStr  ? `New color palette: ${colorStr}.`            : '',
    signatureSpot ? `Feature this signature element: ${signatureSpot}.` : '',
    ``,
    `COMPLETE TRANSFORMATION: new flooring, new wall treatment, new ceiling design, new lighting fixtures, new furniture, new decor.`,
    `Make it look like a completely different, premium restaurant photographed from the same angle.`,
    `Photorealistic commercial interior photography. Professional lighting. 4K quality.`,
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
  if (combined.match(/생선|fish|seafood/)) return 'grilled whole fish Korean style';
  if (combined.match(/돼지|pork|삼겹|갈비/)) return 'Korean grilled pork BBQ';
  if (combined.match(/소고기|beef|한우/)) return 'Korean beef BBQ wagyu-style';
  if (combined.match(/치킨|chicken|닭/)) return 'Korean fried chicken';
  if (combined.match(/파스타|pasta/)) return 'pasta Italian cuisine';
  if (combined.match(/초밥|sushi|일식/)) return 'sushi Japanese cuisine';
  if (combined.match(/디저트|dessert|카페/)) return 'Korean dessert cafe plating';
  if (combined.match(/한식|korean/)) return 'Korean cuisine traditional plating';
  return (bd.storeConcept||'').substring(0,60)||'restaurant signature dish';
}

function buildSectionFinalPrompt(sectionType, brandContext, themeBlock, editRequest, sceneIndex) {
  const { storeConcept='', menuDirection='', serviceDirection='', propDirection='', overallMood='', menuType='' } = brandContext;
  const neg = 'cartoon, illustration, watermark, Korean text, Japanese text, Chinese text, readable text, distorted, low quality, overexposed, generic, cheap';

  if (editRequest && editRequest.trim()) {
    return { finalPrompt:`MOST IMPORTANT: ${editRequest}. Keep consistent with: ${storeConcept}. ${overallMood}. ${themeBlock}. ${NO_KOREAN_TEXT}. Photorealistic, no people, no text.`, negativePrompt:neg };
  }

  let finalPrompt;
  switch (sectionType) {
    case 'menu':
      finalPrompt = ['OVERHEAD BIRD\'S EYE VIEW — camera pointing straight down.', 'EXTREME CLOSE-UP: plate fills 80-90% of frame.', NO_KOREAN_TEXT,
        brandContext.rawMenu?`DISH: "${brandContext.rawMenu}".`:'', menuType?`Food type: "${menuType}".`:'',
        menuDirection?`Style: ${menuDirection}.`:'', storeConcept?`Restaurant: ${storeConcept}.`:'',
        themeBlock?`Theme: ${themeBlock}`:'', 'Michelin-star plating. Studio strobe from above. No interior, no furniture.',
      ].filter(Boolean).join(' ');
      break;
    case 'service':
      finalPrompt = [`Professional staff uniform photography. ${NO_KOREAN_TEXT}`, storeConcept?`Restaurant: ${storeConcept}.`:'', serviceDirection?`Direction: ${serviceDirection}.`:'', overallMood?`Mood: ${overallMood}.`:'', '2-3 staff in themed uniform.'].filter(Boolean).join(' ');
      break;
    case 'prop':
      finalPrompt = [`Close-up interior props. ${NO_KOREAN_TEXT}`, storeConcept?`Concept: ${storeConcept}.`:'', propDirection?`Props: ${propDirection}.`:'', themeBlock?`Theme: ${themeBlock}`:'', 'Bokeh background. Dramatic lighting.'].filter(Boolean).join(' ');
      break;
    default: {
      const idx      = typeof sceneIndex==='number'?sceneIndex:0;
      const matStr   = brandContext.materials?.join(', ')||'';
      const colorStr = brandContext.colors?.join(', ')   ||'';
      const block    = ['⚠ CONSISTENCY: ALL 3 shots of SAME restaurant.', matStr?`Materials: ${matStr}.`:'', colorStr?`Colors: ${colorStr}.`:'', overallMood?`Atmosphere: ${overallMood}.`:'', themeBlock||''].filter(Boolean).join(' ');
      const base     = [storeConcept?`Restaurant: "${storeConcept}".`:'', NO_KOREAN_TEXT, 'No people. No text. Photorealistic.'].filter(Boolean).join(' ');
      if (idx===0)      finalPrompt=`${block} SHOT 1/3: Wide-angle from entrance. Show complete dining hall. ${base}`;
      else if (idx===1) finalPrompt=`${block} SHOT 2/3: From back toward entrance. Same design as Shot 1. ${base}`;
      else              finalPrompt=`${block} SHOT 3/3: Signature zone${brandContext.signatureSpot?`: "${brandContext.signatureSpot}"`:''}. ${base}`;
      break;
    }
  }
  return { finalPrompt, negativePrompt:neg };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok:true });
  if (event.httpMethod !== 'POST')    return jsonResponse(405, { error:'POST만 허용됩니다.' });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error:'잘못된 JSON' });

  const fluxApiKey   = process.env.FLUX_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!fluxApiKey) {
    return jsonResponse(200, { ok:true, dataUrl:buildFallbackSvg({brandName:'브랜드',concept:''}), model:'svg-fallback', warning:'FLUX_API_KEY 없음' });
  }

  const directPrompt   = clean(payload.directPrompt);
  const inputImage     = payload.inputImage     || null;
  const rebrandContext = payload.rebrandContext  || null;
  const imageType      = clean(payload.imageType) || 'interior';
  const photoIndex     = typeof payload.photoIndex==='number' ? payload.photoIndex : 0;

  // ── directPrompt 방식 (리브랜드보스 전용) ───────────────
  if (directPrompt) {
    try {
      let pollingUrl;
      if (inputImage && rebrandContext) {
        // ★ img2img: 구도만 참고 + 완전히 새로운 디자인
        const rebrandPrompt = buildRebrandPrompt(imageType, rebrandContext, photoIndex);
        pollingUrl = await submitFluxImg2Img(rebrandPrompt, inputImage, fluxApiKey);
      } else {
        pollingUrl = await submitFluxTxt2Img(directPrompt, fluxApiKey);
      }
      return jsonResponse(200, { ok:true, pollingUrl, model:inputImage?'flux-kontext-pro':'flux-2-pro', warning:'' });
    } catch (error) {
      return jsonResponse(500, { ok:false, error:error?.message||'Flux 요청 실패' });
    }
  }

  // ── sectionPrompt 방식 (브랜드보스 기존 방식 유지) ──────
  const sectionPrompt  = clean(payload.sectionPrompt);
  const negativePrompt = clean(payload.negativePrompt);
  const editRequest    = clean(payload.editRequest);
  const sceneIndex     = typeof payload.sceneIndex==='number' ? payload.sceneIndex : -1;

  const bd  = payload?.brandDecision        || {};
  const pkg = payload?.interiorImagePackage || {};

  const brandContext = {
    brandName:        clean(bd.brandName)       ||clean(pkg.selectedBrandName)||'',
    storeConcept:     clean(bd.storeConcept)     ||clean(pkg.selectedConcept) ||'',
    menuDirection:    clean(bd.menuDirection)    ||'',
    serviceDirection: clean(bd.serviceDirection) ||'',
    propDirection:    clean(bd.propDirection)    ||'',
    overallMood:      clean(bd.overallMood)      ||clean(pkg.moodTone)        ||'',
    menuType:         extractMenuType(bd, pkg),
    storeSize:        clean(payload.formData?.storeSize)||clean(pkg.storeSize)||'',
    materials:        safeArray(pkg.materialKeywords).map(clean).filter(Boolean),
    colors:           safeArray(pkg.colorKeywords).map(clean).filter(Boolean),
    furniture:        safeArray(pkg.furnitureKeywords).map(clean).filter(Boolean),
    signatureSpot:    clean(pkg.signatureSpot)||'',
    rawMenu:          clean(payload.formData?.menu)    ||'',
    rawCategory:      clean(payload.formData?.category)||'',
    rawOwnerStyle:    clean(payload.formData?.ownerStyle)||'',
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
    } catch (error) {
      return jsonResponse(200, { ok:true, brandName:brandContext.brandName, dataUrl:buildFallbackSvg({brandName:brandContext.brandName,concept:brandContext.storeConcept}), model:'svg-fallback', warning:error?.message||'Flux 요청 실패' });
    }
  }

  let referenceVisuals='';
  if (referenceStyle && geminiApiKey) referenceVisuals = await translateReferenceToVisuals(referenceStyle, geminiApiKey);
  const promptInfo = buildPrompt(payload, referenceVisuals);
  try {
    const pollingUrl = await submitFluxTxt2Img(promptInfo.masterPrompt, fluxApiKey);
    return jsonResponse(200, { ok:true, brandName:promptInfo.brandName, pollingUrl, prompt:promptInfo.masterPrompt, negativePrompt:promptInfo.negativePrompt, referenceStyle, referenceVisuals, model:'flux-2-pro', warning:'' });
  } catch (error) {
    return jsonResponse(200, { ok:true, brandName:promptInfo.brandName, dataUrl:buildFallbackSvg(promptInfo), model:'svg-fallback', warning:error?.message||'Flux 요청 실패' });
  }
};