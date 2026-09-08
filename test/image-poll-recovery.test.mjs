import assert from 'node:assert/strict';
import { pollImageJob } from '../src/lib/pollImageJob.js';
const response=(status,body)=>({status,ok:status<400,json:async()=>body});
async function run(sequence){let calls=0,ready=0;const keys=[];const result=await pollImageJob('same-job',{wait:async()=>{},onReady:()=>ready++,fetchJob:async key=>{keys.push(key);const value=sequence[Math.min(calls++,sequence.length-1)];if(value instanceof Error)throw value;return value;}}).then(value=>({value}),error=>({error}));return {...result,calls,ready,keys};}
let r=await run([new Error('offline'),response(503,{}),response(200,{status:'Ready',imageUrl:'image'})]);assert.equal(r.value,'image');assert.equal(r.ready,1);assert.deepEqual(r.keys,['same-job','same-job','same-job']);
r=await run([response(503,{})]);assert.ok(r.error);assert.equal(r.calls,3);assert.equal(r.ready,0);
r=await run([response(401,{error:'login'})]);assert.equal(r.calls,1);assert.equal(r.error.message,'login');
r=await run([response(200,{status:'Error',error:'provider failed'})]);assert.equal(r.calls,1);assert.equal(r.error.message,'provider failed');
r=await run([response(200,{status:'Pending'})]);assert.equal(r.calls,45);assert.ok(r.error);
r=await run([response(503,{}),response(200,{status:'Pending'}),response(503,{}),response(200,{status:'Ready',imageUrl:'ok'})]);assert.equal(r.value,'ok');
console.log('PASS image polling: temporary recovery, bounded retries, same job, terminal errors, timeout');
