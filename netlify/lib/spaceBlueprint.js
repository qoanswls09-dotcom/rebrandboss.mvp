import {normalizeSpaceState,spacePlanId} from '../../src/lib/spaceBlueprint.js';
import {layout} from '../../public/space3d/model.js';
export function prepareSpaceBlueprint(input,brandContext={},sceneIndex=0){
 if(input==null)return null;
 if(input.version!==3||!input.state||typeof input.render!=='string'||input.render.length>1800000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input.render))throw new Error('3D 공간 기준 이미지가 올바르지 않습니다. 배치를 다시 확정해주세요.');
 const state=normalizeSpaceState(input.state),L=layout(state);
 if(L.tables!==state.tables||L.barSeats!==state.barSeats)throw new Error('현재 크기와 배치 수량이 맞지 않습니다. 3D 배치를 다시 확정해주세요.');
 const materials={paint:'painted finish',plaster:'plaster finish',wood:'wood finish',tile:'tile finish',concrete:'concrete finish',oak:'oak finish',walnut:'walnut finish',laminate:'wood-look laminate'};
 const prompt=[
 'GEOMETRY-LOCKED MATERIAL STUDY. The supplied image is the authoritative render of ONE user-confirmed 3D room. Preserve its exact camera, perspective, walls, opening positions and all furniture positions and counts. Do not redesign the room or change the camera. Improve surface realism and illumination only. Preserve cutaway boundaries when present. Do not create unseen windows, stairs, columns, rooms or kitchen equipment.',
 `Rectangle ${state.width}m wide x ${state.depth}m deep, wall height ${state.height}m; dimensions are ${state.dimensionSource}, not independently verified. One front entrance ${state.doorWidth}m wide, normalized horizontal offset ${state.doorPosition}.`,
 `Authoritative TOTAL furniture: ${L.tables} four-person tables and ${L.barSeats} counter stools, ${L.seats} total seats. Never duplicate furniture outside the shown plan. Counter position: ${state.roomStyle==='window-lounge'?'none; left wall window bays and bench seating':state.counter}. Bench-side tables include two assumed bench seats each; retain the visible bench geometry.`,
 `Wall: ${materials[state.wallType]}, ${state.wall}. Floor: ${materials[state.floorType]}, ${state.floor}. Furniture: ${materials[state.woodType]}, ${state.wood}. Metal details: ${state.metal}. Lighting color: ${state.light}. All colors and materials override earlier mood references.`,
 `Shot ${Math.max(0,Math.min(2,sceneIndex))+1} uses its own supplied model render; retain that render's camera exactly.`,
 typeof brandContext.storeConcept==='string'?`Brand atmosphere only (must not alter layout): ${brandContext.storeConcept.slice(0,1500)}`:'',
 typeof brandContext.overallMood==='string'?`Mood only: ${brandContext.overallMood.slice(0,500)}`:'',
 'No people. No added signage, text, watermark or labels. Photorealistic material visualization of the supplied geometry. This is a concept image, not a verified construction drawing.'
 ].filter(Boolean).join('\n');
 return {state,planId:spacePlanId(state),reference:input.render,prompt};
}
