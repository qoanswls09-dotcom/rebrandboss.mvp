import assert from 'node:assert/strict';
import {spaceContext,spaceReferenceUrl} from '../src/lib/spaceContext.js';
import {sceneModel,cleanState,gltfDocument} from '../public/space3d/model.js';
import {normalizeSpaceState,spacePlanId} from '../src/lib/spaceBlueprint.js';
const route='/.netlify/functions/rebrand-image?key=abc123';
assert.equal(spaceReferenceUrl(route),'https://musical-bublanina-33a85a.netlify.app'+route);
for(const bad of ['javascript:alert(1)','//evil.example/x','/unknown','https://user:secret@example.org/x'])assert.equal(spaceReferenceUrl(bad),'');
const c=spaceContext({brandDecision:{newBrandName:'마로',newConcept:'다이닝'}},{},[route,'https://example.org/second.jpg'],1);
assert.equal(c.name,'마로');assert.equal(c.reference,'https://example.org/second.jpg');
for(const width of [6,8,16])for(const depth of [6,8,16]){
 const s=cleanState({roomStyle:'window-lounge',width,depth,tables:12,barSeats:8});
 assert.equal(s.barSeats,0);assert.equal(normalizeSpaceState(s).roomStyle,'window-lounge');
 const m=sceneModel(s);assert.ok(m.parts.some(p=>p.tag==='bench'));assert.equal(m.layout.barSeats,0);
 for(const part of m.parts){assert.ok(part.p.every(Number.isFinite));for(let i=0;i<part.p.length;i+=3){assert.ok(Math.abs(part.p[i])<=width/2+.13);assert.ok(Math.abs(part.p[i+2])<=depth/2+.13);}}
 assert.ok(gltfDocument(m).meshes.length);
}
assert.notEqual(spacePlanId({roomStyle:'window-lounge'}),spacePlanId({roomStyle:'izakaya'}));
console.log('PASS: legacy/new context, image origin restrictions, 9 lounge layouts, persistence and geometry change tracking');
