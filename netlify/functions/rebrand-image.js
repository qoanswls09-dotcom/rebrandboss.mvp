// netlify/functions/rebrand-image.js
//
// ★ 신규 (2026-08-11): 생성된 이미지 1장을 Blobs에서 읽어 그대로 내려주는 GET 함수.
//
//   왜 필요한가:
//   Stability Structure Control은 동기 API라 이미지 "바이트"가 바로 돌아온다.
//   이걸 data URI로 프론트에 넘기면 한 장에 500~700KB짜리 문자열이 되는데,
//   그 URL이 그대로 bb_save의 images(JSONB)에 저장되고 공유 페이지에서도 다시 실려서
//   프로젝트 한 건이 수 MB로 불어난다.
//   → 생성 직후 Blobs에 저장하고, 프론트에는 이 함수의 짧은 URL만 넘긴다.
//     (Flux 경로가 폴링 후 imageUrl을 받는 것과 동일한 모양이 되어 프론트 코드도 그대로 쓰인다)
//
//   덤: Flux(bfl.ai)가 주는 결과 URL은 시간이 지나면 만료돼서 저장해둔 프로젝트의
//   이미지가 나중에 깨졌는데, Blobs에 둔 이미지는 만료되지 않는다.
//
//   키는 crypto.randomUUID()라 추측이 불가능하다. 공유 페이지(비로그인)에서도
//   같은 URL로 보여야 하므로 인증은 걸지 않는다 — 기존 bfl.ai 결과 URL과 같은 수준.

import { getStore } from '@netlify/blobs';

export const IMAGE_STORE = 'rebrand-images';

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('GET만 허용됩니다.', { status: 405 });
  }

  const key = new URL(req.url).searchParams.get('key') || '';
  // 키 형식을 고정해 임의 경로 조회를 막는다 (uuid + 확장자 없는 형태)
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) {
    return new Response('잘못된 key', { status: 400 });
  }

  try {
    const store = getStore({ name: IMAGE_STORE, consistency: 'strong' });
    const res = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!res?.data) return new Response('이미지를 찾을 수 없습니다.', { status: 404 });

    return new Response(res.data, {
      status: 200,
      headers: {
        'Content-Type': res.metadata?.contentType || 'image/jpeg',
        // 키가 곧 내용이라 내용이 바뀌지 않는다 → 영구 캐시
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(error?.message || '이미지 조회 실패', { status: 500 });
  }
};
