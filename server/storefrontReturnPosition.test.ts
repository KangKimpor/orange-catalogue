import { describe, expect, it } from "vitest";
import { clearStorefrontReturnPosition, readStorefrontReturnPosition, saveStorefrontReturnPosition, storefrontHref } from "../client/src/lib/storefrontReturnPosition";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("storefront return position", () => {
  it("stores a normalized vertical position with the active category URL", () => {
    const storage = memoryStorage();
    const location = { pathname: "/", search: "?category=tops" };

    expect(storefrontHref(location)).toBe("/?category=tops");
    expect(saveStorefrontReturnPosition(storage, location, 842.6)).toEqual({ href: "/?category=tops", scrollY: 843 });
    expect(readStorefrontReturnPosition(storage)).toEqual({ href: "/?category=tops", scrollY: 843 });
  });

  it("falls back safely when saved session data is malformed or not a storefront route", () => {
    const storage = memoryStorage();
    storage.setItem("orange-storefront-return-position", "not-json");
    expect(readStorefrontReturnPosition(storage)).toBeNull();

    storage.setItem("orange-storefront-return-position", JSON.stringify({ href: "/admin", scrollY: 240 }));
    expect(readStorefrontReturnPosition(storage)).toBeNull();
  });

  it("clears a restored return position so a later direct storefront visit starts normally", () => {
    const storage = memoryStorage();
    saveStorefrontReturnPosition(storage, { pathname: "/", search: "" }, 128);
    clearStorefrontReturnPosition(storage);
    expect(readStorefrontReturnPosition(storage)).toBeNull();
  });
});
