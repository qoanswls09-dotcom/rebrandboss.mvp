import { buildRebrandChecklistGuide } from '../lib/rebrandChecklist.js';
let fontPromise;
async function loadFont() {
  if (!fontPromise) fontPromise = fetch('/fonts/NotoSansKR-Regular.ttf').then(async response => {
    if (!response.ok) throw new Error('실행가이드 한글 글꼴을 불러오지 못했습니다. 다시 다운로드해 주세요.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
    return btoa(binary);
  }).catch(error => { fontPromise = null; throw error; });
  return fontPromise;
}
export async function appendRebrandChecklist(pdf, resultData) {
  const decision = resultData?.rebrandDecision || {};
  const items = (decision.launchChecklist || []).filter(item => typeof item === 'string' && item.trim());
  if (!items.length) return;
  pdf.addFileToVFS('NotoSansKR-Regular.ttf', await loadFont());
  pdf.addFont('NotoSansKR-Regular.ttf', 'RebrandKorean', 'normal');
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight();
  const margin = 18;
  let y = margin;
  const page = () => { pdf.addPage(); y=margin; pdf.setFont('RebrandKorean','normal'); };
  page();
  const paragraph = (text, size=10.5, gap=3) => {
    pdf.setFont('RebrandKorean','normal'); pdf.setFontSize(size); pdf.setTextColor(35,40,50);
    const lead=size*0.3528*1.55;
    for (const line of pdf.splitTextToSize(String(text),width-margin*2)) {
      if (y+lead>height-margin) page();
      pdf.text(line,margin,y+lead*0.75); y+=lead;
    }
    y+=gap;
  };
  paragraph('인테리어 실행가이드',18,5);
  paragraph(decision.newBrandName || '리브랜딩',12,7);
  items.forEach((item,index) => {
    if(y+22>height-margin)page();
    paragraph((index+1)+'. '+item,12,3);
    const guide=buildRebrandChecklistGuide(item,resultData?.formData?.category || '');
    for(const step of guide.steps)paragraph('- '+step);
    for(const caution of guide.cautions)paragraph('확인: '+caution,10,3);
    y+=4;
  });
}
