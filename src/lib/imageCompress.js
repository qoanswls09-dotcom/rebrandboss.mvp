// src/lib/imageCompress.js
// 업로드된 사진을 캔버스로 축소/재인코딩한다.
//
// 왜 필요한가 (2026-08-11):
//   (1) 백그라운드 함수의 요청 payload 상한은 ~256KB라 원본을 실으면 413이 난다.
//   (2) Stability Structure Control은 입력 이미지가 9,437,184픽셀(9.4MP) 이하여야 한다.
//       요즘 폰 사진은 12MP가 기본이라 원본을 그대로 보내면 422로 거부된다.
//   → 촬영/선택 직후 한 번 줄여두면 두 문제가 같이 해결된다.
//
// 긴 변 1600px = 최대 1600x1600(2.56MP)이라 (2)의 상한에 한참 못 미치고,
// 생성 결과 해상도(= 입력 해상도)로도 제안서에 쓰기 충분하다.
export const MAX_PHOTO_DIM = 1600;
export const PHOTO_QUALITY = 0.82;

export function compressDataUrl(dataUrl, maxDim = MAX_PHOTO_DIM, quality = PHOTO_QUALITY) {
  return new Promise((resolve) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return resolve(dataUrl);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch { resolve(dataUrl); } // 압축 실패 시 원본으로 진행 (업로드는 6MB까지 허용)
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
