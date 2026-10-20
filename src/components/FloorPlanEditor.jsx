import { useState } from 'react';
import { floorPlanGeometry, floorPlanSummary } from '../lib/floorPlan.js';
const input={width:'100%',padding:8,border:'1px solid #d1d5db',borderRadius:7,boxSizing:'border-box',font:'inherit'};
export default function FloorPlanEditor({ value, onChange }) {
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const geometry=floorPlanGeometry(value);
  const set=(key,v)=>onChange({...value,[key]:v});
  const upload=async event=>{
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    setBusy(true);setError('');
    let url;
    try {
      if(!['image/jpeg','image/png'].includes(file.type)||file.size>8*1024*1024)throw new Error('8MB 이하의 JPG 또는 PNG 도면 사진을 선택해주세요.');
      url=URL.createObjectURL(file);
      const img=new Image();img.src=url;await img.decode();
      const scale=Math.min(1,1600/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
      set('drawing',canvas.toDataURL('image/jpeg',0.85));
    } catch(e){setError(e.message);} finally{if(url)URL.revokeObjectURL(url);setBusy(false);}
  };
  const scale=geometry.width ? Math.min(420/geometry.width,230/geometry.depth) : 1;
  const left=(600-(geometry.width || 0)*scale)/2, top=35;
  const right=left+(geometry.width || 0)*scale, bottom=top+(geometry.depth || 0)*scale;
  const points=geometry.points.map(([x,y])=>`${left+x*scale},${top+y*scale}`).join(' ');
  return <div style={{border:'1px solid #c4b5fd',borderRadius:12,padding:16,background:'#faf9ff'}}>
    <strong>내 매장 간이평면도 만들기</strong>
    <p style={{fontSize:13,lineHeight:1.6}}>길이는 m로 적어주세요. 예: 600cm는 6m입니다. 모양이 복잡하면 직접 그린 그림을 사진으로 올려도 됩니다.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:12}}>
      <label>매장 모양<select style={input} value={value.shape} onChange={e=>set('shape',e.target.value)}><option value="rectangle">직사각형</option><option value="l">ㄱ자</option><option value="custom">다른 모양 · 도면 사진 첨부</option></select></label>
      <label>길이는 어떻게 확인했나요?<select style={input} value={value.source} onChange={e=>set('source',e.target.value)}><option value="unmeasured">아직 확인하지 않음</option><option value="measured">줄자로 직접 쟀어요</option><option value="drawing">도면에서 확인했어요</option><option value="approximate">대략적인 길이예요</option></select></label>
      {value.shape!=='custom' && [['width','전체 가로 (m)'],['depth','전체 세로 (m)'],...(value.shape==='l'?[['notchWidth','빠진 부분 가로 (m)'],['notchDepth','빠진 부분 세로 (m)']]:[])].map(([key,label])=><label key={key}>{label}<input style={input} type="number" min="0.01" max="100" step="0.01" value={value[key]} placeholder={key==='width'?'예: 6':key==='depth'?'예: 8':key==='notchWidth'?'예: 2':'예: 3'} onChange={e=>set(key,e.target.value)} /></label>)}
      {value.shape==='l'&&<label>빠진 부분 위치<select style={input} value={value.corner} onChange={e=>set('corner',e.target.value)}><option value="tr">오른쪽 위</option><option value="tl">왼쪽 위</option><option value="br">오른쪽 아래</option><option value="bl">왼쪽 아래</option></select></label>}
    </div>
    {value.shape==='custom'&&<div style={{marginTop:12}}><label>직접 그린 그림이나 도면 사진 (JPG/PNG, 8MB 이하)<input style={{display:'block',marginTop:8}} type="file" accept="image/jpeg,image/png" disabled={busy} onChange={upload}/></label><p style={{fontSize:12}}>종이에 매장 모양을 그리고, 각 벽의 길이와 입구·창문·기둥 위치를 적어 사진을 올려주세요.</p>{value.drawing&&<button type="button" onClick={()=>set('drawing','')}>도면 사진 제거</button>}</div>}
    {error&&<p role="alert">{error}</p>}
    {busy&&<p role="status">도면 사진 준비 중…</p>}
    {geometry.error?<p style={{fontSize:13,color:'#6b7280'}}>{geometry.error}</p>:<figure style={{margin:'16px 0 0',background:'#fff',borderRadius:10,padding:12}}>
      {value.shape==='custom'?<img src={value.drawing} alt="사용자가 첨부한 매장 도면" style={{maxWidth:'100%',maxHeight:360,display:'block',margin:'auto'}}/>:
        <svg viewBox="0 0 600 330" style={{width:'100%',maxHeight:360}} role="img" aria-label={floorPlanSummary(value)}>
          <polygon points={points} fill="#ede9fe" stroke="#7c3aed" strokeWidth="3"/>
          <path d={`M${left} ${bottom+10}v12 M${right} ${bottom+10}v12 M${left} ${bottom+16}H${right} M${left-12} ${top}h-12 M${left-12} ${bottom}h-12 M${left-18} ${top}V${bottom}`} fill="none" stroke="#9ca3af"/>
          <text x={(left+right)/2} y={bottom+39} textAnchor="middle" fontSize="17" fill="#5b21b6">{geometry.width}m</text>
          <text x={left-30} y={(top+bottom)/2} textAnchor="end" fontSize="17" fill="#5b21b6">{geometry.depth}m</text>
          {value.shape==='l'&&<text x="300" y="325" textAnchor="middle" fontSize="14" fill="#6b7280">빠진 부분: {value.notchWidth}m × {value.notchDepth}m</text>}
        </svg>}
      <figcaption style={{fontSize:12,lineHeight:1.6,marginTop:8}}>{floorPlanSummary(value)}<br/>매장 바깥 모양을 정리한 그림입니다. 벽·문·기둥과 가구 위치는 업체가 현장에서 확인해야 합니다.</figcaption>
    </figure>}
  </div>;
}
