// ─────────────────────────────────────────────────────────────────────────────
// ChecklistSection.jsx
// ResultScreen.jsx 안의 기존 체크리스트 섹션을 이걸로 통째로 교체
//
// [교체 방법]
// ResultScreen.jsx에서 아래 블록을 찾아서:
//
//   {(bd.launchChecklist||[]).length>0&&(
//     <section style={s.checkSection}>
//       ...
//     </section>
//   )}
//
// 아래 한 줄로 교체:
//
//   <ChecklistSection
//     resultData={resultData}
//     generatedImages={generatedImages}
//     onPdfDownload={handlePdfDownload}
//   />
//
// 그리고 이 파일 내용을 ResultScreen.jsx 안에
// DirectionCard 함수 바로 위에 붙여넣기
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../lib/supabase';

// ── 체크리스트 항목별 상세 가이드 생성기 ─────────────────────────────────────
function buildGuide(item, idx, bd, pkg, formData, generatedImages) {
  const district = formData?.district || '해당 지역';
  const storeSize = formData?.storeSize || '20평';
  const category = formData?.category || '음식점';
  const spaceImages = generatedImages?.space || [];
  const brandName = bd?.brandName || '';

  // 인테리어 관련 키워드 감지
  const isInterior = /인테리어|공사|시공|업체|견적|설계|내부|리모델/i.test(item);
  // 사업자/허가 관련
  const isLegal = /사업자|허가|위생|신고|등록|면허|소방|영업/i.test(item);
  // 메뉴/식자재 관련
  const isMenu = /메뉴|레시피|식자재|원가|공급|납품|식품/i.test(item);
  // 직원/채용 관련
  const isHiring = /직원|채용|알바|아르바이트|교육|인력|스태프/i.test(item);
  // 마케팅/SNS 관련
  const isMarketing = /마케팅|sns|인스타|홍보|광고|오픈|이벤트|콘텐츠/i.test(item);

  if (isInterior) {
    return {
      type: 'interior',
      imageKit: {
        show: true,
        images: spaceImages,
        brandName,
      },
      budget: buildInteriorBudget(storeSize, district),
      prepList: [
        '도면 또는 평면도 준비 (없으면 줄자로 실측 후 스케치라도 가져갈 것)',
        `브랜드보스 공간 이미지 3장 + 가이드라인 PDF 출력해서 지참 — 컨셉/컬러/소재 방향 공유용`,
        '예산 상한선 미리 정해두기 (업체에는 10% 낮게 말하기)',
        '희망 공사 기간 및 오픈 목표일 정해두기',
        `${category} 특성상 필요한 주방 동선, 홀/주방 면적 비율 사전 결정`,
      ],
      questions: [
        '이 이미지(브랜드보스 공간 이미지) 스타일로 시공한 사례 있나요?',
        '공사 기간 중 지연 시 보상 조항이 계약서에 있나요?',
        '하자 보증 기간은 어떻게 되나요? (최소 1년 이상 요구)',
        '직영 공사인가요, 하청 주나요? (직영이 품질 관리 유리)',
        '중도금 / 잔금 비율은 어떻게 되나요?',
        '현장 소장이 매일 상주하나요?',
      ],
      cautions: [
        '계약서에 "시방서(자재 사양서)" 반드시 첨부 요구 — 어떤 자재 쓰는지 명시',
        '선금은 30% 이하로 협상 (50% 이상 요구하는 업체는 주의)',
        '구두 약속은 효력 없음 — 변경 사항은 모두 계약서 추가 합의서로',
        '공사 중 추가 공사비 요청은 처음 견적의 10% 초과 시 재협상 권리 있음',
      ],
    };
  }

  if (isLegal) {
    return {
      type: 'legal',
      steps: [
        '사업자 등록 신청 — 홈택스(hometax.go.kr) 온라인 가능, 1~3일 소요',
        `식품위생교육 이수 — 영업 전 6시간 필수 (식품안전나라 온라인 가능)`,
        '영업신고증 발급 — 관할 구청 위생과 방문 또는 민원24',
        '소방시설 완비증명서 확인 (건물주에게 요청)',
        `${category} 업종에 따라 추가 허가 필요 여부 구청 사전 확인`,
      ],
      cautions: [
        '사업자 등록은 오픈 전에 완료해야 매입세액 공제 가능 (임대차 계약일 이후)',
        '위생교육은 본인이 직접 이수해야 함 (대리 불가)',
        '영업신고증 나오기까지 최대 1~2주 소요 — 오픈 일정에 여유 두기',
      ],
    };
  }

  if (isMenu) {
    return {
      type: 'menu',
      steps: [
        '대표 메뉴 3~5개로 압축 (런칭 초기엔 메뉴 적을수록 유리)',
        '원가율 목표 설정 (일반적으로 30~35% 이하)',
        '식자재 공급업체 2곳 이상 확보 (한 곳 의존 위험)',
        '레시피 표준화 — 누가 만들어도 같은 맛 나오도록 문서화',
        '시식 테스트 최소 3회 이상 진행 후 최종 확정',
      ],
      cautions: [
        '오픈 초기 메뉴 변경은 단골 이탈 원인 — 신중하게 결정',
        '계절 재료 의존도 높은 메뉴는 수급 불안정 위험',
      ],
    };
  }

  if (isHiring) {
    return {
      type: 'hiring',
      steps: [
        '필요 인원 산정 — 피크타임 기준으로 계산',
        '채용 공고 — 알바몬/알바천국/당근마켓 등에 2~3주 전 게시',
        '4대보험 가입 절차 사전 확인 (근로계약서 필수)',
        '브랜드 컨셉/서비스 방향 교육 자료 준비 (브랜드 가이드라인 활용)',
        '오픈 전 최소 1주일 시뮬레이션 운영',
      ],
      cautions: [
        '최저임금 이상 급여 지급 필수 (위반 시 과태료)',
        '근로계약서 미작성 시 벌금 — 오픈 전 반드시 작성',
      ],
    };
  }

  if (isMarketing) {
    return {
      type: 'marketing',
      steps: [
        'SNS 계정 개설 (인스타그램 필수, 네이버 플레이스 등록)',
        '오픈 전 티저 콘텐츠 최소 5개 준비 (브랜드보스 이미지 활용)',
        '오픈 이벤트 기획 — 첫 방문 할인 or 무료 음료 증정',
        '네이버 스마트플레이스 등록 (오픈 2주 전)',
        '주변 오피스/아파트 전단 배포 (오픈 1주 전)',
      ],
      cautions: [
        '가짜 리뷰 작성은 불법 — 실제 방문 고객 리뷰 유도',
        'SNS 첫 포스팅 퀄리티가 브랜드 인상 좌우 — 브랜드보스 이미지 활용 권장',
      ],
    };
  }

  // 기본 가이드
  return {
    type: 'general',
    steps: [item + ' 항목을 단계별로 진행하세요.'],
    cautions: [],
  };
}

function buildInteriorBudget(storeSize, district) {
  const sizeNum = parseInt(storeSize) || 20;
  const isExpensive = /강남|성수|홍대|이태원|청담|판교/i.test(district);
  const mult = isExpensive ? 1.2 : 1;

  const base = [
    { cat: '철거 + 기본 공사', min: 300, max: 500 },
    { cat: '바닥 / 벽체 마감', min: 400, max: 700 },
    { cat: '전기 / 설비', min: 200, max: 400 },
    { cat: '가구 / 조명 / 소품', min: 300, max: 600 },
    { cat: '간판 / 사인물', min: 100, max: 250 },
  ];

  const scale = sizeNum / 18;
  const items = base.map(b => ({
    cat: b.cat,
    min: Math.round(b.min * scale * mult / 10) * 10,
    max: Math.round(b.max * scale * mult / 10) * 10,
  }));

  const totalMin = items.reduce((s, i) => s + i.min, 0);
  const totalMax = items.reduce((s, i) => s + i.max, 0);
  const reserveMin = Math.round(totalMin * 0.1 / 10) * 10;
  const reserveMax = Math.round(totalMax * 0.1 / 10) * 10;

  return {
    items: [...items, { cat: '예비비 (10%)', min: reserveMin, max: reserveMax }],
    totalMin: totalMin + reserveMin,
    totalMax: totalMax + reserveMax,
    warning: isExpensive
      ? `${district} 상업지구는 평균보다 15~20% 높게 견적 나오는 경우 많음. 반드시 3곳 이상 비교할 것.`
      : '시공 업체별 견적 차이가 크므로 반드시 3곳 이상 비교할 것.',
  };
}

// ── 개별 체크 항목 상세 패널 ──────────────────────────────────────────────────
function DetailPanel({ guide, brandName, onPdfDownload }) {
  const dp = { section: { marginBottom: 14 }, title: { fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }, dot: { width: 5, height: 5, borderRadius: '50%', background: '#7F77DD', flexShrink: 0, marginTop: 6 }, item: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 5 }, q: { fontSize: 12, color: 'var(--text-primary)', background: 'var(--purple-50)', padding: '7px 10px', borderRadius: 6, marginBottom: 5, lineHeight: 1.5 }, warn: { background: '#FAEEDA', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#633806', display: 'flex', gap: 6, marginTop: 8 }, };

  if (guide.type === 'interior') {
    return (
      <div>
        {/* 이미지 키트 */}
        <div style={dp.section}>
          <div style={dp.title}>🖼 업체 미팅용 이미지 키트</div>
          <div style={{ background: 'var(--purple-50)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
            <div style={{ fontSize: 11, background: '#EEEDFE', color: '#534AB7', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, marginBottom: 10 }}>
              ✦ 브랜드보스에서 생성된 이미지
            </div>
            {guide.imageKit.images.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
                {guide.imageKit.images.slice(0, 3).map((url, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3' }}>
                    <img src={url} alt={`공간 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, padding: '3px 6px' }}>
                      {['메인홀 전경', '반대 앵글', '시그니처존'][i]}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: 'var(--white)', borderRadius: 8, padding: '14px', textAlign: 'center', marginBottom: 10, border: '1.5px dashed var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>공간 이미지를 먼저 생성하세요</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>결과 화면 위쪽 "공간 연출" 카드에서 생성 가능</div>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>컬러 팔레트 · 소재 키워드 · 가이드라인 PDF 포함</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={onPdfDownload} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#7F77DD', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                ⬇ 미팅용 PDF 다운로드
              </button>
            </div>
          </div>
          <div style={dp.item}><div style={dp.dot}/><span>공간 이미지 3장 + 컬러 팔레트 + 소재 키워드를 업체에 전달하면 견적 정확도가 높아짐</span></div>
          <div style={dp.item}><div style={dp.dot}/><span>브랜드 가이드라인 PDF를 출력해서 미팅 때 지참하면 컨셉 설명 시간 절약</span></div>
        </div>

        {/* 예산 */}
        <div style={dp.section}>
          <div style={dp.title}>💰 적정 예산</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {guide.budget.items.map((b, i) => (
              <div key={i} style={{ background: 'var(--purple-50)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{b.cat}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{b.min.toLocaleString()} ~ {b.max.toLocaleString()}만원</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#EEEDFE', borderRadius: 8, padding: '8px 12px', marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#534AB7', fontWeight: 700 }}>총 예산 범위</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#3C3489' }}>{guide.budget.totalMin.toLocaleString()} ~ {guide.budget.totalMax.toLocaleString()}만원</span>
          </div>
          <div style={dp.warn}><span>⚠</span><span>{guide.budget.warning}</span></div>
        </div>

        {/* 미팅 준비 */}
        <div style={dp.section}>
          <div style={dp.title}>👥 미팅 전 준비할 것</div>
          {guide.prepList.map((p, i) => <div key={i} style={dp.item}><div style={dp.dot}/><span>{p}</span></div>)}
        </div>

        {/* 질문 */}
        <div style={dp.section}>
          <div style={dp.title}>❓ 반드시 물어볼 것</div>
          {guide.questions.map((q, i) => <div key={i} style={dp.q}>"{q}"</div>)}
        </div>

        {/* 주의사항 */}
        <div style={dp.section}>
          <div style={dp.title}>⚠ 계약 전 주의사항</div>
          {guide.cautions.map((c, i) => <div key={i} style={dp.item}><div style={dp.dot}/><span>{c}</span></div>)}
        </div>
      </div>
    );
  }

  // 법무/메뉴/채용/마케팅/기본
  const steps = guide.steps || [];
  const cautions = guide.cautions || [];
  return (
    <div>
      {steps.length > 0 && (
        <div style={dp.section}>
          <div style={dp.title}>📋 진행 순서</div>
          {steps.map((s, i) => <div key={i} style={dp.item}><div style={dp.dot}/><span>{s}</span></div>)}
        </div>
      )}
      {cautions.length > 0 && (
        <div style={dp.section}>
          <div style={dp.title}>⚠ 주의사항</div>
          {cautions.map((c, i) => <div key={i} style={dp.item}><div style={dp.dot}/><span>{c}</span></div>)}
        </div>
      )}
    </div>
  );
}

// ── ChecklistSection 메인 컴포넌트 ───────────────────────────────────────────
export default function ChecklistSection({ resultData, generatedImages, onPdfDownload }) {
  const bd = resultData?.brandDecision || {};
  const pkg = resultData?.interiorImagePackage || {};
  const fd = resultData?.formData || {};
  const checklist = bd.launchChecklist || [];
  const projectId = resultData?.projectId || null;

  const [doneState, setDoneState] = React.useState(() => checklist.map(() => false));
  const [memos, setMemos] = React.useState(() => checklist.map(() => ''));
  const [expanded, setExpanded] = React.useState(() => checklist.map((_, i) => i === 0));
  const [saving, setSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState('');
  const saveTimer = React.useRef(null);

  // 프로젝트 저장된 상태 불러오기
  React.useEffect(() => {
    if (!projectId) return;
    const load = async () => {
      const { data } = await supabase
        .from('bb_projects')
        .select('checklist_status, checklist_memos')
        .eq('id', projectId)
        .single();
      if (data) {
        if (data.checklist_status) {
          const newDone = checklist.map((_, i) => !!data.checklist_status[i]?.done);
          setDoneState(newDone);
        }
        if (data.checklist_memos) {
          const newMemos = checklist.map((_, i) => data.checklist_memos[i] || '');
          setMemos(newMemos);
        }
      }
    };
    load();
  }, [projectId]);

  // Supabase 자동 저장 (디바운스 1.5초)
  const autoSave = (newDone, newMemos) => {
    if (!projectId) return;
    clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      const statusObj = {};
      newDone.forEach((d, i) => { statusObj[i] = { done: d, doneAt: d ? new Date().toLocaleDateString('ko-KR') : null }; });
      const memosObj = {};
      newMemos.forEach((m, i) => { memosObj[i] = m; });
      await supabase.from('bb_projects').update({ checklist_status: statusObj, checklist_memos: memosObj }).eq('id', projectId);
      setSaving(false);
      setLastSaved(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
    }, 1500);
  };

  const toggleDone = (i) => {
    const next = doneState.map((d, idx) => idx === i ? !d : d);
    setDoneState(next);
    autoSave(next, memos);
  };

  const updateMemo = (i, val) => {
    const next = memos.map((m, idx) => idx === i ? val : m);
    setMemos(next);
    autoSave(doneState, next);
  };

  const toggleExpand = (i) => {
    setExpanded(prev => prev.map((e, idx) => idx === i ? !e : e));
  };

  if (checklist.length === 0) return null;

  const doneCount = doneState.filter(Boolean).length;
  const total = checklist.length;
  const pct = Math.round(doneCount / total * 100);
  const nextIdx = doneState.findIndex(d => !d);

  return (
    <section style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 20px', boxShadow: 'var(--shadow-sm)' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple-600)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          오픈 준비 체크리스트
        </div>
        <div style={{ fontSize: 11, color: saving ? '#7F77DD' : 'var(--text-tertiary)' }}>
          {saving ? '저장 중...' : lastSaved ? `${lastSaved} 저장됨` : projectId ? '자동 저장' : '로그인 시 자동 저장'}
        </div>
      </div>

      {/* 완료율 */}
      <div style={{ background: 'var(--purple-50)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>오픈 준비 완료율</span>
          <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)' }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: '#7F77DD', width: `${pct}%`, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{doneCount}</strong>/{total} 완료
          </span>
          {nextIdx >= 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              다음: <strong style={{ color: '#7F77DD' }}>{checklist[nextIdx]}</strong>
            </span>
          )}
        </div>
      </div>

      {/* 체크리스트 항목들 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checklist.map((item, i) => {
          const isDone = doneState[i];
          const isNext = !isDone && i === nextIdx;
          const isOpen = expanded[i];
          const guide = buildGuide(item, i, bd, pkg, fd, generatedImages);

          return (
            <div key={i} style={{
              border: isNext ? '1.5px solid #AFA9EC' : '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--white)',
              opacity: isDone ? 0.65 : 1,
              transition: 'opacity 0.2s',
            }}>
              {/* 항목 헤더 */}
              <div
                onClick={() => toggleExpand(i)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
              >
                {/* 체크박스 */}
                <div
                  onClick={e => { e.stopPropagation(); toggleDone(i); }}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: isDone ? 'none' : '1.5px solid var(--border)',
                    background: isDone ? '#7F77DD' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {isDone && <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                    textDecoration: isDone ? 'line-through' : 'none',
                    color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  }}>
                    {item}
                  </div>
                  {isDone && (
                    <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                      ✓ 완료
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {isNext && (
                    <span style={{ fontSize: 11, background: '#EEEDFE', color: '#534AB7', padding: '2px 8px', borderRadius: 999 }}>
                      다음 할 일
                    </span>
                  )}
                  <span style={{ fontSize: 14, color: 'var(--text-tertiary)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>
                    ▾
                  </span>
                </div>
              </div>

              {/* 상세 패널 */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
                  <DetailPanel guide={guide} brandName={bd.brandName} onPdfDownload={onPdfDownload} />

                  {/* 메모 */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>메모 (자동 저장)</div>
                    <textarea
                      value={memos[i]}
                      onChange={e => updateMemo(i, e.target.value)}
                      placeholder="진행 상황, 업체 정보 등 메모..."
                      rows={3}
                      style={{
                        width: '100%', padding: '8px 10px',
                        border: '1.5px solid var(--border)', borderRadius: 8,
                        fontSize: 13, fontFamily: 'inherit', color: 'var(--text-primary)',
                        background: 'var(--white)', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* 완료 버튼 */}
                  <button
                    onClick={() => toggleDone(i)}
                    style={{
                      width: '100%', padding: '9px', marginTop: 10,
                      borderRadius: 8, border: isDone ? '1px solid var(--border)' : 'none',
                      background: isDone ? 'var(--white)' : '#7F77DD',
                      color: isDone ? 'var(--text-secondary)' : '#fff',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    {isDone ? '완료 취소' : '✓ 완료로 표시하기'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 전체 완료 메시지 */}
      {pct === 100 && (
        <div style={{ marginTop: 16, padding: '16px', background: '#e8f5e9', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>🎉</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2e7d32' }}>모든 준비 완료!</div>
          <div style={{ fontSize: 13, color: '#388e3c', marginTop: 4 }}>이제 오픈할 준비가 됐어요.</div>
        </div>
      )}
    </section>
  );
}
