import assert from 'node:assert/strict';
import {comparisonPhase,containRect,videoFormat,recordComparison} from '../src/lib/comparisonVideo.js';
assert.equal(comparisonPhase(0).mode,'before');assert.equal(comparisonPhase(.3).mode,'wipe');assert.equal(comparisonPhase(.6).mode,'after');assert.equal(comparisonPhase(1).mode,'split');
assert.deepEqual(containRect(100,200,0,0,200,200),{x:50,y:0,width:100,height:200});
assert.equal(videoFormat(t=>t==='video/webm'),'video/webm');assert.equal(videoFormat(()=>false),'');
let tick,stopped=0,listeners=new Map(),recorder;
globalThis.document={hidden:false,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
globalThis.requestAnimationFrame=cb=>{tick=cb;return 1;};globalThis.cancelAnimationFrame=()=>{};
class Recorder {static isTypeSupported(t){return t==='video/webm';}constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive';recorder=this;}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(['video'])});this.onstop();});}}
globalThis.MediaRecorder=Recorder;
const canvas={width:1280,height:720,captureStream:()=>({getTracks:()=>[{stop:()=>stopped++}]})};
const ctx={canvas,drawImage(){},fillRect(){},fillText(){},measureText(){return {width:20};},getImageData(){},save(){},restore(){},beginPath(){},rect(){},clip(){}};
canvas.getContext=()=>ctx;const photo={naturalWidth:1280,naturalHeight:720};
const p=recordComparison({canvas,before:photo,after:photo,seconds:8});tick(performance.now()+9000);const result=await p;
assert.equal(result.extension,'webm');assert.ok(result.blob.size);assert.equal(stopped,1);assert.equal(listeners.size,0);
const controller=new AbortController();const aborting=recordComparison({canvas,before:photo,after:photo,seconds:8,signal:controller.signal});controller.abort();await assert.rejects(aborting,/취소/);assert.equal(stopped,2);
const hidden=recordComparison({canvas,before:photo,after:photo,seconds:8});document.hidden=true;listeners.get('visibilitychange')();await assert.rejects(hidden,/탭/);assert.equal(stopped,3);
await assert.rejects(()=>recordComparison({canvas,before:photo,after:photo,seconds:1}),/길이/);
console.log('PASS comparison phases, uncropped fitting, codec selection, recording lifecycle, cancellation and hidden-tab cleanup');

