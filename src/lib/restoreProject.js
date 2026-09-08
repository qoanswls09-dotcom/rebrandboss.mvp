// Restore the existing database format without rewriting stored projects.
export function restoreProject(project, defaults = {}) {
  const decision = project.brand_decision || {};
  const pkg = project.interior_image_package || {};
  const formData = { ...defaults, ...(project.form_data || {}) };
  formData.referenceStyle = project.reference_style ?? formData.referenceStyle ?? '';
  return {
    rebrandDecision: {
      ...decision,
      newBrandName: decision.newBrandName || decision.brandName || pkg.selectedBrandName || '',
      newConcept: decision.newConcept || decision.storeConcept || pkg.selectedConcept || '',
      targetCustomers: decision.targetCustomers || decision.coreCustomers || '',
    },
    interiorImagePackage: pkg,
    referenceStyle: formData.referenceStyle,
    formData,
    images: project.images || {},
  };
}
