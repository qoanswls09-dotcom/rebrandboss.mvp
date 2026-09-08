// Keep original indexes while limiting compression and uploads on mobile devices.
export async function uploadJobPhotos(jobId, kind, dataUrls, { compressDataUrl, authedFetch }) {
  let next = 0;
  let failure = null;
  async function worker() {
    while (!failure && next < dataUrls.length) {
      const index = next++;
      try {
        const dataUrl = await compressDataUrl(dataUrls[index]);
        if (failure) return;
        const res = await authedFetch('/.netlify/functions/rebrand-upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, kind, index, dataUrl }),
        });
        if (!res.ok) throw new Error(res.status === 413
          ? '사진 용량이 너무 커요. 장수를 줄이거나 더 작은 사진으로 다시 시도해주세요.'
          : '사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요.');
      } catch (error) { failure ||= error; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, dataUrls.length) }, worker));
  if (failure) throw failure;
}
