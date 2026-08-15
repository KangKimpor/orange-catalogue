export const PUBLIC_CATEGORIES = [
  { slug: "just-in", label: "Just In" },
  { slug: "tops", label: "Tops" },
  { slug: "jeans", label: "Jeans" },
  { slug: "shorts", label: "Shorts" },
  { slug: "pants", label: "Pants" },
] as const;

export type CategorySlug = (typeof PUBLIC_CATEGORIES)[number]["slug"];

type ColorDefinition = { english: string; hex: string; key: string };

const COLOR_MAP: Record<string, ColorDefinition> = {
  "ទឹកប៊ិច": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "ទឹកបិច": { english: "Ink Blue", hex: "#2C3E5C", key: "ink-blue" },
  "ត្នោត": { english: "Brown", hex: "#6B4A30", key: "brown" },
  "ឈូក": { english: "Pink", hex: "#D98AA0", key: "pink" },
  "ផ្ទៃមេឃ": { english: "Sky Blue", hex: "#7FA6C4", key: "sky-blue" },
  "ប្រផេះ": { english: "Grey", hex: "#8B8983", key: "grey" },
  "ខ្មៅ": { english: "Black", hex: "#1A1A1A", key: "black" },
  "សាច់": { english: "Nude", hex: "#D9B99B", key: "nude" },
  "ត្នោតដិត": { english: "Dark Brown", hex: "#4A3220", key: "dark-brown" },
  "ស": { english: "White", hex: "#F2EEE4", key: "white" },
  "សរ": { english: "White", hex: "#F2EEE4", key: "white" },
  "ខៀវ": { english: "Blue", hex: "#3A5A78", key: "blue" },
  "គ្រីម": { english: "Cream", hex: "#E8DFC8", key: "cream" },
  "បៃតង": { english: "Green", hex: "#5B7A4F", key: "green" },
  "ស្វាយ": { english: "Purple", hex: "#6B5178", key: "purple" },
  "លឿង": { english: "Yellow", hex: "#D4B441", key: "yellow" },
  "ទឹកសណ្តែក": { english: "Tan", hex: "#B49868", key: "tan" },
  "ឈូកស្រាល": { english: "Light Pink", hex: "#E8B9C8", key: "light-pink" },
  "ក្រហម": { english: "Red", hex: "#A13A2E", key: "red" },
  "ខៀវស្រាល": { english: "Light Blue", hex: "#A9C2D6", key: "light-blue" },
  "ក្រហមដិត": { english: "Dark Red", hex: "#7A2A20", key: "dark-red" },
  "ស្លែ": { english: "Olive", hex: "#6B6B45", key: "olive" },
  "ត្នោតស្រាល": { english: "Light Brown", hex: "#9C7A54", key: "light-brown" },
  "ប្រផេះក្រម៉ៅ": { english: "Dark Grey", hex: "#5A5852", key: "dark-grey" },
  "ខៀវក្រម៉ៅ": { english: "Denim Blue", hex: "#33475A", key: "denim-blue" },
  "One Color": { english: "One Color", hex: "#7A7A7A", key: "one-color" },
};

export function cleanProductCode(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\s*\(?\s*បញ្ចុះ\s*\)?\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeSlug(value: string): string {
  const normalized = cleanProductCode(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || "untitled-product";
}

export function classifyProduct(cleanedCode: string): CategorySlug {
  const upper = cleanedCode.trim().toUpperCase();
  if (/^(ZS|ZL)\b/.test(upper)) return "tops";
  if (/^(SK|SJ|WJ|FJ)\b/.test(upper)) return "jeans";
  if (/^SP\b/.test(upper)) return "shorts";
  if (/^LP\b/.test(upper)) return "pants";
  return "just-in";
}

export function normalizeAttribute(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAttributes(value: unknown): {
  colorKhmer: string | null;
  colorEnglish: string;
  colorHex: string;
  colorKey: string;
  size: string | null;
} {
  const compact = normalizeAttribute(value);
  const tokens = compact
    .split("-")
    .map(token => token.trim())
    .filter(Boolean);

  const size = tokens.find(token => /^(XS|S|M|L|XL|XXL|FREE|ONE SIZE)$/i.test(token)) ?? null;
  const colorKhmer = tokens.find(token => Boolean(COLOR_MAP[token])) ?? null;
  const known = colorKhmer ? COLOR_MAP[colorKhmer] : undefined;

  return {
    colorKhmer,
    colorEnglish: known?.english ?? (compact || "One Color"),
    colorHex: known?.hex ?? "#9A9A94",
    colorKey: known?.key ?? `unknown-${compact.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "one-color"}`,
    size,
  };
}

export function buildMessengerOrderUrl(input: { productCode: string; color: string; size?: string | null }): string {
  const text = [
    "Hi Orange, I would like to order:",
    `Product code: ${input.productCode}`,
    `Color: ${input.color}`,
    input.size ? `Size: ${input.size}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://m.me/OfficiallyDavit?text=${encodeURIComponent(text)}`;
}
