import { useState, useCallback, useRef } from "react";
import { Search, Star, ExternalLink, CheckCircle2, Loader2, Globe, Phone, Mail, Download, History, Trash2, AlertCircle, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useMarket, MARKET_LOCATION_PLACEHOLDER } from "@/hooks/useMarket";
import { useGooglePlacesCache } from "@/hooks/useGooglePlacesCache";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  lat?: number;
  lng?: number;
}

function normalizeUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase();
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+(ab|hb|kb|ek\.?\s*för\.?|handelsbolag|aktiebolag|kommanditbolag)\s*$/i, "")
    .replace(/[,.\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ── Geo-offset helpers ──
// Generate offset points around a center for discovering more results
function generateOffsetPoints(
  center: { lat: number; lng: number },
  iteration: number
): { lat: number; lng: number; radius: number }[] {
  // Each iteration explores further out with directional offsets
  // ~0.03 degrees ≈ 3km, so iteration 1 = ~3km offset, iteration 2 = ~6km, etc.
  const offsetDeg = 0.03 * iteration;
  const radius = 5000 + iteration * 3000; // 5km base, +3km per iteration
  
  return [
    { lat: center.lat + offsetDeg, lng: center.lng, radius },           // N
    { lat: center.lat - offsetDeg, lng: center.lng, radius },           // S
    { lat: center.lat, lng: center.lng + offsetDeg * 1.5, radius },     // E (lng degrees are smaller)
    { lat: center.lat, lng: center.lng - offsetDeg * 1.5, radius },     // W
    { lat: center.lat + offsetDeg * 0.7, lng: center.lng + offsetDeg, radius }, // NE
    { lat: center.lat - offsetDeg * 0.7, lng: center.lng - offsetDeg, radius }, // SW
  ];
}

// ── Saved search helpers ──
interface SavedSearch {
  industry: string;
  location: string;
  label: string;
  usedAt: number;
}

const SAVED_SEARCHES_KEY = "prospecting-saved-searches";

function loadSavedSearches(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || "[]");
  } catch { return []; }
}

function saveSavedSearches(searches: SavedSearch[]) {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(searches.slice(0, 8)));
}

export default function ProspectingSearchTab() {
  const orgId = useOrganizationId();
  const queryClient = useQueryClient();
  const { market } = useMarket();
  const { getCachedResults, cacheResults } = useGooglePlacesCache();

  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches());

  // Accumulated results across multiple searches
  const [accumulatedResults, setAccumulatedResults] = useState<PlaceResult[]>([]);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loadMoreIteration, setLoadMoreIteration] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const seenPlaceIdsRef = useRef<Set<string>>(new Set());

  // Fetch existing leads for dedup
  const { data: existingLeads } = useQuery({
    queryKey: ["prospecting-existing-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("leads")
        .select("id, company_name, website, email, enrichment_status, auto_draft_generated")
        .eq("organization_id", orgId);
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { data: sentEmailLeadIds } = useQuery({
    queryKey: ["prospecting-sent-leads", orgId],
    queryFn: async () => {
      if (!orgId) return new Set<string>();
      const { data } = await supabase
        .from("sent_emails")
        .select("lead_id")
        .eq("organization_id", orgId)
        .eq("status", "sent")
        .not("lead_id", "is", null);
      return new Set((data ?? []).map((d: any) => d.lead_id));
    },
    enabled: !!orgId,
  });

  // Initial search
  const searchQuery = useQuery({
    queryKey: ["prospecting-search", industry, location, market],
    queryFn: async () => {
      // Återanvänd cachat resultat (24h) för att slippa onödiga betal-API-anrop
      const cached = getCachedResults(industry, location);
      if (cached && cached.length > 0) {
        const cachedResults = cached as PlaceResult[];
        seenPlaceIdsRef.current = new Set(cachedResults.map(r => r.placeId));
        setAccumulatedResults(cachedResults);
        setSearchCenter(null);
        setLoadMoreIteration(0);
        setCanLoadMore(false);
        return cachedResults;
      }

      const { data, error } = await supabase.functions.invoke("google-places-search", {
        body: { query: industry, location, radius: 50000, market },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Sökningen misslyckades");

      const results = data.results as PlaceResult[];

      // Reset accumulated state for new search
      seenPlaceIdsRef.current = new Set(results.map(r => r.placeId));
      setAccumulatedResults(results);
      setSearchCenter(data.center || null);
      setLoadMoreIteration(0);
      setCanLoadMore(data.hasMore ?? false);

      // Spara i cache för återanvändning vid identisk sökning inom 24h
      cacheResults(industry, location, results as any);

      return results;
    },
    enabled: searchTriggered && !!industry,
  });

  // Load more results via geo-offset
  const handleLoadMore = useCallback(async () => {
    if (!searchCenter || isLoadingMore) return;
    
    setIsLoadingMore(true);
    const nextIteration = loadMoreIteration + 1;
    const offsets = generateOffsetPoints(searchCenter, nextIteration);
    
    let totalNewResults = 0;
    const allNew: PlaceResult[] = [];
    
    // Search each offset point, collecting new results
    for (const offset of offsets) {
      try {
        const { data, error } = await supabase.functions.invoke("google-places-search", {
          body: {
            query: industry,
            location,
            radius: 50000,
            market,
            locationBias: offset,
            excludePlaceIds: Array.from(seenPlaceIdsRef.current),
          },
        });
        
        if (error || !data?.success) continue;
        
        for (const result of data.results as PlaceResult[]) {
          if (!seenPlaceIdsRef.current.has(result.placeId)) {
            seenPlaceIdsRef.current.add(result.placeId);
            allNew.push(result);
            totalNewResults++;
          }
        }
      } catch (e) {
        console.warn("Offset search failed:", e);
      }
    }
    
    if (allNew.length > 0) {
      setAccumulatedResults(prev => [...prev, ...allNew]);
      toast.success(`${allNew.length} nya resultat hittades`);
    } else {
      toast.info("Inga fler unika resultat hittades i området");
      setCanLoadMore(false);
    }
    
    setLoadMoreIteration(nextIteration);
    setIsLoadingMore(false);
    
    // Stop after 3 iterations (enough coverage)
    if (nextIteration >= 3 && totalNewResults === 0) {
      setCanLoadMore(false);
    }
  }, [searchCenter, isLoadingMore, loadMoreIteration, industry, location]);

  // Check duplicates
  const getDuplicateInfo = useCallback(
    (place: PlaceResult): { isDuplicate: boolean; emailSent: boolean } => {
      if (!existingLeads?.length) return { isDuplicate: false, emailSent: false };
      const placeWebsite = place.website ? normalizeUrl(place.website) : null;
      const placeName = normalizeCompanyName(place.name);
      const existingLead = existingLeads.find((lead) => {
        if (placeWebsite && lead.website) {
          if (normalizeUrl(lead.website) === placeWebsite) return true;
        }
        if (lead.company_name && normalizeCompanyName(lead.company_name) === placeName) return true;
        return false;
      });
      if (!existingLead) return { isDuplicate: false, emailSent: false };
      return { isDuplicate: true, emailSent: sentEmailLeadIds?.has(existingLead.id) || false };
    },
    [existingLeads, sentEmailLeadIds]
  );

  const results = accumulatedResults;
  const filteredResults = results.filter((r) => !!r.website);
  const newResults = filteredResults.filter((r) => !getDuplicateInfo(r).isDuplicate);
  const duplicateResults = filteredResults.filter((r) => getDuplicateInfo(r).isDuplicate);
  const noWebsiteCount = results.length - filteredResults.length;

  const allNewSelected = newResults.length > 0 && newResults.every((r) => selectedIds.has(r.placeId));

  const toggleSelectAll = () => {
    if (allNewSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(newResults.map((r) => r.placeId)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Ingen organisation");
      const toImport = filteredResults.filter((r) => selectedIds.has(r.placeId));
      if (!toImport.length) throw new Error("Inga leads valda");

      const seen = new Set<string>();
      const uniqueToImport = toImport.filter((place) => {
        const key = normalizeCompanyName(place.name) + "|" + (place.website ? normalizeUrl(place.website) : "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let inserted = 0;
      let reset = 0;
      for (const place of uniqueToImport) {
        const { data: userData } = await supabase.auth.getUser();
        const row = {
          organization_id: orgId,
          company_name: place.name,
          website: place.website || null,
          phone: place.phone || null,
          source: "google_places",
          imported_via_prospecting: true,
          prospecting_source: "google_places",
          enrichment_status: "pending",
          lead_status: "active",
          created_by: userData.user?.id || null,
          source_data: {
            placeId: place.placeId,
            address: place.address,
            rating: place.rating,
            userRatingsTotal: place.userRatingsTotal,
          } as any,
        };

        let existingId: string | null = null;
        if (row.website) {
          const normalizedWeb = normalizeUrl(row.website);
          const { data } = await supabase
            .from("leads")
            .select("id, enrichment_status")
            .eq("organization_id", orgId)
            .ilike("website", `%${normalizedWeb}%`)
            .limit(1);
          if (data?.length) existingId = data[0].id;
        }
        if (!existingId) {
          const { data: nameMatch } = await supabase
            .from("leads")
            .select("id, enrichment_status")
            .eq("organization_id", orgId)
            .ilike("company_name", row.company_name)
            .limit(1);
          if (nameMatch?.length) existingId = nameMatch[0].id;
        }
        if (existingId) {
          await supabase.from("leads").update({
            enrichment_status: "pending",
            enrichment_error: null,
            auto_draft_generated: false,
            imported_via_prospecting: true,
          }).eq("id", existingId);
          await (supabase as any)
            .from("prospecting_drafts")
            .delete()
            .eq("lead_id", existingId)
            .in("status", ["draft", "rejected", "failed"]);
          reset++;
          continue;
        }

        const { error } = await supabase.from("leads").insert(row);
        if (error) {
          console.warn("Lead insert skip:", error.message);
          continue;
        }
        inserted++;
      }
      return { inserted, reset };
    },
    onSuccess: async ({ inserted, reset }) => {
      const parts: string[] = [];
      if (inserted > 0) parts.push(`${inserted} nya leads importerade`);
      if (reset > 0) parts.push(`${reset} befintliga leads återställda`);
      toast.success(parts.join(", ") || "Inga ändringar", {
        description: (inserted + reset) > 0 ? "Analys och outreach-generering startar automatiskt" : undefined,
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["prospecting-existing-leads"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue-count"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue"] });

      if ((inserted + reset) > 0 && orgId) {
        try {
          const { data: currentUser } = await supabase.auth.getUser();
          await supabase.functions.invoke("process-enrichment-queue", {
            body: { organization_id: orgId, user_id: currentUser.user?.id },
          });
        } catch (e) {
          console.warn("Auto-enrich trigger failed:", e);
        }
      }
    },
    onError: (err: Error) => {
      toast.error(`Import misslyckades: ${err.message}`);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry.trim()) return;
    addToSavedSearches(industry, location);
    setSelectedIds(new Set());
    setAccumulatedResults([]);
    seenPlaceIdsRef.current = new Set();
    setSearchCenter(null);
    setLoadMoreIteration(0);
    setCanLoadMore(false);
    setSearchTriggered(false);
    setTimeout(() => setSearchTriggered(true), 0);
  };

  const addToSavedSearches = (ind: string, loc: string) => {
    const label = `${ind}${loc ? ` – ${loc}` : ""}`;
    const existing = savedSearches.filter(
      (s) => !(s.industry === ind && s.location === loc)
    );
    const updated = [{ industry: ind, location: loc, label, usedAt: Date.now() }, ...existing].slice(0, 8);
    setSavedSearches(updated);
    saveSavedSearches(updated);
  };

  const applySavedSearch = (s: SavedSearch) => {
    setIndustry(s.industry);
    setLocation(s.location);
  };

  const removeSavedSearch = (idx: number) => {
    const updated = savedSearches.filter((_, i) => i !== idx);
    setSavedSearches(updated);
    saveSavedSearches(updated);
  };

  return (
    <div className="space-y-5 mt-4">
      {/* ── Search form ── */}
      <form onSubmit={handleSearch} className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Bransch</label>
          <Input
            placeholder="t.ex. Frisör, Restaurang, Tandläkare"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </div>
        <div className="w-[180px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Stad</label>
          <Input
            placeholder={MARKET_LOCATION_PLACEHOLDER[market]}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!industry.trim() || searchQuery.isFetching} className="gap-1.5">
          {searchQuery.isFetching ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Söker…</>
          ) : (
            <><Search className="h-4 w-4" />Sök</>
          )}
        </Button>
      </form>

      {/* ── Saved searches ── */}
      {savedSearches.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          {savedSearches.map((s, i) => (
            <div key={i} className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => applySavedSearch(s)}
              >
                {s.label}
              </Button>
              <button
                className="text-muted-foreground hover:text-destructive p-0.5"
                onClick={() => removeSavedSearch(i)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {searchQuery.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {searchQuery.error instanceof Error ? searchQuery.error.message : "Sökningen misslyckades"}
        </div>
      )}

      {/* ── Results ── */}
      {filteredResults.length > 0 && (
        <>
          {/* Summary + Import bar */}
          <Card className="border-primary/20">
            <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allNewSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={newResults.length === 0}
                />
                <div className="text-sm">
                  <strong>{newResults.length}</strong> nya leads med hemsida
                  {duplicateResults.length > 0 && (
                    <span className="text-muted-foreground ml-2">
                      ({duplicateResults.length} redan i systemet)
                    </span>
                  )}
                  {noWebsiteCount > 0 && (
                    <span className="text-muted-foreground ml-2">
                      ({noWebsiteCount} utan hemsida dolda)
                    </span>
                  )}
                  {accumulatedResults.length > 20 && (
                    <span className="text-muted-foreground ml-2">
                      · {accumulatedResults.length} totalt
                    </span>
                  )}
                </div>
              </div>
              <Button
                disabled={selectedIds.size === 0 || importMutation.isPending}
                onClick={() => importMutation.mutate()}
                className="gap-1.5"
              >
                {importMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Importerar…</>
                ) : (
                  <><Download className="h-4 w-4" />Importera {selectedIds.size} leads</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Lead list */}
          <div className="space-y-1.5">
            {filteredResults.map((place) => {
              const dupInfo = getDuplicateInfo(place);
              const selected = selectedIds.has(place.placeId);
              const domain = place.website ? getDomain(place.website) : null;
              return (
                <div
                  key={place.placeId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    dupInfo.isDuplicate
                      ? "opacity-50 bg-muted/30"
                      : selected
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  {!dupInfo.isDuplicate && (
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleSelect(place.placeId)}
                    />
                  )}
                  {domain && (
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                      alt=""
                      className="w-5 h-5 rounded shrink-0"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{place.name}</span>
                      {dupInfo.isDuplicate && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {dupInfo.emailSent ? "Mail skickat" : "Finns redan"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="truncate max-w-[200px]">{place.address}</span>
                      {place.rating && (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {place.rating}
                        </span>
                      )}
                      {place.phone && (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Phone className="h-3 w-3" />{place.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {place.website && (
                    <a
                      href={place.website.startsWith("http") ? place.website : `https://${place.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline truncate max-w-[140px]">{normalizeUrl(place.website)}</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Load more button ── */}
          {(canLoadMore || loadMoreIteration < 3) && searchCenter && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="gap-2"
              >
                {isLoadingMore ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Söker fler i området…</>
                ) : (
                  <><ChevronDown className="h-4 w-4" />Ladda fler resultat</>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {searchTriggered && !searchQuery.isFetching && filteredResults.length === 0 && !searchQuery.isError && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Inga resultat med hemsida hittades. Försök med andra söktermer.</p>
        </div>
      )}

      {!searchTriggered && savedSearches.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium mb-1">Sök efter företag i en bransch och stad</p>
          <p className="text-xs">Granska resultaten och importera de du vill kontakta</p>
        </div>
      )}
    </div>
  );
}
