import ConstructionWizard from './ConstructionWizard.jsx';
import {normalizeAttachments} from '../lib/constructionHandoff.js';
import { comparisonEntries, normalizeComparisons } from '../lib/constructionHandoff.js';
import { normalizeMaterials } from '../lib/materialBudget.js';
import { emptyFloorPlan, normalizeFloorPlan, floorPlanGeometry } from '../lib/floorPlan.js';
import { useRef, useState } from 'react';
import { normalizeBrief, validBudget, briefIdentity, parseBriefDraft } from '../lib/constructionBrief.js';
import { downloadConstructionPdf } from '../utils/constructionPdf.js';

const buttonStyle = { padding:'10px 16px', borderRadius:8, border:'1px solid #c4b5fd', background:'#fff', color:'#5b21b6', cursor:'pointer' };
export default function ConstructionBrief({ resultData, storePhotos = [], spaceUrls = [], assetImages = {} }) {
  const [brief, setBrief] = useState(() => normalizeBrief({ address:resultData?.formData?.storeAddress || '' }));
  const [photoAttachments, setPhotoAttachments] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [plan, setPlan] = useState(emptyFloorPlan);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);
  const budgetOk = validBudget(brief.budget);
  const saveDraft = () => {
    const blob = new Blob([JSON.stringify({ version:1, app:'rebrandboss', identity:briefIdentity(resultData), brief, plan, materials, comparisons, photoAttachments }, null, 2)], { type:'application/json' });
    if(blob.size>20000000){setMessage('사진 용량이 커서 초안을 저장할 수 없습니다. 자재 사진을 줄여주세요.');return;}
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '리브랜드보스_시공상담_초안.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('초안을 파일로 저장했습니다. 같은 프로젝트에서 다시 불러올 수 있습니다.');
  };
  const loadDraft = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 20000000) throw new Error('초안 파일은 20MB 이하여야 합니다.');
      const text = await file.text();
      setBrief(parseBriefDraft(text, resultData));
      setPlan(normalizeFloorPlan(JSON.parse(text).plan));
      setMaterials(normalizeMaterials(JSON.parse(text).materials));
      setComparisons(normalizeComparisons(JSON.parse(text).comparisons));
      setPhotoAttachments(normalizeAttachments(JSON.parse(text).photoAttachments));
      setMessage('초안을 불러왔습니다. 현장 정보가 현재와 맞는지 확인해주세요.');
    } catch (error) { setMessage(error.message); }
  };
  const download = async () => {
    if (busy || !budgetOk) return;
    setBusy(true); setMessage('');
    try {
      const { warnings } = await downloadConstructionPdf(resultData, { ...brief, plan, materials, comparisons, photoAttachments }, { storePhotos, spaceUrls, assetImages });
      setMessage(warnings.length ? `PDF를 저장했습니다. ${warnings.join(' ')}` : '평면도와 공사 요청을 담은 시공 상담 PDF를 내려받았습니다.');
    } catch (error) { setMessage(`PDF 생성 실패: ${error.message}`); }
    finally { setBusy(false); }
  };
  const planReady = !floorPlanGeometry(plan).error;
  return <ConstructionWizard brief={brief} setBrief={setBrief} plan={plan} setPlan={setPlan} materials={materials} setMaterials={setMaterials} comparisons={comparisons} setComparisons={setComparisons} photoAttachments={photoAttachments} setPhotoAttachments={setPhotoAttachments} entries={comparisonEntries([...storePhotos,...photoAttachments],spaceUrls)} assets={assetImages}>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
      <button type="button" style={buttonStyle} disabled={busy||!budgetOk} onClick={saveDraft}>초안 저장</button>
      <button type="button" style={buttonStyle} disabled={busy} onClick={()=>fileRef.current?.click()}>초안 불러오기</button>
      <button type="button" style={{...buttonStyle,background:planReady?'#6d28d9':'#e2e8f0',color:planReady?'#fff':'#475569'}} disabled={busy||!budgetOk||!planReady} onClick={download}>{busy?'PDF 만드는 중…':'시공 상담용 PDF 다운로드'}</button>
      <input hidden ref={fileRef} type="file" accept=".json,application/json" onChange={loadDraft} aria-label="시공 상담 초안 파일"/>
    </div>
    {!planReady&&<p style={{fontSize:13}}>1단계에서 평면도를 만들면 PDF를 내려받을 수 있습니다.</p>}
    {!budgetOk&&<p role="alert">예산은 0 이상의 숫자로 적어주세요.</p>}
    {message&&<p role="status">{message}</p>}
  </ConstructionWizard>;
}
