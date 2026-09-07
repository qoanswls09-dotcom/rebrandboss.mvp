import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const selling=false;
const source=fs.readFileSync(new URL('../netlify/functions/gemini-rebrandboss-background.js',import.meta.url),'utf8').split(selling?'export const handler =':'export default async (req)')[0].replace(/^import .*;\r?\n/gm,'');
let sent;
const ctx={process:{env:{GEMINI_API_KEY:'test-only'}},setTimeout,clearTimeout,AbortController,console,fetch:async(url,init)=>{sent=JSON.parse(init.body);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{}'}]}}]})}}};
vm.createContext(ctx);vm.runInContext(source+';globalThis.api={buildPrompt,normalizeResult,callGemini,hasUsableBrandResult};',ctx);
const decision=selling?{brandDecision:{brandName:'확정 이름'}}:{rebrandDecision:{newBrandName:'확정 이름'}};
const result=ctx.api.normalizeResult({...decision,interiorImagePackage:{selectedBrandName:'다른 이름'},photoAnalysis:{currentState:'관찰 주장',problems:['균열'],menuVisualAnalysis:'담음새'}},{});
assert.equal(result.interiorImagePackage.selectedBrandName,'확정 이름');
if(!selling){
 assert.equal(result.photoAnalysis.currentState,'');assert.equal(result.photoAnalysis.problems.length,0);assert.equal(result.photoAnalysis.menuVisualAnalysis,'');
 const withPhotos=ctx.api.normalizeResult({photoAnalysis:{currentState:'관찰',menuVisualAnalysis:'담음새'}},{storePhotos:['photo'],menuPhotos:['menu']});assert.equal(withPhotos.photoAnalysis.currentState,'관찰');assert.equal(withPhotos.photoAnalysis.menuVisualAnalysis,'담음새');
 const stores=Array.from({length:10},(_,i)=>'data:image/jpeg;base64,store'+i),menus=Array.from({length:5},(_,i)=>'data:image/png;base64,menu'+i);
 await ctx.api.callGemini('prompt',stores,menus);
 const parts=sent.contents[0].parts.filter(p=>p.inlineData);assert.equal(parts.length,15);assert.equal(parts[9].inlineData.data,'store9');assert.equal(parts[14].inlineData.data,'menu4');assert.equal(sent.generationConfig.thinkingConfig.thinkingLevel,'minimal');
}
const prompt=ctx.api.buildPrompt({storeSize:'8평',extraNote:'포장 전용, 좌석 금지'});assert.ok(prompt.includes('포장 전용, 좌석 금지'));if(selling)assert.ok(!prompt.includes('테이블 4~6개'));
console.log('rebrand: result identity, input constraints'+(selling?'':' and all 15 photos / absent-photo normalization')+' passed');

assert.equal(ctx.api.hasUsableBrandResult({}),false);
assert.equal(ctx.api.hasUsableBrandResult([]),false);
const complete={...decision,interiorImagePackage:{layoutDirection:'기존 주방 유지',materialKeywords:['나무'],colorKeywords:['아이보리']}};
complete[selling?'brandDecision':'rebrandDecision'][selling?'storeConcept':'newConcept']='포장 매장';
complete[selling?'brandDecision':'rebrandDecision'].menuDirection='기존 김밥 유지';
assert.equal(ctx.api.hasUsableBrandResult(complete),true);
complete.interiorImagePackage.materialKeywords=[''];
assert.equal(ctx.api.hasUsableBrandResult(complete),false);
console.log('Incomplete AI output rejected before success normalization');
