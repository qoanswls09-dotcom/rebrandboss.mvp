import { appendContractorHandoff } from './contractorHandoff.js';
import { comparisonEntries } from '../lib/constructionHandoff.js';
import * as jspdfNs from 'jspdf';
import { normalizeBrief, validBudget } from '../lib/constructionBrief.js';
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
  const pdf = new JsPDF({ unit:'mm', format:'a4', compress:true });
  pdf.addFileToVFS('NotoSansKR-Regular.ttf', await loadFont());
  pdf.addFont('NotoSansKR-Regular.ttf', 'ConsultationKorean', 'normal');
  const warnings=[];
  const entries=comparisonEntries([...(images.storePhotos||[]),...(input?.photoAttachments||[])],images.spaceUrls||[]);
  if(!entries.some(e=>e.kind==='before'))warnings.push('원본 매장 사진 미첨부 — 시공 상담 시 별도로 전달해주세요.');
  if(!entries.some(e=>e.kind==='after'))warnings.push('변경 제안 이미지 미첨부 — 공간 연출 결과를 확인해주세요.');
  await appendContractorHandoff(pdf,{name:decision.newBrandName||'운영중인 매장',brief:{...brief,plan:input?.plan,materials:input?.materials,comparisons:input?.comparisons},entries,assets:images.assetImages||{},font:'ConsultationKorean',warnings});
  const pages=pdf.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFont('ConsultationKorean','normal');pdf.setFontSize(9);pdf.setTextColor(110);pdf.text(`REBRANDBOSS · 시공 상담 자료  ${i}/${pages}`,18,289);}
  const brandName=(decision.newBrandName||'리브랜딩').replace(/[\\/:*?"<>|\s]/g,'_');
  return {doc:pdf,filename:`${brandName}_리브랜드보스_시공상담.pdf`,warnings};
}

export async function downloadConstructionPdf(resultData,brief,images) {
  const result=await buildConstructionPdf(resultData,brief,images);
  result.doc.save(result.filename);
  return { filename:result.filename, warnings:result.warnings };
}
