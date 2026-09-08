import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let source=fs.readFileSync(new URL('../netlify/functions/bb-brandname.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export const handler/gm,'const handler');
let output,request,calls=0,authorized=true;
const ctx=vm.createContext({process:{env:{GEMINI_API_KEY:'test'}},AbortController,setTimeout,clearTimeout,
 requireUser:async()=>({ok:authorized,statusCode:401,error:'로그인 필요'}),
 safeParse:JSON.parse,json:(_e,statusCode,body)=>({statusCode,body:JSON.stringify(body)}),preflight:()=>({statusCode:200}),
 fetch:async(_url,options)=>{calls++;request=JSON.parse(options.body);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]})}}});
vm.runInContext(source+'\nglobalThis.run=handler;',ctx);
const event={httpMethod:'POST',body:JSON.stringify({rebrandDecision:{newBrandName:'기존 이름',newConcept:'포장 전문',targetCustomers:'직장인'},formData:{menu:'김밥',extraNote:'튀김 제외'},feedback:'짧게'})};
const invoke=async()=>JSON.parse((await ctx.run(event)).body);
const valid=()=>({names:['말이곳','한입결','쌀잎'].map(name=>({name:' '+name+' ',reason:' 김밥의 형태에서 착안 ',tagline:' 한입에 담은 정성 '}))});
output=valid();assert.equal((await invoke()).names[0].name,'말이곳');
assert.match(request.contents[0].parts[0].text,/튀김 제외/);assert.match(request.contents[0].parts[0].text,/포장 전문/);assert.match(request.contents[0].parts[0].text,/직장인/);
assert.equal(request.generationConfig.responseMimeType,'application/json');assert.equal(request.generationConfig.thinkingConfig.thinkingLevel,'minimal');
for(const bad of [null,{}, {names:[]},{names:valid().names.slice(0,2)}]){output=bad;assert.equal((await invoke()).ok,false);}
for(const value of ['기존이름','기존-이름','말이곳']){output=valid();output.names[1].name=value;assert.equal((await invoke()).ok,false);}
for(const field of ['name','reason','tagline']){output=valid();output.names[0][field]=' ';assert.equal((await invoke()).ok,false);}
output=valid();output.names[0].name='ＡＢ';output.names[1].name='ab';assert.equal((await invoke()).ok,false);
authorized=false;const before=calls;assert.equal((await ctx.run(event)).statusCode,401);assert.equal(calls,before);
console.log('PASS name proposals: complete distinct names, input context, normalization, and authentication');
