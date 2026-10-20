import {normalizeMaterials,materialTotals,materialLines} from '../lib/materialBudget.js';
import {resolveComparisons} from '../lib/constructionHandoff.js';
import {floorPlanGeometry,floorPlanSummary,drawFloorPlanPdf} from '../lib/floorPlan.js';
// A contractor-facing front section shared by both apps. No inferred photo pairing or product prices.
export async function appendContractorHandoff(doc,{name,brief,entries=[],assets={},font,warnings=[]}) {
 const margin=18,width=174;let y=22;
 const page=()=>{doc.addPage();y=22;};
 const text=(value,size=11)=>{doc.setFont(font,'normal');doc.setFontSize(size);doc.setTextColor(36,42,50);for(const line of doc.splitTextToSize(String(value||'미확인').replaceAll('㎡','제곱미터'),width)){if(y>274)page();doc.text(line,margin,y);y+=size*0.5;}y+=4;};
 const heading=t=>{doc.setFillColor(245,242,255);doc.rect(14,12,182,15,'F');text(t,17);y+=4;};
 const field=(label,value)=>{text(label,10);text(value,12);};
 const image=async(src,x,top,w,h,label)=>{
  doc.setDrawColor(210);doc.rect(x,top,w,h);doc.setFont(font,'normal');doc.setFontSize(10);doc.setTextColor(55);doc.text(label,x,top-4);
  try{if(typeof src!=='string'||!/^(data:image\/(png|jpe?g|webp);base64,|https?:\/\/|\/)/i.test(src))throw new Error();const res=await fetch(src,{signal:AbortSignal.timeout(20000)});if(!res.ok)throw new Error();const bytes=new Uint8Array(await res.arrayBuffer());const p=doc.getImageProperties(bytes);const scale=Math.min(w/p.width,h/p.height);doc.addImage(bytes,p.fileType,x+(w-p.width*scale)/2,top+(h-p.height*scale)/2,p.width*scale,p.height*scale);}
  catch{doc.text(src?'사진 첨부 실패':'사진 미선택',x+4,top+12);if(src)warnings.push(`${label}: 사진 첨부 실패 — 원본을 별도로 전달해주세요.`);}
 };
 const rows=normalizeMaterials(brief.materials),totals=materialTotals(rows);
 heading('공사 범위 · 견적 요청 요약');text(name,20);
 text('사용자 요청과 변경 제안을 정리한 상담 자료 · 현장 실측 및 시공사 검토 후 확정',10);
 field('공사 위치',brief.address);field('유지할 것', [brief.fixed,brief.keep].filter(Boolean).join('\n'));
 field('변경할 것',brief.change);field('예산 상한',brief.budget?`${brief.budget} 만원`:'미입력');
 field('입력된 견적 범위',rows.length?`${totals.low.toLocaleString()} ~ ${totals.high.toLocaleString()} 만원 / 미견적 ${totals.unknown}개`:'산출 전 — 수량·단가 입력 필요');
 text('미견적 항목은 합계에서 제외됩니다. 전체 공사비로 확정할 수 없습니다.',10);
 if(brief.budget!==''&&Number(brief.budget)<totals.high)text('예산 초과: 우선순위와 공사 범위를 조정해야 합니다.');
 field('포함 범위 · 우선순위',[brief.budgetScope,brief.priority].filter(Boolean).join('\n'));
 page();heading('01 · 간이평면도와 공간 조건');text(floorPlanSummary(brief.plan));
 if(!floorPlanGeometry(brief.plan).error){const drawingHeight=brief.plan?.shape==='custom'?180:125;drawFloorPlanPdf(doc,brief.plan,margin,y,174,drawingHeight);y+=drawingHeight+12;}else text('평면도 미작성: 결과화면의 간이평면도에서 치수를 입력하거나 보유 도면을 첨부해주세요.');
 text('윤곽도이며 벽체·기둥·문·설비의 위치와 가구 배치는 실측 도면으로 확인해야 합니다.',10);field('치수·동선 메모',[brief.dimensions,brief.layout].filter(Boolean).join('\n'));
 const pairs=resolveComparisons(brief.comparisons,entries);
 if(!pairs.length){page();heading('02 · 비포 / 변경 제안');text('비교 사진 연결이 없습니다. 결과화면에서 같은 위치의 원본과 변경 제안을 선택해주세요. 사진 순서만으로 자동 연결하지 않습니다.');}
 for(const [i,pair] of pairs.entries()){
  page();heading(`02 · 비교 ${i+1} / ${pair.zone||'공간명 미입력'}`);text('왼쪽: 실제 현장 / 오른쪽: AI 변경 제안 (실제 시공 후 사진 아님)',10);y+=8;
  await image(pair.beforeImage?.src,18,y,84,85,'BEFORE · 현장');await image(pair.afterImage?.src,108,y,84,85,'AFTER · 변경 제안');y+=98;
  field('이 공간의 공사 지시 · 자재 번호',pair.work);text('사진에만 있고 공사 지시에 없는 구조 변경은 견적 범위에 포함하지 말고 확인해주세요.',10);
 }
 if(!rows.length){page();heading('03 · 자재 · 공사 명세');text('자재와 공사 항목 미작성 — 제품명·규격·수량·가격 근거를 확인해야 합니다.');}
 for(const row of rows){
  page();heading(`03 · ${row.id} / ${row.part||'부위 미정'} · ${row.action||'작업 미정'}`);
  field('제품명 · 제조사 · 모델',row.product||'제품 미정 / 실물 샘플 확인 필요');field('규격 · 색상 · 마감',row.spec);field('시공 방법 · 유지 조건',row.method);
  if(y+95>275)page();
  await image(row.photo||assets[row.imageKey],18,y+6,174,68,row.photo?'사용자 첨부 제품 사진 · 제품명·모델 대조 필요':'자재 참고 사진 · 실물 제품과 일치 여부 미확인');y+=85;
  field('수량 · 단가',`${row.quantity||'?'} ${row.unit} × ${row.low||'?'}~${row.high||'?'} 만원`);
  const t=materialTotals([row]);field('항목별 금액',t.unknown?'미견적 (수량·단가·범위 확인 필요)':`${t.low.toLocaleString()}~${t.high.toLocaleString()} 만원`);field('가격 근거 · 포함 범위',row.source);
 }
 page();heading('04 · 견적 회신 · 현장 확인');text(materialLines(rows,brief.budget).slice(rows.length).join('\n'));
 field('공사 일정 · 영업 조건',[brief.schedule,brief.closure,brief.operating].filter(Boolean).join('\n'));
 field('협의 및 현장 확인 요청',[brief.approval,brief.questions].filter(Boolean).join('\n'));
 text('업체 회신 항목: 공종별 자재비·인건비 / 부가세 / 철거·폐기 / 전기·급배수·환기 / 배송·설치 / 제외 항목 / 공사 기간 / 추가 비용 조건');
 text('현장 확인 후 제품·수량·공법·최종 금액을 확정해주세요.',10);
 const used=new Set(pairs.flatMap(p=>[p.beforeImage?.src,p.afterImage?.src]));
 for(const entry of entries.filter(e=>!used.has(e.src))){page();heading('부록 · 비교에 연결하지 않은 사진');text(entry.label);await image(entry.src,18,y+8,174,150,entry.kind==='before'?'현장 사진':'변경 제안 · 실제 공사 후 사진 아님');}
 return warnings;
}
