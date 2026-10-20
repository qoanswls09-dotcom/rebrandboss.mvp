import assert from 'node:assert/strict';
import {comparisonEntries,resolveComparisons,normalizeAttachments} from '../src/lib/constructionHandoff.js';
import {normalizeMaterials} from '../src/lib/materialBudget.js';
const entries=comparisonEntries([{url:'https://example.com/before.jpg'}],['https://example.com/after.jpg']);
assert.equal(resolveComparisons([],entries).length,0);
const row={zone:'입구',before:entries[0].id,after:entries[1].id,work:'창문 유지'};
assert.equal(resolveComparisons([row],entries)[0].beforeImage.src,'https://example.com/before.jpg');
assert.equal(resolveComparisons([row],comparisonEntries([{url:'https://example.com/different.jpg'}],[]))[0].beforeImage,undefined);
assert.equal(resolveComparisons([{...row,before:entries[1].id}],entries)[0].beforeImage,undefined);
assert.equal(normalizeAttachments(['javascript:alert(1)']).length,0);
assert.equal(normalizeMaterials([{product:'타일 제조사 모델 A',method:'원본 계단 유지',imageKey:'material-0'}])[0].product,'타일 제조사 모델 A');
console.log('PASS explicit photo pairing, changed-source invalidation, photo role validation, attachment validation, product spec retention');

assert.equal(normalizeMaterials([{photo:'javascript:alert(1)'}])[0].photo,'');
assert.equal(normalizeMaterials([{photo:'data:image/jpeg;base64,eA=='}])[0].photo,'data:image/jpeg;base64,eA==');

const stable=normalizeMaterials([{id:'M-A1B2C3D4',part:'벽'},{id:'M-E5F6A7B8',part:'바닥'}]);assert.equal(normalizeMaterials(stable.slice(1))[0].id,'M-E5F6A7B8');
