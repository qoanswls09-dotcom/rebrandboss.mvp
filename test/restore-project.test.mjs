import assert from 'node:assert/strict';
import {restoreProject} from '../src/lib/restoreProject.js';
const project={id:'a',brand_decision:{newBrandName:'느린잔',newConcept:'픽업 정리',menuDirection:'드립'},form_data:{currentBrandName:'느린잔',menu:'드립',extraNote:'벽 유지'},reference_style:'올리브',images:{space:['image-a']}};
const before=JSON.stringify(project);const restored=restoreProject(project,{budget:'default',menu:''});
assert.equal(restored.rebrandDecision.newBrandName,'느린잔');assert.equal(restored.formData.menu,'드립');assert.equal(restored.formData.extraNote,'벽 유지');assert.equal(restored.formData.budget,'default');assert.equal(restored.formData.referenceStyle,'올리브');assert.deepEqual(restored.images,project.images);assert.equal(JSON.stringify(project),before);
const legacy=restoreProject({brand_decision:{brandName:'기존 이름',storeConcept:'기존 콘셉트'}});assert.equal(legacy.rebrandDecision.newBrandName,'기존 이름');assert.equal(legacy.rebrandDecision.newConcept,'기존 콘셉트');
const other=restoreProject({brand_decision:{newBrandName:'다른 매장'}},{});assert.equal(other.formData.extraNote,undefined);assert.deepEqual(other.images,{});
console.log('PASS restore: saved decision, form constraints, reference and images; legacy names; no previous-project form leakage');
