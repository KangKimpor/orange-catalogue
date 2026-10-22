import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Heart } from "lucide-react";

const KEY = "orange-favorites-v1";
export function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? Array.from(new Set(value.filter((slug): slug is string => typeof slug === "string" && slug.length > 0 && slug.length <= 160))) : [];
  } catch { return []; }
}

const FavoritesContext = createContext<{ slugs: string[]; temporary: boolean; toggle: (slug: string) => void }>({ slugs: [], temporary: false, toggle: () => {} });

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState(readFavorites);
  const [temporary, setTemporary] = useState(false);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === KEY || event.key === null) setSlugs(readFavorites()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function toggle(slug: string) {
    const next = slugs.includes(slug) ? slugs.filter(value => value !== slug) : [...slugs, slug];
    setSlugs(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); setTemporary(false); }
    catch { setTemporary(true); }
  }
  return <FavoritesContext.Provider value={{ slugs, temporary, toggle }}>{children}</FavoritesContext.Provider>;
}

export const useFavorites = () => useContext(FavoritesContext);

export function FavoriteButton({ slug, name }: { slug: string; name: string }) {
  const { slugs, toggle } = useFavorites();
  const saved = slugs.includes(slug);
  return <button type="button" className={`favorite-button ${saved ? "is-saved" : ""}`} aria-label={`${saved ? "Remove" : "Save"} ${name} ${saved ? "from" : "to"} favorites`} aria-pressed={saved} onClick={() => toggle(slug)}><Heart size={20} fill={saved ? "currentColor" : "none"} aria-hidden="true" /></button>;
}
