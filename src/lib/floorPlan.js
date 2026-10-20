export const emptyFloorPlan = () => ({ shape:'rectangle', width:'', depth:'', notchWidth:'', notchDepth:'', corner:'tr', source:'unmeasured', drawing:'' });
export function normalizeFloorPlan(value) {
  const input=value && typeof value === 'object' ? value : {};
  const result=emptyFloorPlan();
  for(const key of ['width','depth','notchWidth','notchDepth']) result[key]=typeof input[key]==='string' ? input[key].slice(0,10) : '';
  if (['rectangle','l','custom'].includes(input.shape)) result.shape=input.shape;
  if (['tr','tl','br','bl'].includes(input.corner)) result.corner=input.corner;
  if (['measured','drawing','approximate','unmeasured'].includes(input.source)) result.source=input.source;
  if(typeof input.drawing==='string' && input.drawing.length<3000000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/.test(input.drawing)) result.drawing=input.drawing;
  return result;
}
export function floorPlanGeometry(value) {
  const plan=normalizeFloorPlan(value);
  if(plan.shape==='custom') return { plan, error:plan.drawing?'':'직접 그린 도면 사진을 첨부해주세요.', points:[] };
  const width=Number(plan.width),depth=Number(plan.depth),nw=Number(plan.notchWidth),nd=Number(plan.notchDepth);
  if(!(width>0 && width<=100 && depth>0 && depth<=100)) return {plan,error:'전체 가로·세로를 0 초과 100m 이하로 입력해주세요.',points:[]};
  let points=[[0,0],[width,0],[width,depth],[0,depth]];
  let area=width*depth;
  if(plan.shape==='l') {
    if(!(nw>0 && nw<width && nd>0 && nd<depth)) return {plan,error:'빠진 부분의 가로·세로는 전체 길이보다 작고 0보다 커야 합니다.',points:[]};
    points=[[0,0],[width-nw,0],[width-nw,nd],[width,nd],[width,depth],[0,depth]];
    if(plan.corner.includes('l')) points=points.map(([x,y])=>[width-x,y]);
    if(plan.corner.startsWith('b')) points=points.map(([x,y])=>[x,depth-y]);
    area-=nw*nd;
  }
  return {plan,error:'',points,width,depth,area};
}
export function floorPlanSummary(value) {
  const {plan,error,width,depth,area}=floorPlanGeometry(value);
  if(error) return '간이평면도 미작성 / 입력 미완료 — 현장 확인 필요';
  const source={measured:'사용자 실측',drawing:'보유 도면에서 옮긴 값',approximate:'대략적인 값',unmeasured:'측정 출처 미확인'}[plan.source];
  if(plan.shape==='custom') return `사용자 첨부 도면 (${source}), 축척·치수는 별도 확인`;
  const corners={tr:'오른쪽 위',tl:'왼쪽 위',br:'오른쪽 아래',bl:'왼쪽 아래'};
  return `${plan.shape==='l'?'ㄱ자':'직사각형'} / 전체 ${width}m × ${depth}m${plan.shape==='l'?` / ${corners[plan.corner]} 빠진 부분 ${plan.notchWidth}m × ${plan.notchDepth}m`:''} / 윤곽 기준 계산 면적 ${area.toFixed(2)} 제곱미터 (${source}, 기둥·내부 벽 면적 미차감)`;
}
// The preview and PDF share these coordinates; no AI infers unseen walls.
export function drawFloorPlanPdf(doc, value, x, y, width=174, height=125) {
  const geometry=floorPlanGeometry(value);
  if(geometry.error) return false;
  if(geometry.plan.shape==='custom') {
    const props=doc.getImageProperties(geometry.plan.drawing);
    const scale=Math.min(width/props.width,height/props.height);
    doc.addImage(geometry.plan.drawing,props.fileType,x+(width-props.width*scale)/2,y,props.width*scale,props.height*scale);
    return true;
  }
  const scale=Math.min((width-26)/geometry.width,(height-24)/geometry.depth);
  const ox=x+16,oy=y+10;
  doc.setDrawColor(109,40,217);doc.setLineWidth(0.7);
  geometry.points.forEach(([px,py],i)=>{
    const [nx,ny]=geometry.points[(i+1)%geometry.points.length];
    doc.line(ox+px*scale,oy+py*scale,ox+nx*scale,oy+ny*scale);
  });
  doc.setTextColor(55);doc.setFontSize(10);
  doc.text(`${geometry.width} m`,ox+geometry.width*scale/2,oy+geometry.depth*scale+7,{align:'center'});
  doc.text(`${geometry.depth} m`,x,oy+geometry.depth*scale/2);
  return true;
}
