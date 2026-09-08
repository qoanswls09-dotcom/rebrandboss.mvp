import assert from 'node:assert/strict';
import {repairChecklist,unsupportedQuantities} from '../netlify/lib/checklistQuality.js';
assert.deepEqual(unsupportedQuantities('고객 10명에게, 5kg을 시험',{}),['10명','5kg']);
assert.deepEqual(unsupportedQuantities('고객 10명에게', {extraNote:'고객 10명 시험 허용'}),[]);
assert.deepEqual(unsupportedQuantities('김밥 1줄당 비용',{}),[]);
assert.deepEqual(unsupportedQuantities('직원 2명으로 운영',{ownerStyle:'2인 운영'}),[]);
const base={brandDecision:{brandName:'원래 이름',launchChecklist:['김밥 10줄을 제조하며 수분과 조리 시간을 기록한다.','실제 재료비를 기록하고 가격을 검토한다.','고객 10명에게 안내를 확인한다.']},images:['keep']};
let calls=0;
const repaired=await repairChecklist(base,{}, {rewrite:async()=>{calls++;return ['김밥을 소량 제조하며 수분과 조리 시간을 기록하고 조정합니다.','바꾸면 안 되는 정상 문장','참여 가능한 고객에게 안내 이해도를 물어보고 수정합니다.'];}});
assert.equal(calls,1);assert.equal(repaired.brandDecision.brandName,'원래 이름');assert.equal(repaired.images,base.images);
assert.equal(repaired.brandDecision.launchChecklist[1],base.brandDecision.launchChecklist[1]);
assert.ok(base.brandDecision.launchChecklist[0].includes('10줄'));
for(const rewrite of [async()=>{throw Error('timeout');},async()=>['invalid'],async()=>base.brandDecision.launchChecklist]) {
 const r=await repairChecklist(base,{}, {rewrite});
 assert.equal(r.brandDecision.launchChecklist.length,3);
 assert.ok(r.brandDecision.launchChecklist.every(x=>!unsupportedQuantities(x).length));
}
const good={rebrandDecision:{newBrandName:'유지',launchChecklist:['소량 시험하여 기록하고 조정합니다.']}};
assert.equal(await repairChecklist(good,{}, {rewrite:()=>{throw Error('must not call');}}),good);
const historical={...base,brandDecision:{...base.brandDecision,launchChecklist:['고객 10명에게 기존 안내를 시험한다.']}};
assert.equal(await repairChecklist(historical,{extraNote:'고객 10명 시험'}, {rewrite:()=>{throw Error('must not call');}}),historical);
console.log('PASS checklist repair: unsupported quantities, input counts, per-unit costs, scoped edits, invalid response, failure fallback, immutability and no-call path');
