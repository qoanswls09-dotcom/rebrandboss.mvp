import {useEffect,useRef,useState} from 'react';
const readFileAsDataUrl = file => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('사진을 읽지 못했습니다.'));reader.readAsDataURL(file);});
import {drawComparison,loadComparisonImage,recordComparison} from '../lib/comparisonVideo.js';

export default function ComparisonVideo({before='',after='',title='매장'}) {
  const [open,setOpen]=useState(false),[source,setSource]=useState(before),[target,setTarget]=useState(after);
  const [seconds,setSeconds]=useState(12),[vertical,setVertical]=useState(false),[progress,setProgress]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[preview,setPreview]=useState(.65);
  const canvas=useRef(null),controller=useRef(null),objectUrl=useRef(''),mounted=useRef(true),selection=useRef({});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();URL.revokeObjectURL(objectUrl.current);};},[]);
  useEffect(()=>{setSource(before);},[before]);useEffect(()=>{setTarget(after);},[after]);
  useEffect(()=>{URL.revokeObjectURL(objectUrl.current);objectUrl.current='';setResult(null);},[source,target,seconds,vertical]);
  useEffect(()=>{
    let active=true;if(!open||!source||!target||busy)return;
    Promise.all([loadComparisonImage(source),loadComparisonImage(target)]).then(([a,b])=>{if(active&&canvas.current)drawComparison(canvas.current.getContext('2d'),a,b,preview,title);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
  },[open,source,target,preview,vertical,busy,title]);
  const choose=async(e,key)=>{const file=e.target.files?.[0];if(!file)return;const id=Symbol();selection.current[key]=id;setError('');try{if(file.size>20*1024*1024)throw new Error('20MB 이하의 사진을 선택해 주세요.');const data=await readFileAsDataUrl(file);await loadComparisonImage(data);if(mounted.current&&selection.current[key]===id)(key==='before'?setSource:setTarget)(data);}catch(err){if(mounted.current)setError(err.message);}e.target.value='';};
  const generate=async()=>{
    setError('');setBusy(true);setProgress(0);const abort=new AbortController();controller.current=abort;
    try {const [a,b]=await Promise.all([loadComparisonImage(source),loadComparisonImage(target)]);if(abort.signal.aborted)return;const out=await recordComparison({canvas:canvas.current,before:a,after:b,seconds,title,signal:abort.signal,onProgress:p=>{if(mounted.current)setProgress(p);}});if(!mounted.current)return;URL.revokeObjectURL(objectUrl.current);objectUrl.current=URL.createObjectURL(out.blob);setResult({url:objectUrl.current,extension:out.extension});}
    catch(e){if(mounted.current)setError(e.message);}
    finally{if(mounted.current)setBusy(false);}
  };
  return <section style={{margin:'12px 0',padding:12,border:'1px solid #C4B5FD',borderRadius:10}}>
    <button type="button" disabled={busy} onClick={()=>setOpen(!open)} style={{padding:10,width:'100%',fontWeight:700}}>전후 비교영상 만들기 · 추가 크레딧 없음</button>
    {open&&<>
      <p style={{fontSize:13,lineHeight:1.7}}>같은 각도의 원본·변경 사진으로 현재 모습 → 화면 전환 → 변경 제안 → 나란히 비교 영상을 만듭니다. 소리 없는 사진 비교영상이며, 사람 분리나 촬영 영상 배경 교체는 포함하지 않습니다.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{[['before','원본 사진',source],['after','변경 사진',target]].map(([key,label,value])=><label key={key}>{label}{value&&<img src={value} alt={label} style={{display:'block',width:'100%',height:120,objectFit:'contain'}}/>}<input aria-label={label+' 선택'} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>choose(e,key)}/></label>)}</div>
      <p style={{fontSize:12}}>사진 파일은 이 기기에서 처리합니다. 원본이 없으면 직접 선택해 주세요. 변경 사진 생성·수정 비용은 별도입니다.</p>
      <label>길이 <select disabled={busy} value={seconds} onChange={e=>setSeconds(Number(e.target.value))}>{[8,12,20].map(n=><option key={n} value={n}>{n}초</option>)}</select></label>{' '}
      <label>화면 <select disabled={busy} value={vertical?'vertical':'wide'} onChange={e=>setVertical(e.target.value==='vertical')}><option value="wide">유튜브 가로 16:9</option><option value="vertical">쇼츠 세로 9:16</option></select></label>
      <canvas ref={canvas} width={vertical?720:1280} height={vertical?1280:720} aria-label="전후 비교 미리보기" style={{display:'block',width:'100%',maxHeight:450,objectFit:'contain',background:'#141419',margin:'12px 0'}}/>
      <label>장면 미리보기 <input aria-label="장면 미리보기" type="range" min="0" max="1" step="0.01" value={preview} disabled={busy} onChange={e=>setPreview(Number(e.target.value))}/></label>
      {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
      <div style={{marginTop:12}}><button type="button" disabled={busy||!source||!target} onClick={generate}>{busy?`영상 만드는 중 ${Math.round(progress*100)}%`:'비교영상 만들기'}</button>{busy&&<button type="button" onClick={()=>controller.current?.abort()}>취소</button>}</div>
      <p style={{fontSize:12}}>만드는 동안 이 화면을 열어 두세요. MP4 지원 브라우저는 MP4로, 나머지는 WebM으로 저장합니다.</p>
      {result&&<div><video src={result.url} controls playsInline style={{width:'100%',maxHeight:450}}/><a href={result.url} download={`brandboss-before-after.${result.extension}`} style={{display:'inline-block',padding:12,fontWeight:700}}>비교영상 다운로드 (.{result.extension})</a><p style={{fontSize:12}}>화면을 떠나기 전에 다운로드해 주세요.</p></div>}
    </>}
  </section>;
}

