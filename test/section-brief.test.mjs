import assert from 'node:assert/strict';
import {buildSectionFinalPrompt} from '../netlify/functions/generate-interior.js';
import fs from 'node:fs';
import vm from 'node:vm';
const brand={storeConcept:'neighborhood cafe',overallMood:'calm',colors:['purple'],materials:['wood']};
const baseline=buildSectionFinalPrompt('space',brand,'','',0);
const brief=buildSectionFinalPrompt('space',brand,'','',0,'Close up of our ceramic signature display');
assert.ok(brief.finalPrompt.includes('ceramic signature display'));
assert.ok(brief.finalPrompt.includes('neighborhood cafe'));
assert.ok(brief.finalPrompt.includes('purple'));
assert.equal(buildSectionFinalPrompt('space',brand,'','',0,'').finalPrompt,baseline.finalPrompt);
console.log('PASS section-specific brief, brand context and empty-brief fallback');
const constrained={...brand,avoid:['chairs','alcohol bottles'],layoutDirection:'Keep existing kitchen position',seatingDirection:'No customer seating',mustHave:['existing refrigerator']};
const plan=buildSectionFinalPrompt('space',constrained,'','',0);
assert.match(plan.finalPrompt,/Keep existing kitchen position/);
assert.match(plan.finalPrompt,/No customer seating/);
assert.match(plan.finalPrompt,/existing refrigerator/);
assert.match(plan.negativePrompt,/chairs/);
assert.match(buildSectionFinalPrompt('space',constrained,'','change wall color',0).negativePrompt,/alcohol bottles/);
const source=fs.readFileSync(new URL('../netlify/functions/generate-interior.js',import.meta.url),'utf8').split(/^export default/m)[0].replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
let sent;
const context={AbortController,setTimeout,clearTimeout,Buffer,process:{env:{}},fetch:async(_url,init)=>{sent=JSON.parse(init.body);return {ok:true,json:async()=>({polling_url:'https://api.bfl.ai/result/test'})};}};
vm.createContext(context);vm.runInContext(source+'\nglobalThis.submit=submitFluxTxt2Img;',context);
await context.submit(plan.finalPrompt,'test-only',plan.negativePrompt);
assert.match(sent.prompt,/Exclude from the image:.*chairs/);
assert.match(sent.prompt,/No customer seating/);
console.log('PASS actual image provider request includes exclusions and confirmed space plan');
vm.runInContext('globalThis.structure=buildStructurePrompt;globalThis.transform=getTransformLevel;',context);
const notes='의자와 테이블 유지, 바닥 교체 금지. 창문 위치 유지.';
const preserved=context.structure('interior',{changeScope:'partial',budgetMemo:notes},0);
assert.ok(preserved.prompt.includes(notes));assert.ok(!preserved.prompt.includes('Furniture replacement included'));assert.ok(!preserved.prompt.includes('Flooring replacement included'));assert.match(preserved.prompt,/override renovation scope/);
assert.equal(context.transform('full','','공사 금지').tier,1);
assert.equal(context.transform('full','','공사 예산은 상관없음').tier,4);
assert.equal(context.transform('sign','','').tier,1);
assert.ok(!context.structure('interior',{changeScope:'sign'},1).prompt.includes('toward the seating'));
console.log('PASS preservation notes remain intact, override defaults, and do not turn furniture mentions into replacement orders');

const minimal=context.structure('interior',{changeScope:'sign',overallMood:'luxurious',colors:['olive green']},2);
assert.match(minimal.prompt,/original lighting and exposure/);
assert.match(minimal.prompt,/furniture shape, furniture count, color/);
assert.ok(!minimal.prompt.includes('Freshly renovated'));
assert.ok(!minimal.prompt.includes('warm layered lighting'));
assert.ok(!minimal.negativePrompt.includes('cheap plastic furniture'));
for(let i=0;i<5;i++) assert.ok(!context.structure('interior',{changeScope:'sign'},i).prompt.includes('Establishing view'));
assert.match(context.structure('interior',{changeScope:'full'},0).prompt,/complete redesign/);
console.log('PASS minimal refresh does not request global restyling or new viewpoints; full scope remains available');

context.Response=Response;
context.process.env.FLUX_API_KEY='test-only';
context.process.env.STABILITY_API_KEY='test-only';
vm.runInContext('globalThis.generate=generateImage;',context);
for(const imageType of ['interior','exterior']) {
 const response=await context.generate(new Request('https://example.test',{method:'POST',body:JSON.stringify({inputImage:'data:image/jpeg;base64,eA==',imageType,rebrandContext:{changeScope:'sign',colors:['olive green'],budgetMemo:'의자 유지'}})}));
 const result=await response.json();
 assert.equal(result.ok,true); assert.equal(result.model,'flux-2-pro (minimal-refresh)');
 assert.equal(sent.input_image,'eA==');assert.notEqual(sent.prompt_upsampling,true);
 assert.match(sent.prompt,/의자 유지/);assert.match(sent.prompt,/Preserve the original camera view/);
}
context.fetch=async()=>{throw Error('provider unavailable');};
const failed=await context.generate(new Request('https://example.test',{method:'POST',body:JSON.stringify({inputImage:'data:image/jpeg;base64,eA==',imageType:'interior',rebrandContext:{changeScope:'sign'}})}));
assert.equal((await failed.json()).ok,false);
console.log('PASS minimal refresh handler submits reference image without upsampling and rejects provider failure');

context.fetch=async(_url,init)=>{sent=JSON.parse(init.body);return {ok:true,json:async()=>({polling_url:'https://api.bfl.ai/result/test'})};};
vm.runInContext('globalThis.constrained=hasPreservationConstraints;',context);
assert.equal(context.constrained({budgetMemo:'공사 예산은 3000만원'}),false);
assert.equal(context.constrained({budgetMemo:'Keep existing windows'}),true);
for(const changeScope of ['partial','full']) for(const imageType of ['interior','exterior']) {
 const result=await (await context.generate(new Request('https://example.test',{method:'POST',body:JSON.stringify({inputImage:'data:image/jpeg;base64,eA==',imageType,rebrandContext:{changeScope,budgetMemo:'가구 유지. 벽 색상만 변경.'}})}))).json();
 assert.equal(result.model,'flux-2-pro (constrained-refresh)');assert.equal(result.ok,true);
 assert.equal(sent.input_image,'eA==');assert.notEqual(sent.prompt_upsampling,true);
 assert.match(sent.prompt,/가구 유지. 벽 색상만 변경./);
 assert.ok(!sent.prompt.includes('Replace: all'));
 assert.match(sent.prompt,/Never invent a new door/);
}
vm.runInContext("submitStabilityStructure=async()=>({buffer:Buffer.from('x'),mime:'image/jpeg',dataUrl:'data:image/jpeg;base64,eA=='});storeGeneratedImage=async()=>'';",context);
const unrestricted=await (await context.generate(new Request('https://example.test',{method:'POST',body:JSON.stringify({inputImage:'data:image/jpeg;base64,eA==',imageType:'interior',rebrandContext:{changeScope:'full'}})}))).json();
assert.equal(unrestricted.model,'flux-2-pro (reference-renovation)');
assert.match(sent.prompt,/every window and door opening/);
assert.match(sent.prompt,/No claims of verified construction feasibility/);
assert.equal(sent.input_image,'eA==');assert.notEqual(sent.prompt_upsampling,true);
console.log('PASS partial/full protected images use local edits; unrestricted full renovation also preserves the reference footprint');

vm.runInContext('globalThis.dish=extractMenuType;',context);
for(const menu of ['떡갈비','닭갈비','한우 곰탕','수비드 치킨 샐러드']) assert.equal(context.dish({menuDirection:'grilled pork'},{},menu),menu);
assert.equal(context.dish({menuDirection:'숙성 참치회',storeConcept:'홍콩 주점'},{}),'숙성 참치회');
console.log('PASS exact dishes are not substituted by substring-based BBQ/fried-food guesses');
