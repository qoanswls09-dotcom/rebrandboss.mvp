// Apply the user's confirmed identity to the data used by save, images and PDF.
export function applyBrandIdentity(result, selected) {
  const name = typeof selected?.name === 'string' ? selected.name.trim() : '';
  if (!result || !name) return result;
  const decision = result.rebrandDecision || {};
  return {
    ...result,
    rebrandDecision: { ...decision, newBrandName: name,
      tagline: typeof selected.tagline === 'string' ? selected.tagline : decision.tagline },
    interiorImagePackage: result.interiorImagePackage ? {
      ...result.interiorImagePackage, selectedBrandName: name,
    } : result.interiorImagePackage,
  };
}
