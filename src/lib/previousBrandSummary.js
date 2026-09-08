// Regeneration needs the prior identity, not embedded images or full saved results.
export function previousBrandSummary(result) {
  if (!result || typeof result !== 'object') return null;
  const summary = {};
  if (result.brandDecision) summary.brandDecision = {brandName:result.brandDecision.brandName || '',storeConcept:result.brandDecision.storeConcept || ''};
  if (result.rebrandDecision) summary.rebrandDecision = {newBrandName:result.rebrandDecision.newBrandName || '',newConcept:result.rebrandDecision.newConcept || ''};
  return summary;
}
