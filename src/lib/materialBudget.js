export const newMaterial = () => ({id:'',part:'', action:'교체', spec:'', quantity:'', unit:'㎡', low:'', high:'', source:'',product:'',method:'',imageKey:'',photo:''});
export function normalizeMaterials(value) { return (Array.isArray(value)?value:[]).slice(0,40).map((row,index) => Object.fromEntries(Object.keys(newMaterial()).map(key=>[key,key==='id' ? (/^M(?:[0-9]+|-[A-Z0-9]{8})$/.test(row?.id||'')?row.id:`M${index+1}`) : key==='photo' ? (typeof row?.photo==='string'&&row.photo.length<1500000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(row.photo)?row.photo:'') : typeof row?.[key]==='string'?row[key].slice(0,500):'']))); }
const number = value => /^\d+(\.\d{1,4})?$/.test(value) && Number(value)<=100000000 ? Number(value) : null;
export function materialTotals(rows) {
 let low=0,high=0,unknown=0;
 for(const row of normalizeMaterials(rows)) { const q=number(row.quantity),a=number(row.low),b=number(row.high); if(q===null||a===null||b===null||b<a) {unknown++;continue;} low+=q*a;high+=q*b; }
 return {low,high,unknown};
}
export function materialLines(rows,budget='') {
 const items=normalizeMaterials(rows),t=materialTotals(items);
 if(!items.length)return ['아직 견적 항목이 없습니다. 전체 공사비는 산출 전입니다.'];
 return [...items.map(r=>`${r.id}. ${r.part||'부위 미정'} / ${r.action} / ${r.spec||'규격 미확인'} / ${r.quantity||'?'} ${r.unit.replaceAll('㎡','제곱미터')} / 단가 ${r.low||'?'}~${r.high||'?'}만원 / 근거: ${r.source||'미확인'}`),`입력된 항목 합계: ${t.low.toLocaleString('ko-KR')}~${t.high.toLocaleString('ko-KR')}만원 · 미견적 ${t.unknown}개`,...(budget!==''&&Number(budget)<t.high?['예산 상한 초과 — 공사 범위·우선순위 재협의 필요']:[]),'합계는 입력한 항목만 포함합니다. 부가세·철거·폐기·배송·설치·예비비 포함 여부를 확인해주세요.'];
}
