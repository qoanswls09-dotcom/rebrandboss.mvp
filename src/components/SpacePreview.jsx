import {spaceContext} from '../lib/spaceContext.js';
import {useEffect,useRef,useState} from 'react';
import {normalizeBlueprint,blueprintReady,spaceRequirementsKey} from '../lib/spaceBlueprint.js';
export default function SpacePreview({resultData,selections,images=[],onApply,onClear,generationConnected=true}) {
 const [referenceIndex,setReferenceIndex]=useState(0);
 const [open,setOpen]=useState(false),[message,setMessage]=useState('');const frame=useRef(null);const current=useRef({selections,onApply});current.current={selections,onApply};
 const plan=normalizeBlueprint(selections?.spacePlan),ready=blueprintReady(plan,selections);
 const baseContext=spaceContext(resultData,selections,images,referenceIndex);
 const payload={...baseContext,blueprint:plan,applySelections:!ready};
 const send=()=>frame.current?.contentWindow?.postMessage({type:'brandboss-space-context',payload},window.location.origin);
 useEffect(()=>{const receive=e=>{if(e.origin!==window.location.origin||e.source!==frame.current?.contentWindow||e.data?.type!=='brandboss-space-apply')return;const plan=normalizeBlueprint({...e.data.payload,requirementsKey:spaceRequirementsKey(current.current.selections)});if(!blueprintReady(plan,current.current.selections)){setMessage('배치를 받지 못했습니다. 3D 화면에서 다시 확정해주세요.');return}current.current.onApply?.(plan);setMessage(generationConnected?'공간 기준을 확정했습니다. ‘공간 연출’의 3D 배치 사용 항목을 선택하면 이 배치로 생성합니다. 원본 구조 보존을 먼저 확인해주세요.':'3D 검토 배치를 저장했습니다. 리뉴얼 이미지 생성에는 아직 자동 적용되지 않습니다.');};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[]);
 return <section style={{margin:'20px 0',padding:20,border:'1px solid #cdd8ca',borderRadius:14,background:'#f7faf4',color:'#304835'}}>
 <h3 style={{margin:'0 0 10px'}}>이미지와 3D가 함께 사용할 공간 기준</h3>
 <p style={{fontSize:13,lineHeight:1.7}}>먼저 크기·출입구·배치·소재를 정하고 3D에서 확정하세요. {generationConnected?'확정한 모델의 3개 시점이 공간 이미지 생성에 전달됩니다.':'리뉴얼 이미지와 비교하는 검토용입니다. 기존 구조 보존과 이미지 재생성 연결은 아직 검증 전입니다.'} 기존 사진의 숨은 구조를 자동 복원하거나 생성 이미지의 완전 일치를 보장하는 기능은 아닙니다.</p>
 <p role="status" style={{fontSize:13,fontWeight:700}}>{plan?(ready?(generationConnected?'✓ 공간 기준 확정 · 다음 이미지 생성에 적용':'✓ 3D 검토 배치 저장 · 이미지 생성 미연결'):'공간 선택이 바뀌었습니다. 3D를 열어 배치를 다시 확정해주세요.'):'공간 기준 미확정 · 아직 기본 템플릿입니다.'}</p>
 {plan&&<p style={{fontSize:12}}>크기 {plan.state.width} × {plan.state.depth}m · 높이 {plan.state.height}m · 정면 입구 {plan.state.doorWidth}m · {plan.state.dimensionSource==='concept'?'미측정 개념값':'사용자 입력 치수 · 현장 검증 별도'}</p>}
 {baseContext.references.length>0&&<label style={{display:'block',marginBottom:12}}>비교할 저장 이미지 <select value={referenceIndex} onChange={e=>{setReferenceIndex(Number(e.target.value));setMessage('비교 사진을 바꿨습니다. 열린 3D 화면에는 ‘현재 선택 다시 적용’을 눌러 전달해주세요.');}}>{baseContext.references.map((url,i)=><option key={url} value={i}>공간 이미지 {i+1}</option>)}</select><img src={baseContext.reference} alt="선택한 원본 인테리어" style={{display:'block',maxWidth:360,width:'100%',marginTop:12,borderRadius:8}}/></label>}
 <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} style={{padding:'12px 18px',borderRadius:8,border:0,background:'#34523e',color:'white',cursor:'pointer'}}>{open?'3D 닫기':'공간 기준을 3D로 정하기'}</button>
 {plan&&<button type="button" onClick={onClear} style={{marginLeft:8,padding:10}}>3D 기준 해제</button>}
 {open&&<><button type="button" onClick={send} style={{marginLeft:10,padding:'12px 16px',borderRadius:8,border:'1px solid #b6c5af',background:'white',cursor:'pointer'}}>현재 선택 다시 적용</button><p style={{fontSize:12}}>3D 화면의 ‘이 배치를 이미지 생성 기준으로 확정’을 누르면 현재 결과 화면에 임시 보관됩니다. 새로고침 전 ‘설정 저장’을 이용하세요. 다른 기기로 옮기려면 ‘설정 저장’ 또는 시공자료 ‘초안 저장’을 사용하세요.</p><iframe ref={frame} title="브랜드보스 3D 공간 실험실" src="/space-3d.html" onLoad={send} style={{display:'block',width:'100%',height:'min(1050px,88vh)',minHeight:560,border:'1px solid #d8dfd1',borderRadius:12,background:'#f4f3ee'}}/></>}
 {message&&<p role="status">{message}</p>}
 </section>;
}
