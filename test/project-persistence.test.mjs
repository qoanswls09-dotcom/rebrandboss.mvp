import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const initialImages={space:['old-space'],menu:['old-menu']};
function setup(mode='normal') {
  const calls=[];
  const fetch=async(url,init={})=>{
    calls.push({url,method:init.method||'GET',body:init.body?JSON.parse(init.body):null});
    if(url.includes('/auth/'))return Response.json({id:'owner'});
    if(url.includes('bb_usage')){if(mode==='usage-failed')throw Error('network');return Response.json([]);}
    if(url.includes('bb_trend_data'))return Response.json([]);
    if(init.method==='PATCH')return Response.json(mode==='patch-missing'?[]:[{id:'project',images:JSON.parse(init.body).images}]);
    if(init.method==='POST')return Response.json([{id:'project'}]);
    if(mode==='read-failed')return Response.json({error:'unavailable'},{status:503});
    if(mode==='non-json')return new Response('<html>unavailable</html>',{status:502});
    if(mode==='missing')return Response.json([]);
    return Response.json([{id:'project',images:initialImages,brand_decision:{newBrandName:'느린잔',newConcept:'픽업 동선 개선',targetCustomers:'동네 단골',newVisitReason:'예약 수령'},form_data:{category:'카페'}}]);
  };
  const context=vm.createContext({fetch,process:{env:{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'test'}},console:{warn:()=>{}},Date});
  const load=file=>{let source=fs.readFileSync(new URL('../netlify/functions/'+file,import.meta.url),'utf8').replace('export const handler =','globalThis.api =');const c=vm.createContext({...context});vm.runInContext(source,c);return c.api;};
  return {calls,save:load('bb-save.js'),projects:load('bb-projects.js')};
}
const event=body=>({httpMethod:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify(body)});
const images={action:'save_images',projectId:'project',section:'space',urls:['new-space']};
for(const [mode,status] of [['read-failed',503],['non-json',503],['missing',404]]){
 const t=setup(mode),r=await t.save(event(images));assert.equal(r.statusCode,status,mode);assert.equal(t.calls.filter(c=>c.method==='PATCH').length,0,mode+' must not overwrite images');
}
for(const action of ['save_images','save_project','toggle_share']){
 const t=setup('patch-missing'),r=await t.save(event({...images,action,isPublic:true}));assert.equal(r.statusCode,404,action);assert.notEqual(JSON.parse(r.body).ok,true);
}
{
 const t=setup('usage-failed'),r=await t.save(event(images));assert.equal(r.statusCode,200);const body=JSON.parse(r.body);assert.equal(body.ok,true);assert.deepEqual(body.images,{space:['new-space'],menu:['old-menu']});
}
{
 const t=setup('read-failed'),r=await t.save(event({action:'save_project',brandDecision:{brandName:'test'}}));assert.equal(r.statusCode,503);assert.equal(t.calls.filter(c=>c.method==='POST'&&c.url.includes('bb_projects')).length,0);
}
{
 const t=setup('usage-failed'),r=await t.save(event({action:'save_project',brandDecision:{brandName:'test'}}));assert.equal(r.statusCode,200);assert.equal(JSON.parse(r.body).project.id,'project');
}
{
 const t=setup();const r=await t.projects({headers:{authorization:'Bearer test'},queryStringParameters:{action:'list'}});assert.equal(JSON.parse(r.body).projects[0].brandName,'느린잔');assert.equal(JSON.parse(r.body).projects[0].storeConcept,'픽업 동선 개선');
 const shared=await t.projects({headers:{},queryStringParameters:{action:'shared',shareId:'share'}});assert.equal(JSON.parse(shared.body).project.brandDecision.brandName,'느린잔');assert.equal(JSON.parse(shared.body).project.brandDecision.coreCustomers,'동네 단골');
}
{
 const t=setup();await t.save(event({...images,projectId:'id&user_id=neq.owner'}));const url=t.calls.find(c=>c.url.includes('/rest/')).url;assert.ok(url.includes('id%26user_id%3Dneq.owner'));assert.ok(url.includes('&user_id=eq.owner'));
}
console.log('PASS persistence: failed reads never overwrite images, missing rows never succeed, auxiliary failure preserves success, rebrand list/share compatibility');
