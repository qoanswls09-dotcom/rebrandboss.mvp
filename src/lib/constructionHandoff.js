export function normalizeComparisons(value) {
 return (Array.isArray(value)?value:[]).slice(0,12).map(r=>({zone:String(r?.zone||'').slice(0,200),before:String(r?.before||'').slice(0,100),after:String(r?.after||'').slice(0,100),work:String(r?.work||'').slice(0,1500)}));
}
export function comparisonEntries(photos=[],spaces=[]) {
 const fingerprint=value=>{let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);return (hash>>>0).toString(16);};
 const src=p=>typeof p==='string'?p:p?.base64||p?.dataUrl||p?.url||'';
 return [...photos.map((p,i)=>({id:`before-${i}-${fingerprint(src(p))}`,kind:'before',label:`현장 사진 ${i+1}`,src:src(p)})),...spaces.map((p,i)=>({id:`after-${i}-${fingerprint(src(p))}`,kind:'after',label:`변경 제안 ${i+1}`,src:src(p)}))].filter(e=>e.src);
}
export function resolveComparisons(rows,entries) {
 return normalizeComparisons(rows).map(r=>({...r,beforeImage:entries.find(e=>e.kind==='before'&&e.id===r.before),afterImage:entries.find(e=>e.kind==='after'&&e.id===r.after)}));
}

export function normalizeAttachments(value){return (Array.isArray(value)?value:[]).filter(v=>typeof v==='string'&&v.length<1500000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v)).slice(0,8);}
