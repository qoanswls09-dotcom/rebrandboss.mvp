export const BRIEF_FIELDS = [
  ['address', '매장 주소 / 층수'],
  ['dimensions', '실측 치수 (m)와 측정일', '가로·세로·천장 높이, 측정일. 모르면 비워두세요'],
  ['fixed', '유지해야 할 구조와 위치', '출입구·창문·기둥·벽·급배수 위치'],
  ['keep', '재사용할 설비·가구·마감', '기존 냉장고, 주방 설비, 테이블, 바닥 등'],
  ['change', '변경 요청 / 철거 검토', '철거 가능 여부는 시공사 현장 확인 후 결정'],
  ['layout', '배치·동선 요청', '손님·직원 이동 경로, 주방·카운터·좌석 위치'],
  ['finishes', '부위별 마감 요청', '벽 / 바닥 / 천장 / 가구별 유지 여부와 원하는 소재'],
  ['budget', '총 예산 상한 (만원)'],
  ['budgetScope', '예산에 포함할 항목', '부가세·철거·폐기물·전기·설비·가구·간판·예비비'],
  ['priority', '필수 공사 / 예산 부족 시 미룰 공사'],
  ['schedule', '희망 공사 기간 / 재오픈일'],
  ['closure', '휴업 가능 기간', '전면 휴업 가능 일수 또는 휴무일만 공사 가능 여부'],
  ['operating', '영업 중 공사 제약', '작업 가능 시간, 손님 동선 분리, 소음·분진, 냉장·급수·전력 유지'],
  ['approval', '임대인·건물 관리 협의 사항', '간판·외벽·설비 변경 승인, 작업·반출 시간, 승인 여부'],
  ['questions', '현장 확인 요청', '전력·배수·환기, 소방, 누수, 구조 변경 가능 여부'],
];
export const normalizeBrief = (input = {}) => Object.fromEntries(BRIEF_FIELDS.map(([key]) => [key, typeof input?.[key] === 'string' ? input[key].trim().slice(0, 3000) : '']));
export const missingBriefFields = input => { const brief = normalizeBrief(input); return BRIEF_FIELDS.filter(([key]) => !brief[key]).map(([, label]) => label); };
export const validBudget = value => !value || (/^\d+(\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)));
// A draft belongs to one store/brief, not just a generated brand name.
export const briefIdentity = result => JSON.stringify([result?.projectId || '', result?.formData || {}, result?.rebrandDecision?.newBrandName || '']);
export function parseBriefDraft(text, result) {
  const data = JSON.parse(text);
  if (data.version !== 1 || data.app !== 'rebrandboss' || data.identity !== briefIdentity(result)) throw new Error('이 매장의 상담 초안 파일을 선택해주세요. 다른 프로젝트의 초안은 불러올 수 없습니다.');
  if (!data.brief || typeof data.brief !== 'object' || Array.isArray(data.brief)) throw new Error('올바른 상담 초안이 아닙니다.');
  const brief = normalizeBrief(data.brief);
  if (!validBudget(brief.budget)) throw new Error('초안의 예산은 0 이상의 숫자여야 합니다.');
  return brief;
}
