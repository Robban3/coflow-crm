/** Pick the localized variant for the active language, falling back to Swedish. */
export function pickLocalized<T>(language: string, base: T, en?: T | null, es?: T | null): T {
  if (language === "en" && en != null) return en;
  if (language === "es" && es != null) return es;
  return base;
}
