export type AppliedPosImportSummary = {
  newProducts: number;
  newColors: number;
  newSizes: number;
  newVariants: number;
  priceChanges: number;
  stockChanges: number;
  priceAndStockChanges: number;
  updatedVariants: number;
  missingVariants: number;
};

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function formatAppliedPosImportSummary(summary: AppliedPosImportSummary) {
  const variantDetailUpdates = Math.max(0, summary.updatedVariants - summary.priceChanges - summary.stockChanges - summary.priceAndStockChanges);
  const parts = [
    summary.newProducts > 0 ? pluralize(summary.newProducts, "new item") : null,
    summary.newColors > 0 ? pluralize(summary.newColors, "new color") : null,
    summary.newSizes > 0 ? pluralize(summary.newSizes, "new size") : null,
    summary.newVariants > 0 ? pluralize(summary.newVariants, "new POS variant") : null,
    summary.priceChanges > 0 ? pluralize(summary.priceChanges, "price change") : null,
    summary.stockChanges > 0 ? pluralize(summary.stockChanges, "quantity change") : null,
    summary.priceAndStockChanges > 0 ? pluralize(summary.priceAndStockChanges, "price and quantity change") : null,
    variantDetailUpdates > 0 ? pluralize(variantDetailUpdates, "variant detail update") : null,
  ].filter((part): part is string => Boolean(part));
  return `Import complete: ${parts.length ? parts.join(", ") : "no catalogue changes"}.`;
}
