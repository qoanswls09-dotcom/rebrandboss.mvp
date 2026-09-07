import assert from 'node:assert/strict';
import { imageJobHandlers, providerUrl } from '../netlify/lib/imageJobs.js';
const auth={ok:true,user:{id:'user-a'},token:'test'};
const request=(body={},user='user-a')=>new Request('https://example.test',{method:'POST',headers:{'x-user':user},body:JSON.stringify(body)});
function setup(options={}) {
 const values=new Map();let generated=0,charged=0,fetched=0;
 const store={get:async k=>values.get(k)||null,setJSON:async(k,v,o={})=>{if(o.onlyIfNew&&values.has(k))return {modified:false};values.set(k,v);return {modified:true};}};
 const api=imageJobHandlers(async()=>{generated++;return Response.json(options.result||{ok:true,pollingUrl:'https://api.bfl.ai/v1/get_result?id=test'});},{
  authenticate:async r=>r.headers.get('x-user')==='denied'?{ok:false,statusCode:401,error:'login'}:{...auth,user:{id:r.headers.get('x-user')}},
  store:()=>store,precheck:async()=>{if(options.insufficient)throw Error('insufficient');},
  charge:async()=>{charged++;if(options.billingFailure)throw Error('uncertain');return {remain:90};},
  fetch:async url=>{fetched++;return url.includes('get_result')?Response.json({status:options.status||'Ready',result:{sample:'https://delivery.bfl.ai/sample.jpg'}}):new Response('image bytes',{headers:{'content-type':'image/jpeg'}});},
 });
 return {api,values,count:()=>({generated,charged,fetched})};
}
assert.equal(providerUrl('https://api.bfl.ai/x',true),true);
for(const url of ['http://api.bfl.ai','https://api.bfl.ai.evil.test','https://evil.test','https://user@api.bfl.ai','https://api.bfl.ai:444'])assert.equal(providerUrl(url,true),false);
{
 const t=setup();assert.equal((await t.api.generate(request({},'denied'))).status,401);assert.equal(t.count().generated,0);
}
{
 const t=setup({insufficient:true});assert.equal((await t.api.generate(request())).status,402);assert.equal(t.count().generated,0);
}
{
 const t=setup({result:{ok:false,error:'provider failed'}});assert.equal((await t.api.generate(request())).status,502);assert.equal(t.count().charged,0);
}
{
 const t=setup({result:{ok:true,model:'svg-fallback',dataUrl:'placeholder'}});assert.equal((await t.api.generate(request())).status,502);assert.equal(t.count().charged,0);
}
{
 const t=setup();const job=await (await t.api.generate(request())).json();assert.equal(t.count().charged,0);
 assert.equal((await t.api.poll(request(job,'other-user'))).status,404);assert.equal(t.count().fetched,0);
 const responses=await Promise.all(Array.from({length:6},()=>t.api.poll(request(job))));
 for(const r of responses)assert.equal((await r.json()).status,'Ready');
 assert.equal(t.count().charged,1);
 const before=t.count().fetched;await t.api.poll(request(job));assert.equal(t.count().charged,1);assert.equal(t.count().fetched,before);
}
{
 const t=setup({status:'Failed'});const job=await (await t.api.generate(request())).json();assert.equal((await (await t.api.poll(request(job))).json()).status,'Error');assert.equal(t.count().charged,0);
}
{
 const t=setup({billingFailure:true});const job=await (await t.api.generate(request())).json();
 assert.equal((await (await t.api.poll(request(job))).json()).status,'Ready');
 await t.api.poll(request(job));assert.equal(t.count().charged,1);
}
{
 const t=setup({result:{ok:true,imageUrl:'data:image/png;base64,eA=='}});assert.equal((await (await t.api.generate(request())).json()).status,'Ready');assert.equal(t.count().charged,1);
}
console.log('PASS image jobs: auth, balance, provider/fallback failure, ownership, concurrent/repeated polling, completed-only charge, uncertain billing, synchronous image');
