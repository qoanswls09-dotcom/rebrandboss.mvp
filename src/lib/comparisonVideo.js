export function comparisonPhase(progress) {
  const p=Math.max(0,Math.min(1,progress));
  return p<.2 ? {mode:'before',amount:0} : p<.45 ? {mode:'wipe',amount:(p-.2)/.25} : p<.8 ? {mode:'after',amount:1} : {mode:'split',amount:1};
}
export function containRect(iw,ih,x,y,w,h) {
  const scale=Math.min(w/iw,h/ih);
  return {x:x+(w-iw*scale)/2,y:y+(h-ih*scale)/2,width:iw*scale,height:ih*scale};
}
export function videoFormat(supports) {
  return ['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm'].find(supports) || '';
}
export function loadComparisonImage(src) {
  return new Promise((resolve,reject)=>{
    const image=new Image();image.crossOrigin='anonymous';
    const timeout=setTimeout(()=>reject(new Error('사진을 불러오는 시간이 초과됐습니다. 사진 파일을 직접 선택해 주세요.')),20000);
    image.onload=()=>{clearTimeout(timeout);resolve(image);};
    image.onerror=()=>{clearTimeout(timeout);reject(new Error('사진을 불러오지 못했습니다. 원본·변경 사진 파일을 직접 선택해 주세요.'));};image.src=src;
  });
}
export function drawComparison(ctx,before,after,progress,title='') {
  const {width:w,height:h}=ctx.canvas;
  const draw=(img,x,y,bw,bh)=>{const r=containRect(img.naturalWidth,img.naturalHeight,x,y,bw,bh);ctx.drawImage(img,r.x,r.y,r.width,r.height);};
  const label=(text,x,y)=>{ctx.font=`600 ${Math.round(w*.022)}px sans-serif`;const tw=ctx.measureText(text).width;ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(x-10,y-w*.026,tw+20,w*.038);ctx.fillStyle='white';ctx.fillText(text,x,y);};
  ctx.fillStyle='#141419';ctx.fillRect(0,0,w,h);
  const phase=comparisonPhase(progress);
  if(phase.mode==='split') {draw(before,0,0,w/2-2,h);draw(after,w/2+2,0,w/2-2,h);label('현재 모습',w*.02,h*.09);label('변경 제안',w*.52,h*.09);}
  else {
    draw(phase.mode==='after'?after:before,0,0,w,h);
    if(phase.mode==='wipe') {ctx.save();ctx.beginPath();ctx.rect(0,0,w*phase.amount,h);ctx.clip();draw(after,0,0,w,h);ctx.restore();ctx.fillStyle='#a78bfa';ctx.fillRect(w*phase.amount-2,0,4,h);}
    label(phase.mode==='before'?'현재 모습':'변경 제안',w*.025,h*.09);
  }
  label(`${title ? title.slice(0,32)+' · ' : ''}AI 변경 제안`,w*.025,h*.95);
}
export async function recordComparison({canvas,before,after,seconds=12,title='',onProgress=()=>{},signal}) {
  if(![8,12,20].includes(seconds)) throw new Error('영상 길이를 다시 선택해 주세요.');
  if(typeof MediaRecorder==='undefined' || !canvas.captureStream) throw new Error('이 브라우저에서는 영상 저장을 지원하지 않습니다. 최신 Chrome 또는 Edge에서 열어주세요.');
  if(signal?.aborted) throw new Error('취소했습니다.');
  if(document.hidden) throw new Error('이 화면을 열어 둔 상태에서 시작해 주세요.');
  const mimeType=videoFormat(t=>MediaRecorder.isTypeSupported(t));
  if(!mimeType) throw new Error('지원되는 영상 저장 형식이 없습니다. 최신 Chrome 또는 Edge에서 열어주세요.');
  const ctx=canvas.getContext('2d');drawComparison(ctx,before,after,0,title);
  // Throw before recording if a remote image taints the canvas.
  ctx.getImageData(0,0,1,1);
  const stream=canvas.captureStream(30);
  return new Promise((resolve,reject)=>{
    let recorder,frame,timer,settled=false;const chunks=[];
    const clean=()=>{cancelAnimationFrame(frame);clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);signal?.removeEventListener('abort',abort);stream.getTracks().forEach(t=>t.stop());};
    const fail=error=>{if(settled)return;settled=true;if(recorder?.state==='recording')recorder.stop();clean();reject(error);};
    const abort=()=>fail(new Error('영상 만들기를 취소했습니다.'));
    const visibility=()=>{if(document.hidden)fail(new Error('화면이 닫히거나 다른 탭으로 이동해 중단됐습니다. 이 화면을 열어 두고 다시 만들어 주세요.'));};
    try {
      recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:6000000});
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onerror=()=>fail(new Error('영상 저장 중 오류가 발생했습니다. 다시 시도해 주세요.'));
      recorder.onstop=()=>{if(settled)return;settled=true;clean();const blob=new Blob(chunks,{type:recorder.mimeType});if(!blob.size)return reject(new Error('영상 데이터가 비어 있습니다.'));onProgress(1);resolve({blob,extension:recorder.mimeType.includes('mp4')?'mp4':'webm'});};
      signal?.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',visibility);
      recorder.start(250);const start=performance.now();
      const tick=now=>{if(settled)return;try{const p=Math.min(1,(now-start)/(seconds*1000));drawComparison(ctx,before,after,p,title);onProgress(p);if(p>=1){recorder.stop();return;}frame=requestAnimationFrame(tick);}catch(e){fail(e);}};
      frame=requestAnimationFrame(tick);timer=setTimeout(()=>fail(new Error('영상 만들기가 지연되어 중단됐습니다. 다시 시도해 주세요.')),(seconds+15)*1000);
    } catch(e) {fail(e);}
  });
}

