import React, { useState, useRef } from 'react';
export default function EditRegions({ src, regions, onChange, disabled }) {
  const [enabled,setEnabled]=useState(false), [draft,setDraft]=useState(null);
  const start=useRef(null);
  const point=e=>{const b=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))};};
  const rect=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});
  return <div style={{fontSize:12}}>
    <button type="button" disabled={disabled} onClick={()=>{setEnabled(!enabled);onChange([]);setDraft(null);}}>{enabled?'영역 선택 닫기':'수정할 영역 선택 (선택)'}</button>
    {enabled && <>
      <p>바꿀 부분을 드래그해 표시하세요. 여러 곳을 선택할 수 있고, 표시 밖은 원본을 유지합니다.</p>
      <div style={{position:'relative',touchAction:'none',cursor:'crosshair'}}
        onPointerDown={e=>{if(disabled||regions.length>=20)return;e.currentTarget.setPointerCapture(e.pointerId);start.current=point(e);setDraft(null);}}
        onPointerMove={e=>{if(start.current)setDraft(rect(start.current,point(e)));}}
        onPointerUp={e=>{if(!start.current)return;const r=rect(start.current,point(e));start.current=null;setDraft(null);if(r.width>.005&&r.height>.005)onChange([...regions,r]);}}
        onPointerCancel={()=>{start.current=null;setDraft(null);}}>
        <img src={src} alt="수정 영역 선택" draggable={false} style={{display:'block',width:'100%',pointerEvents:'none'}}/>
        {[...regions,...(draft?[draft]:[])].map((r,i)=><div key={i} style={{position:'absolute',left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.width*100}%`,height:`${r.height*100}%`,background:'rgba(109,40,217,.25)',border:'2px solid #6d28d9',boxSizing:'border-box',pointerEvents:'none'}}/>)}
      </div>
      <button type="button" disabled={disabled||!regions.length} onClick={()=>onChange([])}>선택 지우기</button>
    </>}
  </div>;
}
