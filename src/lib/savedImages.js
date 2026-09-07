export const imageUrls = value => (Array.isArray(value) ? value : value ? [value] : []).filter(v=>typeof v === 'string' && v);
export function withSavedImages(result, section, urls) {
  return result ? { ...result, images:{ ...result.images, [section]:imageUrls(urls) } } : result;
}
export function assetImagesFrom(result) {
  return Object.fromEntries(Object.entries(result?.images || {}).filter(([k])=>k.startsWith('asset:')).map(([k,v])=>[k.slice(6),imageUrls(v)[0] || '']));
}
export function generatedImagesFrom(result) {
  const saved=result?.images || {};
  return { space:imageUrls(saved.space), ...Object.fromEntries(['menu','prop','service','materials','mustHave','signature','narrative'].map(k=>[k,imageUrls(saved[k])[0] || ''])), assets:assetImagesFrom(result) };
}
