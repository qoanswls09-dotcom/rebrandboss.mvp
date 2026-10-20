const examples = {
  fixed: {
    title: '위치나 크기를 바꾸면 안 되는 부분',
    hint: '구조·설비의 위치를 적는 항목입니다. 기둥이나 벽을 철거할 수 있는지는 직접 판단하지 않아도 됩니다.',
    items: ['출입구: 도식 아래쪽 벽, 왼쪽 모서리에서 1m 떨어진 곳. 폭 0.9m. 위치 유지.', '창문: 오른쪽 벽에 2개. 위치와 크기 유지. 기둥: 40×40cm, 위치는 현장 표시 예정.', '주방 싱크대의 급배수 위치 유지. 벽 철거 가능 여부와 전력 용량은 미확인.'],
  },
  keep: {
    title: '공사 후에도 계속 쓸 것',
    hint: '구조 외에도 설비·가구·마감을 적어주세요. 어떤 상태로 유지할지도 함께 쓰면 좋습니다.',
    items: ['바닥: 기존 회색 타일 유지, 깨진 타일만 보수 요청.', '주방: 냉장고 2대와 싱크대 재사용. 공사 중 냉장고 전원 유지 필요.', '홀: 4인용 테이블 6개 재사용. 의자는 교체 가능. 간판의 상호는 유지.'],
  },
  change: {
    title: '바꿀 곳 + 바꿀 방법 + 공사에서 제외할 곳',
    hint: '“전체적으로 예쁘게”보다 작업 대상과 제외 범위를 나눠 적으면 견적 비교가 쉬워집니다. 아래 예시의 수량은 본인 매장에 맞게 바꿔주세요.',
    items: ['작은 변경: 홀 벽만 밝은 베이지로 도장, 조명 기구 6개 교체. 바닥·천장·주방·배관은 제외.', '부분 리뉴얼: 카운터 앞면 마감 교체, 입구 대기 공간 정리, 의자 12개 교체. 카운터 위치와 테이블은 유지.', '배치 변경 검토: 주방 앞 칸막이 철거 가능 여부 확인, 카운터 이동 견적 요청. 가능 여부·설비 이설 비용 확인 전에는 철거 확정하지 않음.'],
  },
};

export default function BriefExamples({ field }) {
  if (field === 'dimensions') return (
    <details style={s.details}>
      <summary style={s.summary}>어디를 재야 하나요? 모양별 그림과 작성 예시</summary>
      <div style={s.body}>
        <p style={s.intro}>매장 전체를 한 번에 정확하게 그릴 필요는 없습니다. 먼저 모양을 고르고, 아는 길이만 적어주세요.</p>
        <div style={{ overflowX:'auto', background:'#fff', borderRadius:10 }}>
          <img src="/consultation-measurements.svg" alt="직사각형: 가로 6m, 세로 8m. ㄱ자: 전체 가로 6m, 세로 8m에서 오른쪽 위 2m 곱하기 3m가 빠진 모양. 실제 매장의 예시 치수가 아닙니다." style={{ width:'100%', minWidth:460, display:'block' }} />
        </div>
        <div style={s.example}><strong>직사각형이라면</strong><p>“실내 가로 6m × 세로 8m, 바닥부터 천장까지 2.7m. 줄자로 직접 측정 / 측정일: 10월 20일.”</p></div>
        <div style={s.example}><strong>ㄱ자 모양이라면</strong><p>“전체 가로 6m × 세로 8m. 오른쪽 위에서 빠진 부분은 가로 2m × 세로 3m. 천장 높이는 미측정.”</p></div>
        <div style={s.example}><strong>사선·곡선·여러 번 꺾인 모양이라면</strong><p>종이에 입구부터 벽을 따라 A·B·C 순서로 표시하세요. “A벽 3.2m, B벽 4.1m, C벽 미측정. 오른쪽 뒤 벽은 사선. 각도는 현장 확인 필요.”처럼 적고 스케치와 사진을 시공사에 함께 전달하세요. 벽 길이만으로 정확한 모양이 확정되지는 않습니다.</p></div>
        <ol style={{ paddingLeft:20, margin:'10px 0', lineHeight:1.8 }}>
          <li>같은 기준으로 재세요: 실내 마감된 벽 안쪽부터 반대 벽 안쪽까지.</li>
          <li>단위를 붙이세요: 600cm = 6m, 90cm = 0.9m. 평수만으로 가로·세로를 알 수는 없습니다.</li>
          <li>입구·창문·기둥은 가까운 모서리에서 얼마나 떨어져 있는지도 적어주세요.</li>
          <li>줄자로 잰 값, 기존 도면 값, 대략적인 값인지 구분하세요. 모르면 ‘미측정’으로 남겨주세요.</li>
        </ol>
        <p style={s.note}>위 그림은 예시입니다. 아래 ‘내 매장 간이평면도 만들기’에 실제 숫자를 입력하세요. 복잡한 형태는 직접 표시한 도면 사진을 첨부하고 공사 전 현장에서 확인해주세요.</p>
      </div>
    </details>
  );
  const example = examples[field];
  if (!example) return null;
  return (
    <details style={s.details}>
      <summary style={s.summary}>작성 예시 · {example.title}</summary>
      <div style={s.body}>
        <p style={s.intro}>{example.hint}</p>
        {example.items.map(item => <p key={item} style={s.example}>{item}</p>)}
        <p style={s.note}>예시를 그대로 쓰기보다 매장의 위치·수량·상태로 바꿔 적어주세요. 모르는 내용은 ‘확인 필요’라고 쓰면 됩니다.</p>
      </div>
    </details>
  );
}

const s = {
  details:{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:10, fontSize:13, fontWeight:400 },
  summary:{ padding:'10px 12px', cursor:'pointer', color:'#5b21b6', fontWeight:700, lineHeight:1.5 },
  body:{ padding:'0 12px 12px', color:'#374151', lineHeight:1.7, textAlign:'left' },
  intro:{ margin:'0 0 10px' },
  example:{ background:'#fff', border:'1px solid #ede9fe', padding:'10px 12px', borderRadius:8, margin:'8px 0' },
  note:{ margin:'10px 0 0', color:'#6b7280', fontSize:12 },
};
