// netlify/functions/bb-logo.js
// 브랜드 로고 초안 3종 SVG 생성 (Gemini)
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

function buildLogoPrompt(brandName, storeConcept, overallMood, colorKeywords, category) {
  return `You are an expert logo designer. Generate exactly 3 distinct SVG logo designs for a Korean restaurant brand.

Brand Info:
- Brand Name: "${brandName}"
- Concept: "${storeConcept}"
- Mood: "${overallMood}"
- Colors: ${colorKeywords?.join(', ') || 'warm neutrals'}
- Category: "${category}"

STRICT RULES:
1. Output ONLY a valid JSON array with exactly 3 objects. No markdown. No explanation. No code blocks.
2. Each object must have: { "style": string, "primaryColor": hex, "secondaryColor": hex, "accentColor": hex, "fontFamily": string, "svg": string }
3. The "svg" field must contain a complete, valid SVG string (viewBox="0 0 400 200")
4. Each SVG must render the brand name "${brandName}" as the main text element
5. 3 distinctly different styles:
   - Style 1 "modern": Clean sans-serif, geometric shapes, minimal
   - Style 2 "premium": Serif font, elegant lines, sophisticated  
   - Style 3 "bold": Strong weight, graphic element, memorable

SVG TECHNICAL RULES:
- viewBox="0 0 400 200" width="400" height="200"
- Use only inline styles, no external fonts
- font-family must be one of: Arial, Georgia, 'Times New Roman', Verdana, 'Courier New'
- All colors as hex codes
- Brand name must be clearly readable
- Include a simple decorative element (line, shape, icon) that fits the concept
- NO: external images, clipPath errors, undefined variables
- The brand name "${brandName}" MUST appear in Korean or as-is if already in Korean/English

Output format (JSON array only, nothing else):
[
  {
    "style": "modern",
    "primaryColor": "#hex",
    "secondaryColor": "#hex", 
    "accentColor": "#hex",
    "fontFamily": "Arial",
    "svg": "<svg viewBox=\\"0 0 400 200\\" ...>...</svg>"
  },
  { ... },
  { ... }
]`;
}

async function callGemini(prompt, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini 호출 오류');
    return data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '';
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonArray(text) {
  const stripped = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch {
    const start = stripped.indexOf('[');
    const end   = stripped.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      try { return JSON.parse(stripped.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

// SVG 유효성 기본 검증
function validateSvg(svg) {
  if (!svg || typeof svg !== 'string') return false;
  if (!svg.includes('<svg')) return false;
  if (!svg.includes('</svg>')) return false;
  return true;
}

// fallback SVG 생성
function makeFallbackSvg(brandName, style, colors) {
  const { primary = '#1a1a1a', secondary = '#666', accent = '#9333ea' } = colors;
  const configs = {
    modern: {
      font: 'Arial', weight: 300, size: 42, letterSpacing: '0.15em',
      deco: `<line x1="40" y1="120" x2="360" y2="120" stroke="${accent}" stroke-width="1.5"/>`,
    },
    premium: {
      font: 'Georgia', weight: 400, size: 38, letterSpacing: '0.05em',
      deco: `<rect x="160" y="130" width="80" height="2" fill="${accent}"/>
             <circle cx="155" cy="131" r="3" fill="${accent}"/>
             <circle cx="245" cy="131" r="3" fill="${accent}"/>`,
    },
    bold: {
      font: 'Arial', weight: 900, size: 48, letterSpacing: '-0.02em',
      deco: `<rect x="40" y="148" width="320" height="6" fill="${accent}" rx="3"/>`,
    },
  };
  const c = configs[style] || configs.modern;
  return `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg" width="400" height="200">
    <rect width="400" height="200" fill="white"/>
    <text x="200" y="115" font-family="${c.font}" font-weight="${c.weight}" font-size="${c.size}"
      fill="${primary}" text-anchor="middle" letter-spacing="${c.letterSpacing}">${brandName}</text>
    ${c.deco}
  </svg>`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (event.httpMethod !== 'POST')    return jsonResponse(405, { error: 'POST만 허용됩니다.' });

  const payload = safeParse(event.body);
  if (!payload) return jsonResponse(400, { error: '잘못된 JSON' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return jsonResponse(500, { error: 'GEMINI_API_KEY 없음' });

  const brandName     = clean(payload.brandName)     || '브랜드';
  const storeConcept  = clean(payload.storeConcept)  || '';
  const overallMood   = clean(payload.overallMood)   || '';
  const category      = clean(payload.category)      || '';
  const colorKeywords = Array.isArray(payload.colorKeywords) ? payload.colorKeywords : [];

  try {
    const prompt     = buildLogoPrompt(brandName, storeConcept, overallMood, colorKeywords, category);
    const geminiText = await callGemini(prompt, apiKey);
    const parsed     = extractJsonArray(geminiText);

    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      // fallback: 기본 3종 반환
      const fallbacks = ['modern', 'premium', 'bold'].map((style, i) => {
        const colors = [
          { primary: '#1a1a1a', secondary: '#555', accent: '#9333ea' },
          { primary: '#2c2c2c', secondary: '#888', accent: '#c8a96e' },
          { primary: '#111',    secondary: '#444', accent: '#e85d04' },
        ][i];
        return {
          style,
          primaryColor:   colors.primary,
          secondaryColor: colors.secondary,
          accentColor:    colors.accent,
          fontFamily:     ['Arial', 'Georgia', 'Arial'][i],
          svg: makeFallbackSvg(brandName, style, colors),
        };
      });
      return jsonResponse(200, { ok: true, logos: fallbacks, warning: 'AI 생성 실패, 기본 로고 반환' });
    }

    // SVG 검증 및 fallback 보완
    const styles = ['modern', 'premium', 'bold'];
    const logos = parsed.slice(0, 3).map((logo, i) => {
      const svg = validateSvg(logo.svg) ? logo.svg : makeFallbackSvg(
        brandName, styles[i],
        { primary: logo.primaryColor, accent: logo.accentColor }
      );
      return {
        style:          logo.style          || styles[i],
        primaryColor:   logo.primaryColor   || '#1a1a1a',
        secondaryColor: logo.secondaryColor || '#666666',
        accentColor:    logo.accentColor    || '#9333ea',
        fontFamily:     logo.fontFamily     || 'Arial',
        svg,
      };
    });

    return jsonResponse(200, { ok: true, logos });

  } catch (error) {
    return jsonResponse(200, {
      ok: true,
      logos: ['modern', 'premium', 'bold'].map((style, i) => ({
        style,
        primaryColor: ['#1a1a1a', '#2c2c2c', '#111'][i],
        secondaryColor: '#666',
        accentColor: ['#9333ea', '#c8a96e', '#e85d04'][i],
        fontFamily: ['Arial', 'Georgia', 'Arial'][i],
        svg: makeFallbackSvg(brandName, style, { primary: ['#1a1a1a', '#2c2c2c', '#111'][i], accent: ['#9333ea', '#c8a96e', '#e85d04'][i] }),
      })),
      warning: error?.message || '로고 생성 실패',
    });
  }
};
