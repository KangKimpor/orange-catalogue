import { z } from "zod";

const salesVariant = z.object({
  posCode: z.string().min(1),
  cleanedCode: z.string().min(1),
  colorEnglish: z.string(),
  size: z.string().nullable(),
  price: z.number().finite().nonnegative(),
  stockQuantity: z.number().int(),
});
export const salesSource = z.array(salesVariant);
type SalesVariant = z.infer<typeof salesVariant>;

export function analyseSales(
  previous: SalesVariant[],
  current: SalesVariant[]
) {
  const before = new Map(previous.map(item => [item.posCode, item]));
  const items = new Map<
    string,
    {
      code: string;
      units: number;
      value: number;
      restocked: number;
      variants: Array<{
        posCode: string;
        color: string;
        size: string | null;
        units: number;
        value: number;
        restocked: number;
      }>;
    }
  >();
  let comparedVariants = 0;
  for (const item of current) {
    const prior = before.get(item.posCode);
    if (!prior || prior.cleanedCode !== item.cleanedCode) continue;
    comparedVariants++;
    // shortcut: net stock changes cannot identify transactions; use a sales export when available.
    const delta =
      Math.max(0, prior.stockQuantity) - Math.max(0, item.stockQuantity);
    if (!delta) continue;
    const units = Math.max(0, delta);
    const restocked = Math.max(0, -delta);
    const value = units * Math.round(prior.price * 100);
    const group = items.get(item.cleanedCode) ?? {
      code: item.cleanedCode,
      units: 0,
      value: 0,
      restocked: 0,
      variants: [],
    };
    group.units += units;
    group.value += value;
    group.restocked += restocked;
    group.variants.push({
      posCode: item.posCode,
      color: item.colorEnglish || "One Color",
      size: item.size,
      units,
      value: value / 100,
      restocked,
    });
    items.set(item.cleanedCode, group);
  }
  const rows = Array.from(items.values()).sort(
    (a, b) =>
      b.units - a.units || b.value - a.value || a.code.localeCompare(b.code)
  );
  return {
    comparedVariants,
    units: rows.reduce((sum, item) => sum + item.units, 0),
    value: rows.reduce((sum, item) => sum + item.value, 0) / 100,
    restocked: rows.reduce((sum, item) => sum + item.restocked, 0),
    sellingItems: rows.filter(item => item.units > 0).length,
    items: rows.map(item => ({ ...item, value: item.value / 100 })),
  };
}
