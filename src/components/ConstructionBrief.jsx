import MaterialBudget from './MaterialBudget.jsx';
import { normalizeMaterials } from '../lib/materialBudget.js';
import FloorPlanEditor from './FloorPlanEditor.jsx';
import { emptyFloorPlan, normalizeFloorPlan } from '../lib/floorPlan.js';
import BriefExamples from './BriefExamples.jsx';
import { useRef, useState } from 'react';
import { BRIEF_FIELDS, normalizeBrief, missingBriefFields, validBudget, briefIdentity, parseBriefDraft } from '../lib/constructionBrief.js';
import { downloadConstructionPdf } from '../utils/constructionPdf.js';

const inputStyle = { width:'100%', boxSizing:'border-box', padding:10, border:'1px solid #d1d5db', borderRadius:8, font:'inherit' };
const buttonStyle = { padding:'10px 16px', borderRadius:8, border:'1px solid #c4b5fd', background:'#fff', color:'#5b21b6', cursor:'pointer' };
export default function ConstructionBrief({ resultData, storePhotos = [], spaceUrls = [], assetImages = {} }) {
  const [brief, setBrief] = useState(() => normalizeBrief({ address:resultData?.formData?.storeAddress || '' }));
  const [materials, setMaterials] = useState([]);
  const [plan, setPlan] = useState(emptyFloorPlan);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);
  const missing = missingBriefFields(brief);
  const budgetOk = validBudget(brief.budget);
  const saveDraft = () => {
    const blob = new Blob([JSON.stringify({ version:1, app:'rebrandboss', identity:briefIdentity(resultData), brief, plan, materials }, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '리브랜드보스_시공상담_초안.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('초안을 파일로 저장했습니다. 같은 프로젝트에서 다시 불러올 수 있습니다.');
  };
  const loadDraft = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 4000000) throw new Error('초안 파일은 4MB 이하여야 합니다.');
      const text = await file.text();
      setBrief(parseBriefDraft(text, resultData));
      setPlan(normalizeFloorPlan(JSON.parse(text).plan));
      setMaterials(normalizeMaterials(JSON.parse(text).materials));
      setMessage('초안을 불러왔습니다. 현장 정보가 현재와 맞는지 확인해주세요.');
    } catch (error) { setMessage(error.message); }
  };
  const download = async () => {
    if (busy || !budgetOk) return;
    setBusy(true); setMessage('');
    try {
      const { warnings } = await downloadConstructionPdf(resultData, { ...brief, plan, materials }, { storePhotos, spaceUrls, assetImages });
      setMessage(warnings.length ? `PDF를 저장했습니다. ${warnings.join(' ')}` : '리브랜딩 결과와 상담 요청을 함께 내려받았습니다.');
    } catch (error) { setMessage(`PDF 생성 실패: ${error.message}`); }
    finally { setBusy(false); }
  };
  return (
    <section style={{ background:'#fff', border:'1px solid #ddd6fe', borderRadius:20, padding:24 }}>
      <h3 style={{ marginTop:0 }}>시공 상담 준비</h3>
      <p>현재 매장에서 무엇을 유지하고 바꿀지, 영업을 얼마나 쉬거나 유지해야 할지 정리해 시공사에 견적을 요청하세요.</p>
      <p style={{ fontSize:13, color:'#6b7280' }}>아는 항목만 작성하세요. 빈 항목은 PDF에 ‘미확인’으로 표시됩니다. 자동 저장되지 않으므로 페이지를 떠나기 전에 초안을 저장해주세요.</p>
      <details>
        <summary style={{ cursor:'pointer', fontWeight:700 }}>현장·공사·영업 조건 작성하기 ({BRIEF_FIELDS.length - missing.length}/{BRIEF_FIELDS.length})</summary>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap:16, marginTop:16 }}>
          {BRIEF_FIELDS.map(([key, label, placeholder]) => <div key={key} style={{ display:'grid', alignContent:'start', gap:6, fontSize:13, gridColumn:key === 'dimensions' ? '1 / -1' : undefined }}>
            <label htmlFor={`construction-${key}`} style={{ fontWeight:700 }}>{label}</label>
            <BriefExamples field={key} />
            {key === 'dimensions' && <FloorPlanEditor value={plan} onChange={setPlan} />}
            {key === 'budget'
              ? <input id={`construction-${key}`} style={inputStyle} type="number" min="0" step="0.01" value={brief[key]} placeholder="예: 3000" onChange={e => setBrief(prev => ({ ...prev, [key]:e.target.value }))} />
              : <textarea id={`construction-${key}`} style={inputStyle} rows={3} maxLength={3000} value={brief[key]} placeholder={placeholder || '모르면 비워두세요'} onChange={e => setBrief(prev => ({ ...prev, [key]:e.target.value }))} />}
          </div>)}
        </div>
        <MaterialBudget value={materials} onChange={setMaterials} budget={brief.budget} />
      </details>
      <p style={{ fontSize:13 }}>화면에 있는 기존 매장 사진과 공간 연출 이미지를 구분해 PDF에 담습니다. 생성 이미지는 분위기 참고용이며, 치수·구조·시공 가능성은 현장에서 확인해야 합니다. 예산 상한은 공사 견적이 아닙니다.</p>
      {!storePhotos.length && <p style={{ fontSize:13, color:'#92400e' }}>현재 원본 매장 사진이 없습니다. 저장된 프로젝트를 열었다면 현장 사진을 별도로 전달해주세요.</p>}
      {!budgetOk && <p role="alert">예산은 0 이상의 숫자로 입력해주세요.</p>}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        <button type="button" style={buttonStyle} onClick={saveDraft} disabled={!budgetOk}>초안 저장</button>
        <button type="button" style={buttonStyle} onClick={() => fileRef.current?.click()}>초안 불러오기</button>
        <button type="button" style={{ ...buttonStyle, background:'#6d28d9', color:'#fff' }} disabled={busy || !budgetOk} onClick={download}>{busy ? 'PDF 만드는 중…' : '시공 상담용 PDF 다운로드'}</button>
        <input hidden ref={fileRef} type="file" accept=".json,application/json" aria-label="시공 상담 초안 파일" onChange={loadDraft} />
      </div>
      {message && <p role="status" style={{ fontSize:13 }}>{message}</p>}
    </section>
  );
}
