import React, { useRef } from 'react';

// ── 상수 ─────────────────────────────────────────────────
export const STEP_TITLES = {
  1: '매장 정보', 2: '현재 상황', 3: '매장 사진', 4: '예산 / 범위', 5: '원하는 방향',
};
const STEP_DESCS = {
  1: '현재 운영 중인 매장 정보를 알려주세요',
  2: '지금 매장의 문제점과 바꾸고 싶은 것은 무엇인가요?',
  3: '매장 사진과 대표 메뉴 사진을 올려주세요',
  4: '리브랜딩 예산과 변화 범위를 선택해 주세요',
  5: '새 브랜드가 어떤 방향으로 가야 하는지 알려주세요',
};

const CATEGORY_OPTIONS = ['카페', '디저트', '한식', '고깃집', '장어집', '치킨집', '주점', '분식', '기타(직접입력)'];
const TARGET_OPTIONS   = ['아이 동반 가족', '여성 고객', '20~30대', '직장인', '중장년층', '연인/데이트', '관광객', '동네 단골', '혼합형'];
const PROBLEM_OPTIONS  = ['매출 감소', '고객층 고령화', '경쟁점 증가', '브랜드 노후화', '인테리어 낡음', '메뉴 경쟁력 약화', 'SNS 홍보 안됨', '가격 포지셔닝 문제'];
const BUDGET_OPTIONS   = ['500만원 미만', '500~1,000만원', '1,000~3,000만원', '3,000~5,000만원', '5,000만원 이상'];
const SCOPE_OPTIONS    = [
  { key: 'sign',     label: '간판만 교체',        desc: '로고·간판 중심 변경' },
  { key: 'partial',  label: '부분 리뉴얼',         desc: '메뉴판·소품·일부 인테리어' },
  { key: 'full',     label: '전면 리모델링',       desc: '인테리어 전체 + 브랜드 교체' },
];
const OWNER_OPTIONS = [
  '친절하고 따뜻한 운영', '트렌디하고 감각적인 운영', '가성비 중심 운영',
  '프리미엄 중심 운영', '가족 친화적 운영', '동네 단골형 운영',
  '체험형/공간형 운영', '혼자서도 편한 1인 친화', '스토리텔링 중심 운영',
  '건강/웰빙 중심 운영', '직접입력',
];
const MOOD_OPTIONS = [
  '따뜻함', '세련됨', '활기참', '편안함', '프리미엄', '감성적',
  '가족친화', '레트로+뉴트로', '미니멀+모던', '다크+시크',
  '내추럴+에코', '플레이풀+유니크', '직접입력',
];
const REFERENCE_TAGS = [
  '옛 서울역 대합실', '뷰 맛집 (한강/산/숲)', '십이간지 테마', '홍콩식 퓨전',
  '1980년대 경양식', '도서관 컨셉', '온실+식물원 무드', '뉴욕 브루클린 바이브',
  '일본 이자카야 골목', '해녀의 집 감성', '시장 포장마차 업그레이드',
  '농장 직영 컨셉', '스포츠 테마', '북유럽 미니멀',
];

// ── 공용 컴포넌트 ─────────────────────────────────────────
function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} style={{ ...s.chip, ...(active ? s.chipActive : {}) }}>
      {children}
    </button>
  );
}
function Field({ label, optional, children }) {
  return (
    <div style={s.fieldWrap}>
      <div style={s.fieldLabel}>
        {label}
        {optional && <span style={s.optionalTag}>선택</span>}
      </div>
      {children}
    </div>
  );
}
function BBInput({ name, value, onChange, placeholder, type = 'text' }) {
  return <input className="bb-input" name={name} value={value} onChange={onChange} placeholder={placeholder} type={type} />;
}
function BBTextarea({ name, value, onChange, placeholder, rows = 3 }) {
  return <textarea className="bb-input bb-textarea" name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />;
}

// ── 사진 업로드 컴포넌트 ─────────────────────────────────
function PhotoUpload({ label, photos, onChange, maxCount, minCount, hint }) {
  const inputRef = useRef();

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    const remaining = maxCount - photos.length;
    const toAdd = files.slice(0, remaining);

    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onChange(prev => [...prev, { file, preview: ev.target.result, base64: ev.target.result }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    onChange(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div style={s.fieldWrap}>
      <div style={s.fieldLabel}>
        {label}
        <span style={{ ...s.optionalTag, background: photos.length >= minCount ? '#dcfce7' : '#FEE2E2', color: photos.length >= minCount ? '#166534' : '#9F1239' }}>
          {photos.length}/{maxCount}장 {photos.length >= minCount ? '✓' : `(최소 ${minCount}장)`}
        </span>
      </div>
      {hint && <p style={s.photoHint}>{hint}</p>}

      {/* 사진 그리드 */}
      <div style={s.photoGrid}>
        {photos.map((p, i) => (
          <div key={i} style={s.photoThumb}>
            <img src={p.preview} alt="" style={s.photoImg} />
            <button type="button" onClick={() => removePhoto(i)} style={s.photoRemove}>✕</button>
          </div>
        ))}
        {photos.length < maxCount && (
          <button type="button" onClick={() => inputRef.current.click()} style={s.photoAdd}>
            <span style={{ fontSize: 24, color: '#9CA3AF' }}>+</span>
            <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>사진 추가</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function StepForm({
  currentStep, formData, onFieldChange,
  onNext, onPrev, onSubmit, loading, errors = {},
  storePhotos, setStorePhotos,
  menuPhotos, setMenuPhotos,
}) {
  const onInput = e => onFieldChange(e.target.name, e.target.value);
  const progress = (currentStep / 5) * 100;

  const toggleProblem = (val) => {
    const cur = formData.problems || [];
    const idx = cur.indexOf(val);
    const next = idx >= 0 ? cur.filter(v => v !== val) : [...cur, val];
    onFieldChange('problems', next);
  };

  const toggleRef = (tag) => {
    const cur  = formData.referenceStyle || '';
    const tags = cur ? cur.split(', ').map(t => t.trim()).filter(Boolean) : [];
    const idx  = tags.indexOf(tag);
    if (idx >= 0) tags.splice(idx, 1); else tags.push(tag);
    onFieldChange('referenceStyle', tags.join(', '));
  };
  const selectedTags = (formData.referenceStyle || '').split(', ').map(t => t.trim()).filter(Boolean);

  const ownerIsCustom = formData.ownerStyle === '직접입력' ||
    (formData.ownerStyle && !OWNER_OPTIONS.slice(0, -1).includes(formData.ownerStyle));
  const moodIsCustom  = formData.moodTone === '직접입력' ||
    (formData.moodTone && !MOOD_OPTIONS.slice(0, -1).includes(formData.moodTone));

  return (
    <div style={s.card}>

      {/* 스텝 바 */}
      <div style={s.stepBar}>
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} style={s.stepItem}>
            <div style={{ ...s.stepDot, ...(currentStep > n ? s.stepDone : currentStep === n ? s.stepActive : {}) }}>
              {currentStep > n ? '✓' : n}
            </div>
            <span style={{ ...s.stepLabel, ...(currentStep === n ? s.stepLabelActive : {}) }}>
              {STEP_TITLES[n]}
            </span>
            {n < 5 && <div style={{ ...s.stepLine, ...(currentStep > n ? s.stepLineDone : {}) }} />}
          </div>
        ))}
      </div>

      {/* 진행바 */}
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${progress}%` }} />
      </div>

      {/* 컨텐츠 */}
      <div style={s.content}>
        <div style={s.stepTitle}>{STEP_DESCS[currentStep]}</div>

        {/* ── STEP 1: 매장 정보 ── */}
        {currentStep === 1 && (
          <>
            <Field label="업종 카테고리">
              <div style={s.chipGrid}>
                {CATEGORY_OPTIONS.map(o => (
                  <Chip key={o} active={formData.category === o} onClick={() => onFieldChange('category', o)}>{o}</Chip>
                ))}
              </div>
            </Field>
            {formData.category === '기타(직접입력)' && (
              <Field label="직접 입력 업종">
                <BBInput name="customCategory" value={formData.customCategory} onChange={onInput} placeholder="예: 멕시칸 펍, 솥밥 다이닝" />
              </Field>
            )}
            <Field label="현재 브랜드명 / 상호">
              <BBInput name="currentBrandName" value={formData.currentBrandName} onChange={onInput} placeholder="예: 장수식당, 카페 봄날" />
            </Field>
            <Field label="대표 메뉴">
              <BBInput name="menu" value={formData.menu} onChange={onInput} placeholder="예: 장어구이, 프라이드 치킨, 수제 케이크" />
            </Field>
            <Field label="운영 기간">
              <div style={s.chipGrid}>
                {['1년 미만', '1~3년', '3~5년', '5~10년', '10년 이상'].map(o => (
                  <Chip key={o} active={formData.operatingPeriod === o} onClick={() => onFieldChange('operatingPeriod', o)}>{o}</Chip>
                ))}
              </div>
            </Field>
            <Field label="매장 주소">
              <BBInput name="storeAddress" value={formData.storeAddress} onChange={onInput} placeholder="예: 서울시 성동구 성수동 123-45" />
            </Field>
            <Field label="매장 평수" optional>
              <BBInput name="storeSize" value={formData.storeSize} onChange={onInput} placeholder="예: 18평, 32평" />
            </Field>
          </>
        )}

        {/* ── STEP 2: 현재 상황 ── */}
        {currentStep === 2 && (
          <>
            <Field label="현재 문제점 (복수 선택 가능)">
              <div style={s.chipGrid}>
                {PROBLEM_OPTIONS.map(o => (
                  <Chip key={o} active={(formData.problems || []).includes(o)} onClick={() => toggleProblem(o)}>{o}</Chip>
                ))}
              </div>
            </Field>
            <Field label="가장 바꾸고 싶은 것">
              <BBTextarea name="changeWish" value={formData.changeWish} onChange={onInput}
                placeholder="예: 젊은 고객이 오지 않아요. 인스타 감성으로 바꾸고 싶어요." />
            </Field>
            <Field label="현재 핵심 고객">
              <div style={s.chipGrid}>
                {TARGET_OPTIONS.map(o => (
                  <Chip key={o} active={formData.targetAudience === o} onClick={() => onFieldChange('targetAudience', o)}>{o}</Chip>
                ))}
              </div>
            </Field>
            <Field label="새롭게 끌어오고 싶은 고객" optional>
              <BBTextarea name="targetNote" value={formData.targetNote} onChange={onInput}
                placeholder="예: 20~30대 여성, 가족 단위 손님도 오게 하고 싶음" />
            </Field>
            <Field label="지금 매장의 강점" optional>
              <BBTextarea name="strength" value={formData.strength} onChange={onInput}
                placeholder="예: 맛은 확실해요. 단골이 많아요. 위치는 좋아요." />
            </Field>
          </>
        )}

        {/* ── STEP 3: 사진 업로드 ── */}
        {currentStep === 3 && (
          <>
            <PhotoUpload
              label="매장 사진 (외관 + 내부)"
              photos={storePhotos}
              onChange={setStorePhotos}
              maxCount={10}
              minCount={5}
              hint="외관 최소 2장, 내부 최소 3장을 올려주세요. AI가 사진을 분석해서 리브랜딩 방향을 제안합니다."
            />
            <PhotoUpload
              label="대표 메뉴 사진"
              photos={menuPhotos}
              onChange={setMenuPhotos}
              maxCount={3}
              minCount={1}
              hint="대표 메뉴 사진을 올려주세요. 메뉴 리뉴얼 제안 시 참고합니다."
            />
            <div style={s.photoNotice}>
              📌 사진은 AI 분석에만 사용되며 외부에 공개되지 않습니다.
            </div>
          </>
        )}

        {/* ── STEP 4: 예산 / 범위 ── */}
        {currentStep === 4 && (
          <>
            <Field label="리브랜딩 예산">
              <div style={s.chipGrid}>
                {BUDGET_OPTIONS.map(o => (
                  <Chip key={o} active={formData.budget === o} onClick={() => onFieldChange('budget', o)}>{o}</Chip>
                ))}
              </div>
            </Field>
            <Field label="변화 범위">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {SCOPE_OPTIONS.map(o => (
                  <button key={o.key} type="button"
                    onClick={() => onFieldChange('changeScope', o.key)}
                    style={{
                      ...s.scopeCard,
                      ...(formData.changeScope === o.key ? s.scopeCardActive : {}),
                    }}>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{o.label}</div>
                    <div style={{ fontSize: 13, color: formData.changeScope === o.key ? '#6D28D9' : '#888' }}>{o.desc}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="예산 관련 추가 메모" optional>
              <BBTextarea name="budgetNote" value={formData.budgetNote} onChange={onInput}
                placeholder="예: 공사는 못 하고 소품/조명/메뉴판 정도만 바꾸고 싶어요" />
            </Field>
          </>
        )}

        {/* ── STEP 5: 원하는 방향 ── */}
        {currentStep === 5 && (
          <>
            <Field label="운영자 스타일">
              <div style={s.chipGrid}>
                {OWNER_OPTIONS.map(o => (
                  <Chip key={o}
                    active={o === '직접입력' ? ownerIsCustom : formData.ownerStyle === o}
                    onClick={() => onFieldChange('ownerStyle', o)}>
                    {o}
                  </Chip>
                ))}
              </div>
              {ownerIsCustom && (
                <div style={{ marginTop: 10 }}>
                  <BBInput name="ownerStyle"
                    value={formData.ownerStyle === '직접입력' ? '' : formData.ownerStyle}
                    onChange={onInput} placeholder="예: 셀프 서비스 중심, 시즌 메뉴 특화" />
                </div>
              )}
            </Field>

            <Field label="원하는 브랜드 무드">
              <div style={s.chipGrid}>
                {MOOD_OPTIONS.map(o => (
                  <Chip key={o}
                    active={o === '직접입력' ? moodIsCustom : formData.moodTone === o}
                    onClick={() => onFieldChange('moodTone', o)}>
                    {o}
                  </Chip>
                ))}
              </div>
              {moodIsCustom && (
                <div style={{ marginTop: 10 }}>
                  <BBInput name="moodTone"
                    value={formData.moodTone === '직접입력' ? '' : formData.moodTone}
                    onChange={onInput} placeholder="예: 몽환적이고 비밀스러운, 힙하고 로컬한" />
                </div>
              )}
            </Field>

            <Field label="익숙하게 가져갈 요소" optional>
              <BBTextarea name="familiarHint" value={formData.familiarHint} onChange={onInput}
                placeholder="예: 단골의 편안함, 보양식의 신뢰감은 유지하고 싶음" />
            </Field>
            <Field label="깨고 싶은 고정관념" optional>
              <BBTextarea name="breakHint" value={formData.breakHint} onChange={onInput}
                placeholder="예: 장어집은 올드하다, 치킨집은 배달형이다" />
            </Field>
            <Field label="넣고 싶은 새로운 경험 요소" optional>
              <BBTextarea name="experienceHint" value={formData.experienceHint} onChange={onInput}
                placeholder="예: 하이볼 바, 체류형 좌석, 포토 포인트" />
            </Field>

            <div style={s.refSection}>
              <div style={s.refHeader}>
                <div style={s.fieldLabel}>원하는 브랜드/공간 레퍼런스</div>
                <span style={s.optionalTag}>선택</span>
              </div>
              <p style={s.refDesc}>브랜드명·공간 방향·이미지 생성에 반영됩니다</p>
              <div style={s.tagGrid}>
                {REFERENCE_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleRef(tag)}
                    style={{ ...s.refTag, ...(selectedTags.includes(tag) ? s.refTagActive : {}) }}>
                    {selectedTags.includes(tag) && '✓ '}{tag}
                  </button>
                ))}
              </div>
              <BBTextarea name="referenceStyle" value={formData.referenceStyle || ''} onChange={onInput} rows={2}
                placeholder="예: 이케아 감성, 뉴욕 브런치 카페, 일본 긴자 스타일 등 자유 입력" />
            </div>

            <Field label="추가 메모" optional>
              <BBTextarea name="extraNote" value={formData.extraNote} onChange={onInput}
                placeholder="예: 브랜드 하나를 확정해서 제안해줬으면 좋겠어요" />
            </Field>
          </>
        )}

        {errors?.step && <div style={s.errBox}>{errors.step}</div>}
      </div>

      {/* 하단 버튼 */}
      <div style={s.footer}>
        <button type="button" onClick={onPrev}
          disabled={currentStep === 1 || loading}
          style={{ ...s.btnSecondary, ...(currentStep === 1 || loading ? s.btnDisabled : {}) }}>
          이전
        </button>
        {currentStep < 5 ? (
          <button type="button" onClick={onNext} disabled={loading}
            style={{ ...s.btnPrimary, ...(loading ? s.btnDisabled : {}) }}>
            다음 단계 →
          </button>
        ) : (
          <button type="button" onClick={onSubmit} disabled={loading}
            style={{ ...s.btnPrimary, ...(loading ? s.btnDisabled : {}), minWidth: 220 }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <span style={s.spinner} /> 리브랜딩 분석 중...
              </span>
            ) : '✦ 리브랜딩 결정안 보기'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────
const s = {
  card:           { background: 'var(--white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' },
  stepBar:        { display: 'flex', alignItems: 'center', padding: '20px 28px 0', gap: 0 },
  stepItem:       { display: 'flex', alignItems: 'center', flex: 1 },
  stepDot:        { width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', background: 'var(--white)', color: 'var(--text-tertiary)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' },
  stepActive:     { border: '2px solid #6D28D9', background: '#6D28D9', color: '#FFFFFF' },
  stepDone:       { border: '2px solid #6D28D9', background: '#EEE8FF', color: '#6D28D9' },
  stepLabel:      { fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 4, whiteSpace: 'nowrap' },
  stepLabelActive:{ color: '#6D28D9', fontWeight: 700 },
  stepLine:       { flex: 1, height: 1, background: 'var(--border)', margin: '0 4px' },
  stepLineDone:   { background: '#6D28D9' },
  progressBar:    { height: 3, background: 'var(--border)', margin: '16px 0 0' },
  progressFill:   { height: '100%', background: '#6D28D9', transition: 'width 0.3s ease', borderRadius: 2 },
  content:        { padding: '28px 28px 20px' },
  stepTitle:      { fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 24, lineHeight: 1.3, letterSpacing: '-0.02em', wordBreak: 'keep-all' },
  fieldWrap:      { marginBottom: 20 },
  fieldLabel:     { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },
  optionalTag:    { fontSize: 11, fontWeight: 600, color: '#6D28D9', background: '#EEE8FF', padding: '2px 8px', borderRadius: 'var(--radius-full)' },
  chipGrid:       { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip:           { padding: '9px 16px', borderRadius: 'var(--radius-full)', border: '1.5px solid #E0E0E8', background: '#FFFFFF', color: '#3F3F46', fontSize: 14, fontWeight: 600, transition: 'all 0.15s', cursor: 'pointer' },
  chipActive:     { border: '2px solid #6D28D9', background: '#EEE8FF', color: '#6D28D9', fontWeight: 800 },
  scopeCard:      { padding: '14px 18px', borderRadius: 12, border: '1.5px solid #E0E0E8', background: '#fff', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' },
  scopeCardActive:{ border: '2px solid #6D28D9', background: '#EEE8FF' },
  photoGrid:      { display: 'flex', flexWrap: 'wrap', gap: 10 },
  photoThumb:     { position: 'relative', width: 90, height: 90, borderRadius: 10, overflow: 'hidden', border: '1px solid #e0e0e0' },
  photoImg:       { width: '100%', height: '100%', objectFit: 'cover' },
  photoRemove:    { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  photoAdd:       { width: 90, height: 90, borderRadius: 10, border: '2px dashed #D1D5DB', background: '#F9FAFB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  photoHint:      { fontSize: 12, color: '#6B7280', marginBottom: 10, lineHeight: 1.6 },
  photoNotice:    { marginTop: 16, padding: '12px 16px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 13, color: '#166534' },
  refSection:     { marginBottom: 20, padding: '20px', borderRadius: 'var(--radius-lg)', background: '#EEE8FF', border: '1px solid #D8D0F5' },
  refHeader:      { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  refDesc:        { fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' },
  tagGrid:        { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  refTag:         { padding: '7px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: 'var(--white)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap', cursor: 'pointer' },
  refTagActive:   { border: '1.5px solid #6D28D9', background: '#6D28D9', color: '#FFFFFF', fontWeight: 700 },
  errBox:         { marginTop: 16, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: '#FFF1F2', border: '1px solid #FECDD3', color: '#9F1239', fontSize: 14, fontWeight: 600 },
  footer:         { padding: '16px 28px 24px', display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border)', background: '#F8F8FC' },
  btnPrimary:     { padding: '14px 32px', borderRadius: 'var(--radius-full)', border: 'none', background: '#6D28D9', color: '#FFFFFF', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', boxShadow: '0 4px 14px rgba(109,40,217,0.35)', cursor: 'pointer' },
  btnSecondary:   { padding: '14px 24px', borderRadius: 'var(--radius-full)', border: '1.5px solid #D4D4D8', background: '#FFFFFF', color: '#3F3F46', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  btnDisabled:    { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },
  spinner:        { display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
};
