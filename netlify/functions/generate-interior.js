// netlify/functions/generate-interior.js
// 이미지 생성: Flux 2 Pro (Black Forest Labs) + img2img 지원
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
function safeParse(body) {
  try { return JSON.parse(body || '{}'); } catch { return null; }
}
function clean(v) { return typeof v === 'string' ? v.trim() : ''; }
function safeArray(v) { return Array.isArray(v) ? v : []; }
function escapeXml(v) {
  return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const NO_KOREAN_TEXT = [
  'STRICT RULE: Do NOT generate any Korean, Chinese, Japanese, or any non-Latin text in the image.',
  'Do NOT add any signage, labels, or typography in any language unless explicitly required.',
  'If text elements are needed, render them as blurred, illegible, or purely decorative.',
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
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) return referenceStyle;
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('').trim() || '';
    return text || referenceStyle;
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
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 150, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) return null;
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('').trim() || '';
    const titleMatch = text.match(/제목:\s*(.+)/);
    const descMatch  = text.match(/설명:\s*(.+)/s);
    return {
      sceneName,
      sceneNum: `SCENE 0${sceneIndex + 1}`,
      title:    titleMatch?.[1]?.trim() || sceneName,
      desc:     descMatch?.[1]?.trim()  || '',
    };
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

function buildPrompt(payload, referenceVisuals) {
  const pkg = payload?.interiorImagePackage || payload?.result?.interiorImagePackage || {};
  const bd  = payload?.brandDecision        || payload?.result?.brandDecision        || {};
  const brandName  = clean(pkg.selectedBrandName) || clean(bd.brandName)    || '브랜드';
  const concept    = clean(pkg.selectedConcept)   || clean(bd.storeConcept) || '';
  const narrative  = clean(pkg.narrative)         || clean(bd.tagline)      || '';
  const target     = clean(pkg.targetAudience)    || clean(bd.coreCustomers)|| '';
  const rawSize    = clean(pkg.storeSize)         || clean(bd.storeSize)    || '20평대';
  const storeSize  = convertStoreSizeToEnglish(rawSize) || rawSize;
  const mood       = clean(pkg.moodTone)          || clean(bd.overallMood)  || '';
  const layout     = clean(pkg.layoutDirection)   || '';
  const seating    = clean(pkg.seatingDirection)  || '';
  const lighting   = clean(pkg.lightingDirection) || '';
  const signature  = clean(pkg.signatureSpot)     || '';
  const styling    = clean(pkg.stylingNotes)      || '';
  const mustHave  = safeArray(pkg.mustHaveElements).map(clean).filter(Boolean);
  const avoid     = safeArray(pkg.shouldAvoidElements).map(clean).filter(Boolean);
  const materials = safeArray(pkg.materialKeywords).map(clean).filter(Boolean);
  const colors    = safeArray(pkg.colorKeywords).map(clean).filter(Boolean);
  const furniture = safeArray(pkg.furnitureKeywords).map(clean).filter(Boolean);
  const refLine = referenceVisuals ? `CRITICAL THEME — visually dominant: ${referenceVisuals}.` : '';
  const masterPrompt = [
    'Photorealistic commercial restaurant interior photography.',
    NO_KOREAN_TEXT,
    `Brand: ${brandName}.`,
    concept   ? `Concept: ${concept}.`   : '',
    refLine,
    narrative ? `Narrative: ${narrative}.` : '',
    target    ? `Target: ${target}.`     : '',
    `STORE SIZE: ${storeSize}`,
    mood      ? `Mood: ${mood}.`         : '',
    layout    ? `Layout: ${layout}.`     : '',
    mustHave.length  ? `Must-have: ${mustHave.join(', ')}.`  : '',
    avoid.length     ? `Avoid: ${avoid.join(', ')}.`         : '',
    materials.length ? `Materials: ${materials.join(', ')}.` : '',
    colors.length    ? `Colors: ${colors.join(', ')}.`       : '',
    furniture.length ? `Furniture: ${furniture.join(', ')}.` : '',
    seating   ? `Seating: ${seating}.`   : '',
    lighting  ? `Lighting: ${lighting}.` : '',
    signature ? `Signature: ${signature}.` : '',
    styling   ? `Styling: ${styling}.`   : '',
    'Wide-angle, eye-level, realistic commercial lighting, premium atmosphere, no people, no text.',
  ].filter(Boolean).join(' ');
  const negativePrompt = clean(pkg.promptBundle?.negativePrompt) ||
    'cartoon, illustration, watermark, text, Korean text, Japanese text, Asian characters, distorted, low quality, overexposed, generic, cheap';
  return { brandName, concept, masterPrompt, negativePrompt, narrative, storeSize: rawSize, mood };
}

function buildFallbackSvg({ brandName, concept, storeSize, mood }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="960">
    <rect width="1440" height="960" fill="#1A2A3A"/>
    <rect x="60" y="60" width="1320" height="840" rx="20" fill="#243547"/>
    <text x="100" y="240" font-size="72" font-family="Arial" font-weight="bold" fill="#F2EFE8">${escapeXml(brandName)}</text>
    <text x="100" y="295" font-size="26" font-family="Arial" fill="#AACAD8">${escapeXml(concept)}</text>
    <text x="100" y="370" font-size="18" font-family="Arial" fill="#AACAD8">SIZE: ${escapeXml(storeSize)} | MOOD: ${escapeXml(mood)}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// ── Flux 2 Pro 요청 (img2img 지원) ───────────────────────
async function submitFluxRequest(prompt, fluxApiKey, inputImageBase64 = null) {
  const body = {
    prompt,
    width: 1440,
    height: 960,
    output_format: 'jpeg',
  };

  // input_image가 있으면 img2img 모드
  if (inputImageBase64) {
    // base64 데이터 URL이면 순수 base64만 추출
    const pureBase64 = inputImageBase64.includes(',')
      ? inputImageBase64.split(',')[1]
      : inputImageBase64;
    body.input_image = pureBase64;
  }

  const submitRes = await fetch('https://api.bfl.ai/v1/flux-2-pro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-key': fluxApiKey,
    },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const err = await submitRes.json().catch(() => ({}));
    throw new Error(JSON.stringify(err) || `Flux 요청 실패 (${submitRes.status})`);
  }

  const submitData = await submitRes.json();
  const pollingUrl = submitData.polling_url;
  if (!pollingUrl) throw new Error(`Flux polling_url 없음: ${JSON.stringify(submitData)}`);

  return pollingUrl;
}

function detectSectionType(sectionPrompt) {
  const p = sectionPrompt.toLowerCase();
  if (p.includes('section_type:menu_plating'))   return 'menu';
  if (p.includes('section_type:staff_uniform'))  return 'service';
  if (p.includes('section_type:props_detail'))   return 'prop';
  if (p.includes('section_type:space_interior')) return 'space';
  if (p.includes('food plating') || p.includes('plating')) return 'menu';
  if (p.includes('staff uniform') || p.includes('uniform')) return 'service';
  if (p.includes('memorabilia') || p.includes('props')) return 'prop';
  return 'space';
}

function extractMenuType(bd, pkg) {
  const concept  = clean(bd.storeConcept)   || '';
  const menu     = clean(bd.menuDirection)  || '';
  const combined = (concept + ' ' + menu).toLowerCase();
  if (combined.match(/생선|fish|seafood|해산물/)) return 'grilled whole fish Korean style, seafood plating';
  if (combined.match(/화덕|wood.?fire|숯불/))     return 'wood-fired grilled dish, charred and smoky';
  if (combined.match(/돼지|pork|삼겹|갈비/))      return 'Korean grilled pork, BBQ Korean style';
  if (combined.match(/소고기|beef|한우|등심/))     return 'Korean beef BBQ, wagyu-style plating';
  if (combined.match(/치킨|chicken|닭/))           return 'Korean fried chicken dish';
  if (combined.match(/파스타|pasta|이탈/))         return 'pasta Italian cuisine plating';
  if (combined.match(/초밥|sushi|일식/))           return 'sushi Japanese cuisine plating';
  if (combined.match(/디저트|dessert|케이크|카페/)) return 'Korean dessert cafe, bingsu or pastry plating';
  if (combined.match(/홍콩|hong.?kong|중식|chinese/)) return 'Hong Kong style Chinese fusion dish plating';
  if (combined.match(/한식|korean/))               return 'Korean cuisine traditional plating';
  if (combined.match(/양식|western/))              return 'Western fine dining plating';
  return concept.substring(0, 60) || 'restaurant signature dish';
}

function buildSectionFinalPrompt(sectionType, brandContext, themeBlock, editRequest, sceneIndex) {
  const { storeConcept='', menuDirection='', serviceDirection='', propDirection='', overallMood='', menuType='', storeSize='' } = brandContext;
  const storeSizeEn = convertStoreSizeToEnglish(storeSize);
  const neg = 'cartoon, illustration, watermark, Korean text, Japanese text, Chinese text, Asian characters, readable text, text overlays, distorted, low quality, overexposed, generic, cheap, wrong food, wrong cuisine, unrelated props, mismatched theme';

  if (editRequest && editRequest.trim()) {
    const contextHint = [
      sectionType === 'menu'    ? 'Food plating photography, overhead bird\'s eye view, plate fills frame.' : '',
      sectionType === 'prop'    ? 'Interior props close-up photography, bokeh background.' : '',
      sectionType === 'service' ? 'Restaurant staff uniform photography.' : '',
      sectionType === 'space'   ? 'Wide-angle restaurant interior photography.' : '',
      storeConcept ? `Restaurant concept: ${storeConcept}.` : '',
      storeSizeEn  ? `Store size: ${storeSizeEn}` : '',
      themeBlock   ? `Theme: ${themeBlock}` : '',
      overallMood  ? `Mood: ${overallMood}.` : '',
      NO_KOREAN_TEXT,
      'Photorealistic, professional lighting, no people, no text.',
    ].filter(Boolean).join(' ');
    return {
      finalPrompt: `MOST IMPORTANT INSTRUCTION: ${editRequest}. Apply the above change while keeping the rest consistent with: ${contextHint}`,
      negativePrompt: neg,
    };
  }

  let finalPrompt;
  switch (sectionType) {
    case 'menu':
      finalPrompt = [
        'OVERHEAD BIRD\'S EYE VIEW — camera pointing straight down at 90 degrees.',
        'EXTREME CLOSE-UP: plate fills 80-90% of frame.',
        NO_KOREAN_TEXT,
        brandContext.rawMenu ? `DISH: "${brandContext.rawMenu}". Must show this specific food.` : '',
        menuType      ? `Food type: "${menuType}".` : '',
        menuDirection ? `Menu style: ${menuDirection}.` : '',
        storeConcept  ? `Restaurant: ${storeConcept}.` : '',
        themeBlock    ? `Theme in tableware only: ${themeBlock}` : '',
        'Single hero dish. Michelin-star plating. Studio strobe from above.',
        'STRICTLY NO: interior, walls, chairs, table surface, floor, ceiling.',
      ].filter(Boolean).join(' ');
      break;

    case 'service':
      finalPrompt = [
        'Professional restaurant staff uniform editorial photography.',
        NO_KOREAN_TEXT,
        storeConcept     ? `Restaurant concept: ${storeConcept}.` : '',
        serviceDirection ? `Service direction: ${serviceDirection}.` : '',
        overallMood      ? `Mood: ${overallMood}.` : '',
        themeBlock       ? `Uniform theme: ${themeBlock}` : '',
        'Show 2-3 staff in complete themed uniform. Full-length or 3/4 shot. NO readable text on clothing.',
      ].filter(Boolean).join(' ');
      break;

    case 'prop':
      finalPrompt = [
        'Close-up styled interior props photography. No people. Ultra-detailed textures.',
        NO_KOREAN_TEXT,
        storeConcept  ? `Restaurant concept: ${storeConcept}.` : '',
        propDirection ? `Prop direction: ${propDirection}.` : '',
        themeBlock    ? `PROPS matching ONLY this theme: ${themeBlock}` : '',
        'Mid-range vignette shot. Dramatic warm lighting. Deep shadows. Bokeh background.',
      ].filter(Boolean).join(' ');
      break;

    default: { // space
      const currentSceneIndex = typeof sceneIndex === 'number' ? sceneIndex : 0;
      const sigSpot = brandContext.signatureSpot || '';
      const storeSizeEnSpace = convertStoreSizeToEnglish(brandContext.storeSize || storeSize);
      const materialStr = brandContext.materials?.length ? brandContext.materials.join(', ') : '';
      const colorStr    = brandContext.colors?.length    ? brandContext.colors.join(', ')    : '';
      const furnitureStr= brandContext.furniture?.length ? brandContext.furniture.join(', ') : '';

      const consistencyBlock = [
        '⚠ CRITICAL CONSISTENCY RULE: This is ONE of 3 shots of the EXACT SAME restaurant.',
        'ALL 3 images MUST share identical: wall color, floor material, ceiling style, lighting fixtures, furniture style, and color palette.',
        materialStr  ? `FIXED MATERIALS: ${materialStr}.`  : '',
        colorStr     ? `FIXED COLORS: ${colorStr}.`        : '',
        furnitureStr ? `FIXED FURNITURE: ${furnitureStr}.` : '',
        overallMood  ? `FIXED ATMOSPHERE: ${overallMood}.` : '',
        themeBlock   ? `FIXED THEME: ${themeBlock}`        : '',
        storeSizeEnSpace ? `Space size: ${storeSizeEnSpace}.` : '',
      ].filter(Boolean).join(' ');

      const brandBase = [
        storeConcept ? `Restaurant: "${storeConcept}".` : '',
        brandContext.rawMenu ? `Signature menu: ${brandContext.rawMenu}.` : '',
        NO_KOREAN_TEXT,
        'No people. No readable text. Photorealistic. Professional restaurant interior photography.',
      ].filter(Boolean).join(' ');

      if (currentSceneIndex === 0) {
        finalPrompt = [consistencyBlock, 'SHOT 1/3 — FULL DINING HALL: Wide-angle establishing shot from the entrance. Show complete room: all tables, ceiling with lighting, both walls. Camera: eye-level 160cm, 16mm ultra-wide.', brandBase].join(' ');
      } else if (currentSceneIndex === 1) {
        finalPrompt = [consistencyBlock, 'SHOT 2/3 — OPPOSITE ANGLE: Wide-angle from back looking toward entrance. Same materials/lighting as Shot 1 but opposite direction.', brandBase].join(' ');
      } else {
        const sigDesc = sigSpot ? `Focus on: "${sigSpot}".` : 'Show most distinctive zone: bar, open kitchen, or accent wall.';
        finalPrompt = [consistencyBlock, 'SHOT 3/3 — SIGNATURE ZONE: Medium-wide shot of most memorable area.', sigDesc, brandBase].join(' ');
      }
      break;
    }
  }
  return { finalPrompt, negativePrompt: neg };
}

// ── img2img 프롬프트 빌더 (리브랜드보스 전용) ─────────────
function buildRebrandPrompt(basePrompt, rebrandContext, imageType) {
  const { newBrandName, newConcept, overallMood, materials, colors, signatureSpot } = rebrandContext;
  const rebrandInstruction = [
    `REBRAND THIS SPACE: Transform the existing space into "${newBrandName}" brand.`,
    `New concept: ${newConcept}.`,
    `New mood: ${overallMood}.`,
    materials?.length ? `New materials: ${materials.join(', ')}.` : '',
    colors?.length    ? `New color palette: ${colors.join(', ')}.` : '',
    imageType === 'exterior' ? 'Update signage, facade colors, and entrance design to match new brand.' : '',
    imageType === 'interior' ? `Redesign interior while keeping SAME structural layout (walls, columns, ceiling height). ${signatureSpot ? `Add signature element: ${signatureSpot}.` : ''}` : '',
    imageType === 'menu'     ? 'Improve plating, presentation, and styling to match new brand concept.' : '',
    'Keep the same camera angle and composition as the original photo.',
    NO_KOREAN_TEXT,
    'Photorealistic. No people. No text.',
  ].filter(Boolean).join(' ');
  return rebrandInstruction;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST')    return jsonResponse(405, { error: 'POST만 허용됩니다.' });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error: '잘못된 JSON' });

  const fluxApiKey   = process.env.FLUX_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!fluxApiKey) {
    const fallbackInfo = buildPrompt(payload, '');
    return jsonResponse(200, {
      ok: true, brandName: fallbackInfo.brandName, url: '',
      dataUrl: buildFallbackSvg(fallbackInfo), model: 'svg-fallback', warning: 'FLUX_API_KEY 없음',
    });
  }

  const sectionPrompt  = clean(payload.sectionPrompt);
  const negativePrompt = clean(payload.negativePrompt);
  const editRequest    = clean(payload.editRequest);
  const sceneIndex     = typeof payload.sceneIndex === 'number' ? payload.sceneIndex : -1;

  // ── directPrompt (가이드라인/리브랜드 이미지 전용) ──────
  const directPrompt   = clean(payload.directPrompt);
  const inputImage     = payload.inputImage || null;     // ← 업로드한 원본 사진 base64
  const rebrandContext = payload.rebrandContext || null;  // ← 리브랜딩 컨텍스트
  const imageType      = clean(payload.imageType) || 'interior'; // interior / exterior / menu

  if (directPrompt) {
    const neg = 'cartoon, illustration, watermark, Korean text, Japanese text, Chinese text, Asian characters, readable text, distorted, low quality, generic';

    let finalPrompt = directPrompt;

    // 리브랜딩 컨텍스트가 있으면 img2img 전용 프롬프트로 재구성
    if (rebrandContext && inputImage) {
      finalPrompt = buildRebrandPrompt(directPrompt, rebrandContext, imageType);
    }

    try {
      const pollingUrl = await submitFluxRequest(finalPrompt, fluxApiKey, inputImage);
      return jsonResponse(200, {
        ok: true,
        pollingUrl,
        prompt: finalPrompt,
        negativePrompt: neg,
        model: inputImage ? 'flux-2-pro-img2img' : 'flux-2-pro',
        warning: '',
      });
    } catch (error) {
      return jsonResponse(500, { ok: false, error: error?.message || 'Flux 요청 실패' });
    }
  }

  // ── 기존 브랜드보스 sectionPrompt 방식 ──────────────────
  const bd  = payload?.brandDecision        || {};
  const pkg = payload?.interiorImagePackage || {};

  const brandContext = {
    brandName:        clean(bd.brandName)       || clean(pkg.selectedBrandName) || '',
    storeConcept:     clean(bd.storeConcept)     || clean(pkg.selectedConcept)  || '',
    menuDirection:    clean(bd.menuDirection)    || '',
    serviceDirection: clean(bd.serviceDirection) || '',
    propDirection:    clean(bd.propDirection)    || '',
    overallMood:      clean(bd.overallMood)      || clean(pkg.moodTone)         || '',
    menuType:         extractMenuType(bd, pkg),
    storeSize:        clean(payload.formData?.storeSize) || clean(pkg.storeSize) || clean(bd.storeSize) || '',
    spaceDirection:   clean(bd.spaceDirection)   || '',
    materials:        safeArray(pkg.materialKeywords).map(clean).filter(Boolean),
    colors:           safeArray(pkg.colorKeywords).map(clean).filter(Boolean),
    furniture:        safeArray(pkg.furnitureKeywords).map(clean).filter(Boolean),
    signatureSpot:    clean(pkg.signatureSpot)   || clean(bd.signatureSpot) || '',
    rawMenu:          clean(payload.formData?.menu)       || '',
    rawCategory:      clean(payload.formData?.category)   || '',
    rawOwnerStyle:    clean(payload.formData?.ownerStyle) || '',
  };

  const referenceStyle = clean(payload.referenceStyle) || clean(bd.referenceStyle) || '';

  if (sectionPrompt) {
    let refVisuals = clean(payload.cachedRefVisuals) || '';
    if (!refVisuals && referenceStyle && geminiApiKey) {
      refVisuals = await translateReferenceToVisuals(referenceStyle, geminiApiKey);
    }
    const themeBlock  = refVisuals ? `CRITICAL THEME (${referenceStyle}): ${refVisuals}` : '';
    const sectionType = detectSectionType(sectionPrompt);
    const { finalPrompt, negativePrompt: negBase } = buildSectionFinalPrompt(sectionType, brandContext, themeBlock, editRequest, sceneIndex);
    const neg = negativePrompt || negBase;

    let sceneInfo = null;
    if (sectionType === 'space' && sceneIndex >= 0 && geminiApiKey) {
      sceneInfo = await generateSceneDescription(sceneIndex, brandContext, themeBlock, geminiApiKey);
    }

    try {
      const pollingUrl = await submitFluxRequest(finalPrompt, fluxApiKey);
      return jsonResponse(200, {
        ok: true,
        brandName:        brandContext.brandName || '브랜드',
        pollingUrl,
        prompt:           finalPrompt,
        negativePrompt:   neg,
        referenceStyle,
        referenceVisuals: refVisuals,
        brandContext,
        sectionType,
        sceneInfo,
        model:   'flux-2-pro',
        warning: '',
      });
    } catch (error) {
      return jsonResponse(200, {
        ok: true, brandName: brandContext.brandName,
        dataUrl: buildFallbackSvg({ brandName: brandContext.brandName, concept: brandContext.storeConcept, storeSize: brandContext.storeSize, mood: '' }),
        model: 'svg-fallback', warning: error?.message || 'Flux 요청 실패',
      });
    }
  }

  let referenceVisuals = '';
  if (referenceStyle && geminiApiKey) {
    referenceVisuals = await translateReferenceToVisuals(referenceStyle, geminiApiKey);
  }
  const promptInfo = buildPrompt(payload, referenceVisuals);

  try {
    const pollingUrl = await submitFluxRequest(promptInfo.masterPrompt, fluxApiKey);
    return jsonResponse(200, {
      ok: true, brandName: promptInfo.brandName,
      pollingUrl,
      prompt: promptInfo.masterPrompt, negativePrompt: promptInfo.negativePrompt,
      referenceStyle, referenceVisuals, model: 'flux-2-pro', warning: '',
    });
  } catch (error) {
    return jsonResponse(200, {
      ok: true, brandName: promptInfo.brandName,
      dataUrl: buildFallbackSvg(promptInfo),
      prompt: promptInfo.masterPrompt, negativePrompt: promptInfo.negativePrompt,
      model: 'svg-fallback', warning: error?.message || 'Flux 요청 실패',
    });
  }
};