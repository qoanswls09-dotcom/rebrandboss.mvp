import { materialLines } from '../lib/materialBudget.js';
import { floorPlanGeometry, floorPlanSummary, drawFloorPlanPdf } from '../lib/floorPlan.js';
import * as jspdfNs from 'jspdf';
import { BRIEF_FIELDS, normalizeBrief, validBudget, missingBriefFields } from '../lib/constructionBrief.js';
const JsPDF = jspdfNs.jsPDF || jspdfNs.default;
let fontPromise;
async function loadFont() {
  if (!fontPromise) fontPromise = fetch('/fonts/NotoSansKR-Regular.ttf').then(async response => {
    if (!response.ok) throw new Error('한글 글꼴을 불러오지 못했습니다. 다시 시도해주세요.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
    return btoa(binary);
  }).catch(error => { fontPromise = null; throw error; });
  return fontPromise;
}
const list = value => Array.isArray(value) ? value.filter(v => typeof v === 'string' && v.trim()).join(' / ') : typeof value === 'string' ? value : '';
const imageSource = photo => typeof photo === 'string' ? photo : photo?.base64 || photo?.dataUrl || photo?.url || '';
export function consultationImageEntries(resultData, { storePhotos = [], spaceUrls = [], assetImages = {} } = {}) {
  const pkg = resultData?.interiorImagePackage || {};
  const labels = { signature:'시그니처 공간', narrative:'브랜드 스토리' };
  for (const [prefix, values] of [['material',pkg.materialKeywords],['furniture',pkg.furnitureKeywords],['musthave',pkg.mustHaveElements]]) {
    (Array.isArray(values) ? values : []).forEach((value,i) => { labels[`${prefix}-${i}`] = value; });
  }
  return [
    ...storePhotos.map((photo,i) => ({ kind:'before', label:`기존 매장 사진 ${i+1}`, src:imageSource(photo) })),
    ...spaceUrls.map((src,i) => ({ kind:'after', label:`리디자인 참고 이미지 ${i+1} (실측 도면 아님)`, src })),
    ...Object.entries(assetImages).filter(([,src]) => src).map(([id,src]) => ({ kind:'asset', label:`자산 제안 · ${labels[id] || id}`, src })),
  ];
}

export async function buildConstructionPdf(resultData, input, images = {}) {
  const brief = normalizeBrief(input);
  if (!validBudget(brief.budget)) throw new Error('예산은 0 이상의 숫자로 입력해주세요.');
  const decision = resultData?.rebrandDecision || {};
  const pkg = resultData?.interiorImagePackage || {};
  const pdf = new JsPDF({ unit:'mm', format:'a4', compress:true });
  pdf.addFileToVFS('NotoSansKR-Regular.ttf', await loadFont());
  pdf.addFont('NotoSansKR-Regular.ttf', 'ConsultationKorean', 'normal');
  const margin=18, contentWidth=174;
  let y=20;
  const page = () => { pdf.addPage(); y=20; };
  const need = height => { if (y+height>279) page(); };
  const paragraph = (value, size=10.5, gap=4) => {
    pdf.setFont('ConsultationKorean','normal'); pdf.setFontSize(size); pdf.setTextColor(35,40,50);
    const lead=size*0.3528*1.55;
    for(const line of pdf.splitTextToSize(String(value || ''),contentWidth)) {
      need(lead); pdf.text(line,margin,y+lead*0.75); y+=lead;
    }
    y+=gap;
  };
  const title = text => { need(24); paragraph(text,16,6); };
  const field = (label,value) => { need(22); paragraph(label,11,2); paragraph(value || '미확인 — 현장 상담 시 확인 필요'); };
  const warnings = [];
  title('인테리어 시공 상담·견적 요청서');
  paragraph(decision.newBrandName || '운영중인 매장',18,6);
  paragraph(`작성일 ${new Date().toLocaleDateString('ko-KR')}`);
  paragraph('실제 시공 전 현장 확인과 실시설계가 필요한 기획 자료입니다. 생성 이미지는 분위기 참고용이며 실제 구조·치수·시공 가능성을 보장하지 않습니다.');
  title('01 · 현재 매장과 리브랜딩 방향');
  field('사용자 입력 업종',resultData?.formData?.category);
  field('AI 진단 (현장 확인 필요)',decision.diagnosis);
  field('새 콘셉트 제안',decision.newConcept);
  field('유지할 강점 제안',list(decision.keepStrengths));
  field('변경 방향 제안',list(decision.changePoints));
  field('공간 연출 제안',pkg.improvementDirection);
  title('02 · 사용자 공사 요청');
  paragraph('아래 내용은 사용자 입력이며 AI가 확정한 설계나 견적이 아닙니다. 미확인 항목은 시공사가 현장에서 확인해주세요.');
  for(const [key,label] of BRIEF_FIELDS) field(label,brief[key] ? brief[key]+(key==='budget'?' 만원 (요청 상한, 견적 아님)':'') : '');
  field('간이평면도',floorPlanSummary(input?.plan));
  if (!floorPlanGeometry(input?.plan).error) { need(140); drawFloorPlanPdf(pdf,input.plan,margin,y); y+=135; }
  paragraph('사용자 치수로 그린 윤곽도 또는 사용자 첨부 도면입니다. 가구·창문·기둥 위치를 자동 추정하지 않습니다. 미표시 위치와 정확한 치수는 현장 확인이 필요합니다.');
  title('03 · 자재·가구 후보와 견적 요청');
  field('사용자 자재·공사 견적',materialLines(input?.materials,brief.budget).join('\n'));
  field('AI 소재 후보',list(pkg.materialKeywords));
  field('AI 가구 후보',list(pkg.furnitureKeywords));
  field('AI 필수 요소 제안',list(pkg.mustHaveElements));
  paragraph('위 목록은 후보입니다. 부위별 제품명·규격·수량·시공 방식·단가를 현장 확인 후 제시해주세요. 유지 요청과 충돌하는 제안은 적용 전에 협의해주세요.');
  paragraph('공종별 금액, 부가세·철거·폐기물·설비·배송·설치 포함 여부, 공사 일정과 추가 비용 조건을 구분해 견적을 요청합니다. 예산 초과 시 필수 공사와 보류 가능한 공사를 나눠주세요.');
  field('미확인 입력 항목',missingBriefFields(brief).join(' / ') || '입력 완료 (현장 검증 완료를 뜻하지 않습니다)');
  title('04 · 현장 사진과 디자인 참고');
  paragraph('기존 사진과 생성 이미지는 구도·순서가 다를 수 있습니다. 같은 위치의 전후 비교나 정확한 구조 보존을 확인한 자료는 아닙니다.');
  const entries = consultationImageEntries(resultData,images);
  if (!entries.some(item=>item.kind==='before')) { const message='원본 매장 사진 미첨부 — 시공 상담 시 별도로 전달해주세요.'; paragraph(message); warnings.push(message); }
  if (!entries.some(item=>item.kind==='after')) { const message='리디자인 이미지 미첨부 — 공간 연출 카드에서 생성 후 다시 다운로드할 수 있습니다.'; paragraph(message); warnings.push(message); }
  for(const item of entries) {
    let bytes, props;
    try {
      if (typeof item.src !== 'string' || !/^(data:image\/(png|jpe?g|webp);base64,|https?:\/\/|\/)/i.test(item.src)) throw new Error('unsupported image');
      const response = await fetch(item.src,{ signal:AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('image unavailable');
      bytes = new Uint8Array(await response.arrayBuffer());
      props = pdf.getImageProperties(bytes);
      if (!(props.width>0 && props.height>0)) throw new Error('invalid dimensions');
    } catch {
      const message=`${item.label}: 첨부 실패 — 원본을 별도로 전달하거나 다시 다운로드해주세요.`;
      field(item.label,message); warnings.push(message); continue;
    }
    const height=Math.min(115,contentWidth*props.height/props.width);
    const width=height*props.width/props.height;
    need(height+25); paragraph(item.label,11,3);
    try { pdf.addImage(bytes,props.fileType,margin,y,width,height); y+=height+7; }
    catch { const message=`${item.label}: PDF 이미지 변환 실패. 원본을 별도로 전달해주세요.`; paragraph(message); warnings.push(message); }
  }
  paragraph('간이평면도는 정밀 시공 도면이 아닙니다. 보유 원본 도면을 함께 전달하고 구조·전기·급배수·환기·소방 조건을 현장에서 확인해주세요.');
  const pages=pdf.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++) { pdf.setPage(i); pdf.setFont('ConsultationKorean','normal'); pdf.setFontSize(9); pdf.setTextColor(110); pdf.text(`REBRANDBOSS · 시공 상담 자료  ${i}/${pages}`,margin,289); }
  const brandName=(decision.newBrandName || '리브랜딩').replace(/[\\/:*?"<>|\s]/g,'_');
  return { doc:pdf, filename:`${brandName}_리브랜드보스_시공상담.pdf`, warnings };
}
export async function downloadConstructionPdf(resultData,brief,images) {
  const result=await buildConstructionPdf(resultData,brief,images);
  result.doc.save(result.filename);
  return { filename:result.filename, warnings:result.warnings };
}
