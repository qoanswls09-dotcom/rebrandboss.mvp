export async function readLocalPhoto(file) {
 if(!file||!['image/jpeg','image/png'].includes(file.type)||file.size>8*1024*1024)throw new Error('8MB 이하 JPG 또는 PNG 사진을 선택해주세요.');
 const url=URL.createObjectURL(file);
 try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,1200/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',0.75);if(data.length>=1500000)throw new Error('사진 크기를 줄여 다시 선택해주세요.');return data;}finally{URL.revokeObjectURL(url);}
}
