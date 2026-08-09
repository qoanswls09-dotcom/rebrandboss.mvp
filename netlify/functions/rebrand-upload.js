// netlify/functions/rebrand-upload.js
//
// ★ 신규 (2026-08-10): 리브랜딩 분석용 사진을 Blobs에 미리 올려두는 동기 함수.
//
//   왜 필요한가:
//   Netlify Background Function의 요청 payload 상한은 ~256KB다(실측: 245KB 통과,
//   262KB에서 413). 동기 함수의 ~6MB와 완전히 다른 값이라, 사진을 백그라운드
//   호출 본문에 실으면 접수 자체가 413으로 거부된다.
//   → 사진은 이 동기 함수로 "한 장씩" 먼저 올려 Blobs에 저장하고,
//     백그라운드 호출에는 장수만 넘긴다.
//
//   키 규칙: `${jobId}/store-${index}`, `${jobId}/menu-${index}`
//   (결과 블롭 `${jobId}`와는 다른 키. Blobs 키는 평면 문자열이라 충돌하지 않는다)

import { getStore } from '@netlify/blobs';

function jobStore() {
  return getStore({ name: 'rebrand-jobs', consistency: 'strong' });
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'POST만 허용됩니다.' }, { status: 405 });

  let body = null;
  try { body = await req.json(); } catch { /* 아래에서 처리 */ }

  const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : '';
  const kind  = body?.kind === 'menu' ? 'menu' : 'store';
  const index = Number.isInteger(body?.index) ? body.index : -1;
  const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';

  if (!jobId || index < 0 || !dataUrl) {
    return Response.json({ ok: false, error: 'jobId/index/dataUrl이 필요합니다.' }, { status: 400 });
  }
  // jobId가 키 경로를 벗어나지 못하게 제한 (프론트는 crypto.randomUUID를 쓴다)
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(jobId)) {
    return Response.json({ ok: false, error: '잘못된 jobId 형식입니다.' }, { status: 400 });
  }

  try {
    await jobStore().set(`${jobId}/${kind}-${index}`, dataUrl);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || '사진 저장 실패' }, { status: 500 });
  }
};
