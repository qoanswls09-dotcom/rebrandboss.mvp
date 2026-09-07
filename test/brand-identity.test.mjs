import assert from 'node:assert/strict';
import { applyBrandIdentity } from '../src/lib/brandIdentity.js';
for (const name of ['오후의 카페','숯과 고기','골목 분식']) {
 const original={rebrandDecision:{newBrandName:'이전 상호',tagline:'기존 문구',menuDirection:'기존 메뉴와 가격 유지'},interiorImagePackage:{colorKeywords:['#663399'],mustHaveElements:['기존 의자'],shouldAvoidElements:['네온']},formData:{budget:'기존 예산'},images:{space:['saved-image']}};
 const next=applyBrandIdentity(original,{name,tagline:'확정한 문구'});
 assert.equal(next.rebrandDecision.newBrandName,name);assert.equal(next.interiorImagePackage.selectedBrandName,name);
 assert.equal(next.rebrandDecision.tagline,'확정한 문구');assert.equal(original.rebrandDecision.newBrandName,'이전 상호');
 assert.equal(next.formData,original.formData);assert.equal(next.images,original.images);
 assert.deepEqual(next.interiorImagePackage.shouldAvoidElements,['네온']);
 assert.equal(next.rebrandDecision.menuDirection,original.rebrandDecision.menuDirection);
 assert.equal(JSON.parse(JSON.stringify(next)).rebrandDecision.newBrandName,name);
 assert.equal(applyBrandIdentity(original,{name:' '}),original);
 assert.equal(applyBrandIdentity(original,{name}).rebrandDecision.tagline,'기존 문구');
}
console.log('PASS: three brands; confirmed identity, serialization, conditions and existing images preserved');
