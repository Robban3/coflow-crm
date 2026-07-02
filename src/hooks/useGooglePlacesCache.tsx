import { useState, useEffect, useCallback } from "react";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  types?: string[];
  openNow?: boolean;
}

interface CachedSearch {
  query: string;
  location: string;
  market: string;
  results: PlaceResult[];
  timestamp: number;
}

// Bumped to v2: the previous cache could hold pre-fix results (e.g. nationwide
// results for a city search) and wasn't market-aware; v2 drops all old entries.
const CACHE_KEY = "google_places_searches_v2";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHED_SEARCHES = 10;

export function useGooglePlacesCache() {
  const [cachedSearches, setCachedSearches] = useState<CachedSearch[]>([]);

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CachedSearch[];
        // Filter out expired entries
        const valid = parsed.filter(
          (s) => Date.now() - s.timestamp < CACHE_DURATION_MS
        );
        setCachedSearches(valid);
        // Save cleaned cache back
        if (valid.length !== parsed.length) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(valid));
        }
      }
    } catch (e) {
      console.error("Error loading search cache:", e);
    }
  }, []);

  // Get cached results for a query (market-aware)
  const getCachedResults = useCallback(
    (query: string, location: string, market = "SE"): PlaceResult[] | null => {
      const normalizedQuery = query.toLowerCase().trim();
      const normalizedLocation = location.toLowerCase().trim();

      const cached = cachedSearches.find(
        (s) =>
          s.query.toLowerCase().trim() === normalizedQuery &&
          s.location.toLowerCase().trim() === normalizedLocation &&
          (s.market || "SE") === market &&
          Date.now() - s.timestamp < CACHE_DURATION_MS
      );

      return cached?.results ?? null;
    },
    [cachedSearches]
  );

  // Save results to cache (market-aware)
  const cacheResults = useCallback(
    (query: string, location: string, results: PlaceResult[], market = "SE") => {
      const normalizedQuery = query.toLowerCase().trim();
      const normalizedLocation = location.toLowerCase().trim();

      setCachedSearches((prev) => {
        // Remove existing entry for same query + market
        const filtered = prev.filter(
          (s) =>
            !(
              s.query.toLowerCase().trim() === normalizedQuery &&
              s.location.toLowerCase().trim() === normalizedLocation &&
              (s.market || "SE") === market
            )
        );

        // Add new entry at the beginning
        const newEntry: CachedSearch = {
          query,
          location,
          market,
          results,
          timestamp: Date.now(),
        };

        const updated = [newEntry, ...filtered].slice(0, MAX_CACHED_SEARCHES);

        // Save to localStorage
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error("Error saving search cache:", e);
        }

        return updated;
      });
    },
    []
  );

  // Get recent searches for quick access
  const getRecentSearches = useCallback(() => {
    return cachedSearches
      .filter((s) => Date.now() - s.timestamp < CACHE_DURATION_MS)
      .map((s) => ({
        query: s.query,
        location: s.location,
        resultCount: s.results.length,
        timestamp: s.timestamp,
      }));
  }, [cachedSearches]);

  // Clear all cache
  const clearCache = useCallback(() => {
    setCachedSearches([]);
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return {
    getCachedResults,
    cacheResults,
    getRecentSearches,
    clearCache,
    hasCachedSearches: cachedSearches.length > 0,
  };
}
