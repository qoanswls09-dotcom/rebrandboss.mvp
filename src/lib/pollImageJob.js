export async function pollImageJob(pollingUrl, { fetchJob, wait, onReady }) {
  let failures = 0;
  for (let i = 0; i < 45; i++) {
    await wait(2000);
    let response, result;
    try {
      response = await fetchJob(pollingUrl);
      if (response.status === 429 || response.status >= 500) throw new Error('temporary');
      result = await response.json();
    } catch {
      if (++failures < 3) continue;
      throw new Error('이미지 결과 확인이 지연되고 있어요. 잠시 후 다시 확인해 주세요.');
    }
    failures = 0;
    if (!response.ok || result.status === 'Error') throw new Error(result.error || '이미지 생성 실패');
    if (result.status === 'Ready' && result.imageUrl) {
      onReady();
      return result.imageUrl;
    }
  }
  throw new Error('이미지 결과 확인이 지연되고 있어요. 재요청 전에 저장 결과와 크레딧 이용 내역을 확인해 주세요.');
}
