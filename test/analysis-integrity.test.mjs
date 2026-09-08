import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../netlify/functions/gemini-rebrandboss-background.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export default async (req) =>','globalThis.handler = async (req) =>');
async function run({stores=0,menus=0,missing=false,broken=false,duplicate=false}={}){
 const values=new Map(),calls={api:0,charged:0,deleted:0,parts:0};
 for(let i=0;i<Math.min(stores,10);i++)values.set('owner/job/store-'+i,missing&&i===stores-1?null:'data:image/jpeg;base64,dGVzdA==');
 for(let i=0;i<menus;i++)values.set('owner/job/menu-'+i,'data:image/png;base64,dGVzdA==');
 const store={get:async key=>{if(broken)throw Error('read failed');return values.get(key)??null;},setJSON:async(key,value,options)=>{if(options?.onlyIfNew&&duplicate)return {modified:false};values.set(key,value);return {modified:true};},delete:async key=>{calls.deleted++;values.delete(key);}};
 const result={rebrandDecision:{newBrandName:'이름',newConcept:'콘셉트',menuDirection:'김밥'},interiorImagePackage:{layoutDirection:'동선',materialKeywords:['나무'],colorKeywords:['흰색']}};
 const ctx={getStore:()=>store,requireUser:async()=>({ok:true,user:{id:'owner'},token:'test'}),checkBalance:async()=>{},chargeBalance:async()=>{calls.charged++;},process:{env:{GEMINI_API_KEY:'test'}},AbortController,setTimeout,clearTimeout,console,fetch:async(url,init)=>{calls.api++;calls.parts=JSON.parse(init.body).contents[0].parts.filter(p=>p.inlineData).length;return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]});}};
 vm.createContext(ctx);vm.runInContext(source,ctx);await ctx.handler(new Request('https://local.test',{method:'POST',body:JSON.stringify({jobId:'job',category:'김밥',menu:'김밥',storePhotoCount:stores,menuPhotoCount:menus})}));return {calls,result:values.get('owner/job')};
}
for(const options of [{stores:2,missing:true},{stores:1,broken:true},{stores:11}]){const t=await run(options);assert.equal(t.result.ok,false);assert.equal(t.calls.api,0);assert.equal(t.calls.charged,0);}
for(const options of [{},{stores:10,menus:5}]){const t=await run(options);assert.equal(t.result.ok,true);assert.equal(t.calls.api,1);assert.equal(t.calls.charged,1);assert.equal(t.calls.parts,(options.stores||0)+(options.menus||0));}
{const t=await run({stores:1,duplicate:true});assert.equal(t.calls.api,0);assert.equal(t.calls.charged,0);assert.equal(t.calls.deleted,0);}
// Exercise the actual late auto-save callback with an outdated job token.
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');const start=app.indexOf('autoSave(result, null).then(res => {')+'autoSave(result, null).then(res => {'.length;const end=app.indexOf('\n      });',start);const callback=app.slice(start,end);const writes=[];const ctx={activeJobIdRef:{current:'new'},jobId:'old',setCurrentProjectId:x=>writes.push(x),setCurrentShareId:x=>writes.push(x),setSaveMsg:x=>writes.push(x),setTimeout:()=>{}};vm.createContext(ctx);vm.runInContext('globalThis.apply = res => {'+callback+'}',ctx);ctx.apply({project:{id:'old-project'}});assert.equal(writes.length,0);ctx.activeJobIdRef.current='old';ctx.apply({project:{id:'current-project'}});assert.ok(writes.includes('current-project'));ctx.apply(null);assert.ok(writes.some(x=>typeof x==='string'&&x.includes('자동저장하지 못했습니다')));
console.log('PASS analysis integrity: missing photos fail before API/charge, zero and 15 photos succeed, duplicate untouched, stale auto-save ignored');
