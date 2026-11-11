// Resolve only known application-relative image routes; never guess arbitrary origins.
export function spaceReferenceUrl(value) {
 if(typeof value!=='string')return '';
 if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))return value;
 if(/^\/\.netlify\/functions\/rebrand-image\?key=[A-Za-z0-9_-]+$/.test(value))return 'https://musical-bublanina-33a85a.netlify.app'+value;
 try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
export function spaceContext(result={},selections={},images=[],referenceIndex=0) {
 const b=result.brandDecision||result.rebrandDecision||result.franchiseDecision||{};
 const references=[...new Set([...(Array.isArray(images)?images:[]),selections.image].map(spaceReferenceUrl).filter(Boolean))];
 return {name:b.brandName||b.newBrandName||result.formData?.brandName||'',concept:b.storeConcept||b.newConcept||b.brandMessage||'',category:result.formData?.category||'',selections,reference:references[referenceIndex]||references[0]||'',references};
}
