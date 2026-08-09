// netlify/functions/rebrand-poll.js
//
// ★ 신규 (2026-08-09): gemini-rebrandboss-background의 결과를 가져오는 폴링 엔드포인트.
//   flux-poll.js와 같은 역할(한 번 체크하고 즉시 반환)이지만, 외부 API가 아니라
//   Netlify Blobs의 rebrand-jobs 스토어를 읽는다.
//
//   응답:
//     { status: 'pending'  }               — 아직 백그라운드 함수가 시작 전 (블롭 없음)
//     { status: 'processing' }             — 실행 중
//     { status: 'done', ok: true,  result }— 완료
//     { status: 'done', ok: false, error } — 실패 (크레딧 차감 안 함)

import { getStore } from '@netlify/blobs';

// 백그라운드 함수의 쓰기를 지연 없이 읽어야 하므로 strong consistency 사용
function jobStore() {
  return getStore({ name: 'rebrand-jobs', consistency: 'strong' });
}

export default async (req) => {
  const jobId = new URL(req.url).searchParams.get('jobId');
  if (!jobId) return Response.json({ status: 'error', error: 'jobId 없음' }, { status: 400 });

  try {
    const job = await jobStore().get(jobId, { type: 'json' });
    // 블롭이 아직 없다 = 백그라운드 함수가 아직 첫 쓰기를 못 한 상태
    if (!job) return Response.json({ status: 'pending' });
    return Response.json(job);
  } catch (error) {
    return Response.json({ status: 'error', error: error?.message || '결과 조회 실패' }, { status: 500 });
  }
};
