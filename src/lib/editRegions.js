export function pixelRegions(regions, width, height) {
  const clamp = v => Math.max(0, Math.min(1, Number(v) || 0));
  return (regions || []).slice(0,20).map(r => {
    const x=Math.floor(clamp(r.x)*width), y=Math.floor(clamp(r.y)*height);
    return { x, y, width:Math.max(0,Math.ceil(clamp(r.x+r.width)*width)-x), height:Math.max(0,Math.ceil(clamp(r.y+r.height)*height)-y) };
  }).filter(r=>r.width>0 && r.height>0);
}
export async function preserveOutsideRegions(original, edited, regions) {
  if (!regions?.length) return edited;
  const load = src => new Promise((resolve,reject) => {
    const img = new Image(); img.crossOrigin='anonymous';
    img.onload=()=>resolve(img); img.onerror=()=>reject(new Error('부분 수정용 이미지를 불러오지 못했습니다. 원본은 유지됩니다.')); img.src=src;
  });
  const [base,next]=await Promise.all([load(original),load(edited)]);
  const canvas=document.createElement('canvas'); canvas.width=base.naturalWidth; canvas.height=base.naturalHeight;
  const context=canvas.getContext('2d');
  context.drawImage(base,0,0);
  const originalPixels=context.getImageData(0,0,canvas.width,canvas.height);
  context.drawImage(next,0,0,canvas.width,canvas.height);
  const editedPixels=context.getImageData(0,0,canvas.width,canvas.height);
  const mask=new Uint8Array(canvas.width*canvas.height);
  for(const r of pixelRegions(regions,canvas.width,canvas.height)) {
    const feather=Math.max(1,Math.min(r.width,r.height)*0.08);
    for(let y=r.y;y<r.y+r.height;y++)for(let x=r.x;x<r.x+r.width;x++) {
      const distance=Math.min(x-r.x,r.x+r.width-1-x,y-r.y,r.y+r.height-1-y)+0.5;
      const index=y*canvas.width+x;
      mask[index]=Math.max(mask[index],Math.round(255*Math.min(1,distance/feather)));
    }
  }
  for(let pixel=0;pixel<mask.length;pixel++)if(mask[pixel]) {
    const alpha=mask[pixel]/255;
    for(let channel=0;channel<3;channel++) {
      const i=pixel*4+channel;
      originalPixels.data[i]=Math.round(originalPixels.data[i]*(1-alpha)+editedPixels.data[i]*alpha);
    }
  }
  context.putImageData(originalPixels,0,0);
  return canvas.toDataURL('image/png');
}
