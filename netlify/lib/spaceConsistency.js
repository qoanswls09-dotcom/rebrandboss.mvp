// FLUX.2 supports input_image plus input_image_2. Keep geometry and design roles explicit.
// https://github.com/black-forest-labs/skills/blob/master/skills/bfl-api/references/endpoints.md
export function spaceReferencePrompt(prompt, hasSourcePhoto = false) {
  return [
    prompt,
    hasSourcePhoto
      ? 'REFERENCE ROLES: Image 1 is the ORIGINAL target photograph. It is authoritative for camera, perspective, room outline, doors, windows, columns and all retained fixtures. Image 2 is the already redesigned SAME STORE from another view. Use image 2 ONLY for the finish palette and the design of items explicitly allowed to change.'
      : 'REFERENCE ROLES: Image 1 is the established design of THIS EXACT ROOM, not an inspiration image. Preserve the exact furniture models, quantity, placement, wall finishes, ceiling lights and openings. Move the camera only a short distance within the visible room.',
    'Preservation instructions and excluded work always take priority over the style reference. Never copy an opening or furniture position from a different viewpoint onto the target wall.',
    'Do not introduce a new kitchen, private room, window, door or decorative feature to make a new shot interesting. Reframe an existing visible zone instead. Features may be out of frame or occluded; do not move or duplicate them to show every feature in every image.',
    'Keep all existing material decisions consistent; no new redesign between views.',
  ].join(' ');
}
export function referenceImageValue(value) {
  if (typeof value !== 'string' || !value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (/^data:image\/(jpeg|png|webp);base64,/i.test(value)) return value.slice(value.indexOf(',')+1);
  return null;
}
