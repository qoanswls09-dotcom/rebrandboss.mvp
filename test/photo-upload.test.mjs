import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { uploadJobPhotos } from '../src/lib/uploadJobPhotos.js';
let active=0,peak=0;const received=[];
const deps={compressDataUrl:async x=>x,authedFetch:async(_url,options)=>{
 active++;peak=Math.max(peak,active);const data=JSON.parse(options.body);
 await new Promise(r=>setTimeout(r, data.index===0?20:2));received.push(data);active--;return {ok:true};
}};
await uploadJobPhotos('job','store',['a','b','c','d','e'],deps);
assert.equal(peak,3);assert.equal(active,0);assert.equal(received.length,5);
for(const row of received){assert.equal(row.dataUrl,['a','b','c','d','e'][row.index]);assert.equal(row.kind,'store');assert.equal(row.jobId,'job');}
let calls=0;
await assert.rejects(uploadJobPhotos('job','menu',['a','b','c','d','e'],{compressDataUrl:async x=>x,authedFetch:async()=>{calls++;return {ok:false,status:413};}}),/사진 용량/);
assert.ok(calls<=3);
await assert.rejects(uploadJobPhotos('job','store',['a'],{compressDataUrl:async()=>{throw Error('compression failed');},authedFetch:()=>{throw Error('must not upload');}}),/compression failed/);
await uploadJobPhotos('job','store',[],{compressDataUrl:()=>assert.fail(),authedFetch:()=>assert.fail()});
console.log('PASS photo uploads: bounded concurrency, original indexes, failure stops queued work, empty input');
const app=fs.readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const start=app.indexOf("await uploadJobPhotos(jobId, 'store'");
const end=app.indexOf('// 백그라운드 함수는 접수되면',start);
for(const mode of ['failure','cancel','success']){
 let submitted=0;
 const context={jobId:'job',activeJobIdRef:{current:'job'},storePhotoBase64:['a'],menuPhotoBase64:[],payload:{},
 uploadJobPhotos:async()=>{if(mode==='failure')throw Error('failed upload');if(mode==='cancel')context.activeJobIdRef.current='other';},
 authedFetch:async()=>{submitted++;return {status:202};}};
 vm.createContext(context);vm.runInContext('globalThis.submit=async()=>{'+app.slice(start,end)+'}',context);
 if(mode==='failure')await assert.rejects(context.submit(),/failed upload/);else await context.submit();
 assert.equal(submitted,mode==='success'?1:0);
}
console.log('PASS actual submission flow: upload failure and cancellation prevent analysis submission');
