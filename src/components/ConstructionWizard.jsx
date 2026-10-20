import {useState,useRef,useEffect} from 'react';
import FloorPlanEditor from './FloorPlanEditor.jsx';
import BriefExamples from './BriefExamples.jsx';
import ComparisonEditor from './ComparisonEditor.jsx';
import PhotoAttachments from './PhotoAttachments.jsx';
import MaterialBudget from './MaterialBudget.jsx';
import {floorPlanGeometry,floorPlanSummary} from '../lib/floorPlan.js';
import {materialTotals} from '../lib/materialBudget.js';
import {resolveComparisons} from '../lib/constructionHandoff.js';
const steps=['매장 크기','유지·변경','사진 비교','자재·예산','마지막 확인'];
const input={width:'100%',boxSizing:'border-box',padding:12,border:'1px solid #cbd5e1',borderRadius:8,font:'inherit',fontSize:15,lineHeight:1.6};
const button={padding:'12px 18px',border:'1px solid #c4b5fd',borderRadius:9,background:'#fff',color:'#5b21b6',fontSize:15,fontWeight:700,cursor:'pointer',minHeight:46};
const labels={address:['매장은 어디인가요?','예: 서울 ○○로 12, 2층'],dimensions:['크기에 대해 더 알려줄 내용이 있나요?','예: 천장 높이 2.7m. 10월 20일 줄자로 측정했어요.'],fixed:['위치를 바꾸면 안 되는 곳','예: 입구, 창문, 기둥, 주방 배수구는 그대로 둬요.'],keep:['그대로 쓸 물건과 마감','예: 냉장고, 테이블 6개, 바닥 타일은 계속 써요.'],change:['이번에 바꾸고 싶은 곳','예: 벽을 밝게 칠하고 조명만 바꿔요. 계단은 건드리지 않아요.'],layout:['자리나 이동 길에 바라는 점','예: 카운터 앞 통로를 넓게 쓰고 싶어요.'],finishes:['원하는 색이나 재료','예: 벽은 밝은 베이지, 가구는 밝은 나무 느낌'],budget:['쓸 수 있는 총예산 (만원)','예: 3000'],budgetScope:['예산에 무엇까지 포함하나요?','예: 철거, 가구, 설치, 세금까지 모두 포함'],priority:['예산이 부족하면 무엇부터 할까요?','예: 조명은 꼭 바꾸고, 의자 교체는 다음에 할게요.'],schedule:['언제 공사하고 싶나요?','예: 11월 첫째 주부터, 2주 안에 끝내고 싶어요.'],closure:['가게를 며칠 쉴 수 있나요?','예: 최대 3일 / 월요일 휴무에만 가능'],operating:['영업하면서 지켜야 할 점','예: 냉장고 전원은 계속 켜두고 밤 10시 이후에 작업해요.'],approval:['건물주와 이야기한 내용','예: 간판 교체는 허락받았고, 벽 철거는 아직 물어보지 않았어요.'],questions:['업체에 확인하고 싶은 것','예: 전기를 더 쓸 수 있는지, 누수가 있는지 확인해주세요.']};
export default function ConstructionWizard({brief,setBrief,plan,setPlan,materials,setMaterials,comparisons,setComparisons,photoAttachments,setPhotoAttachments,entries,assets,children}) {
 const [open,setOpen]=useState(false),[step,setStep]=useState(0);const heading=useRef(null);
 useEffect(()=>{if(open)heading.current?.focus();},[open,step]);
 const geometry=floorPlanGeometry(plan),totals=materialTotals(materials),pairs=resolveComparisons(comparisons,entries);
 const field=key=>Object.hasOwn(brief,key)&&<label key={key} style={{display:'grid',gap:8,fontSize:15,fontWeight:600,marginBottom:22}}>{labels[key][0]}{key==='budget'?<input aria-label={labels[key][0]} style={input} type="number" min="0" step="0.01" placeholder={labels[key][1]} value={brief[key]} onChange={e=>setBrief(prev=>({...prev,[key]:e.target.value}))}/>:<textarea aria-label={labels[key][0]} style={input} rows={2} maxLength={3000} placeholder={labels[key][1]} value={brief[key]} onChange={e=>setBrief(prev=>({...prev,[key]:e.target.value}))}/>}</label>;
 return <section style={{background:'#fff',border:'2px solid #ddd6fe',borderRadius:18,padding:'clamp(16px,3vw,28px)',margin:'24px 0',color:'#1f2937',lineHeight:1.65}}>
 <h3 style={{margin:'0 0 8px',fontSize:23}}>시공 상담 준비</h3><p style={{margin:'0 0 18px',color:'#475569'}}>매장 크기와 바꿀 곳을 알려주세요. 평면도와 사진 비교를 한 PDF에 담아드립니다.</p>
 <button type="button" aria-expanded={open} style={{...button,width:'100%',background:'#6d28d9',color:'#fff',fontSize:20,padding:18,border:0,textAlign:'left'}} onClick={()=>setOpen(!open)}>{open?'현장 실측 자료 입력 · 접기':'현장 실측 자료 입력  →'}</button>
 {!open&&<p style={{fontSize:13,color:'#64748b'}}>5단계로 하나씩 작성합니다. 처음이어도 괜찮아요. 모르는 내용은 비워두세요.</p>}
 {open&&<div style={{maxWidth:760,margin:'24px auto 0'}}>
 <nav aria-label="현장 자료 작성 단계" style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:24}}>{steps.map((title,i)=><button type="button" key={title} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)} style={{...button,fontSize:13,padding:'8px 10px',minHeight:40,background:step===i?'#ede9fe':'#fff',borderColor:step===i?'#7c3aed':'#e2e8f0'}}>{i+1}. {title}</button>)}</nav>
 <h4 ref={heading} tabIndex={-1} style={{fontSize:22,margin:'0 0 8px',outline:'none'}}>{step+1} / 5 · {steps[step]}</h4>
 {step===0&&<><p>매장 모양을 고르고 길이를 입력하세요. 아래에 평면도가 바로 나타납니다.</p><BriefExamples field="dimensions"/><div style={{margin:'16px 0'}}><FloorPlanEditor value={plan} onChange={setPlan}/></div><p style={{background:'#ecfdf5',padding:12,borderRadius:8,color:'#166534'}}>만든 평면도는 시공 상담용 PDF에 자동으로 들어갑니다.</p>{field('address')}<details><summary style={{cursor:'pointer'}}>천장 높이·측정일 더 적기 (선택)</summary>{field('dimensions')}</details></>}
 {step===1&&<><p>바꿀 곳과 그대로 둘 곳만 구분해 주세요.</p>{['fixed','keep','change'].map(key=><div key={key}><BriefExamples field={key}/>{field(key)}</div>)}<details><summary style={{cursor:'pointer'}}>자리·색상·재료도 적기 (선택)</summary>{field('layout')}{field('finishes')}</details></>}
 {step===2&&<><p>같은 장소의 실제 사진과 변경 제안을 나란히 선택하세요.</p><PhotoAttachments value={photoAttachments} onChange={setPhotoAttachments}/><ComparisonEditor value={comparisons} onChange={setComparisons} entries={entries}/><p style={{fontSize:13,color:'#92400e'}}>생성 이미지에 없던 계단·창문이 보이면 작업 메모에 제외할 부분을 적어주세요. 사진만 보고 구조를 변경하면 안 됩니다.</p></>}
 {step===3&&<><p>먼저 총예산만 적어도 됩니다. 제품과 단가는 아는 경우에만 추가하세요.</p>{field('budget')}{field('priority')}<details><summary style={{cursor:'pointer'}}>자재 이름·사진·항목별 금액 작성 (선택)</summary><MaterialBudget value={materials} onChange={setMaterials} budget={brief.budget} assets={assets}/></details><details style={{marginTop:18}}><summary style={{cursor:'pointer'}}>예산 포함 범위·공사 일정 작성 (선택)</summary>{['budgetScope','schedule','closure','operating','approval'].map(field)}</details></>}
 {step===4&&<><p>아래 내용을 확인하고 PDF를 내려받으세요. 비어 있는 항목은 ‘미확인’으로 표시됩니다.</p><div style={{border:'1px solid #ddd6fe',padding:16,borderRadius:10}}><p><strong>평면도:</strong> {geometry.error?'아직 만들지 않았어요. 1단계에서 입력해주세요.':floorPlanSummary(plan)}</p><p><strong>사진 비교:</strong> {pairs.filter(p=>p.beforeImage&&p.afterImage).length}쌍 연결 / {pairs.filter(p=>!p.beforeImage||!p.afterImage).length}쌍 사진 확인 필요</p><p><strong>총예산:</strong> {brief.budget?`${brief.budget}만원`:'미입력'}</p><p><strong>자재·공사:</strong> {materials.length}개 항목 / {totals.unknown}개 미견적</p><p><strong>작성한 금액 합계:</strong> {materials.length?`${totals.low.toLocaleString()}~${totals.high.toLocaleString()}만원`:'아직 견적이 없어요.'}</p></div><p style={{fontSize:13}}>합계는 입력한 항목만 포함합니다. 업체의 최종 견적은 현장 확인 후 정해집니다.</p>{field('questions')}{geometry.error&&<button type="button" style={button} onClick={()=>setStep(0)}>평면도 입력하러 가기</button>}</>}
 <div style={{display:'flex',gap:12,justifyContent:'space-between',marginTop:28,borderTop:'1px solid #e2e8f0',paddingTop:18}}><button type="button" style={button} disabled={step===0} onClick={()=>setStep(step-1)}>이전</button>{step<4&&<button type="button" style={{...button,background:'#6d28d9',color:'#fff'}} onClick={()=>setStep(step+1)}>다음 · {steps[step+1]} →</button>}</div>
 </div>}
 <div style={{marginTop:24,borderTop:'1px solid #e2e8f0',paddingTop:18}}><p style={{fontSize:13,color:'#64748b'}}>입력한 내용은 자동 저장되지 않습니다. 나중에 이어 하려면 ‘초안 저장’을 눌러주세요.</p>{children}</div>
 </section>;
}
