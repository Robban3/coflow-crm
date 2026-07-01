import { useState, useCallback, useEffect, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTIES, COMPANY_FORMS, INDUSTRIES } from "@/lib/swedishProspecting";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

interface RegistryRow {
  id: string;
  company_name: string;
  org_number: string;
  company_form: string | null;
  registration_date: string | null;
  legal_form: string | null;
  address: string | null;
  co_address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  sni_codes: string | null;
  sni_descriptions: string | null;
}

// today minus N years, yyyy-mm-dd
function isoYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

// today minus N months, yyyy-mm-dd
function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { market } = useMarket();
  const { getCachedResults, cacheResults, clearCache } = useGooglePlacesCache();

  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [submitted, setSubmitted] = useState<{ industry: string; location: string; nonce: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(loadSavedSearches());

  // ── Search source toggle + register-mode filters ──
  const [searchSource, setSearchSource] = useState<"places" | "registry">("places");
  const [region, setRegion] = useState("");          // county (län) code, "" = all
  const [companyForm, setCompanyForm] = useState(""); // ilike keyword
  const [regDateFrom, setRegDateFrom] = useState(""); // yyyy-mm-dd
  const [youngerThan, setYoungerThan] = useState(""); // years, string
  const [olderThan, setOlderThan] = useState("");     // years, string
  const [registryResults, setRegistryResults] = useState<RegistryRow[]>([]);
  const [registrySelected, setRegistrySelected] = useState<Set<string>>(new Set());
  const [registrySearched, setRegistrySearched] = useState(false);
  const [isRegistrySearching, setIsRegistrySearching] = useState(false);
  const [registryPage, setRegistryPage] = useState(0);
  const [registryTotal, setRegistryTotal] = useState(0);
  const REGISTRY_PAGE_SIZE = 100;
  const [isRegistryImporting, setIsRegistryImporting] = useState(false);

  // Org numbers already imported as leads, for hiding them from register hits.
  // Leads are private (RLS scopes them per owner), so we go through the org-wide
  // get_org_lead_claims() RPC: a company imported by ANYONE in the org is hidden
  // for everyone, so two salespeople can't claim the same company.
  const { data: registryExistingOrg } = useQuery({
    queryKey: ["prospecting-lead-orgnumbers", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_org_lead_claims");
      return new Set(
        (data ?? [])
          .map((d: any) => String(d.org_number ?? "").replace(/\D/g, ""))
          .filter(Boolean),
      );
    },
  });

  // The company_registry is Swedish-only. Outside the SE market, force the
  // Google Places flow so nothing register-related renders or runs.
  useEffect(() => {
    if (market !== "SE" && searchSource !== "places") {
      setSearchSource("places");
    }
  }, [market, searchSource]);

  // Accumulated results across multiple searches
  const [accumulatedResults, setAccumulatedResults] = useState<PlaceResult[]>([]);
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loadMoreIteration, setLoadMoreIteration] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(false);
  const seenPlaceIdsRef = useRef<Set<string>>(new Set());

  // Fetch existing leads for dedup. Leads are private, so we go through the
  // org-wide get_org_lead_claims() RPC: it returns only identifying fields +
  // owner name for EVERY lead in the org, so companies already taken by other
  // users are greyed out too (with the owner shown).
  const { data: existingLeads } = useQuery({
    queryKey: ["prospecting-existing-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await (supabase as any).rpc("get_org_lead_claims");
      return (data ?? []) as Array<{
        id: string;
        company_name: string | null;
        website: string | null;
        email: string | null;
        enrichment_status: string | null;
        auto_draft_generated: boolean | null;
        owner_id: string | null;
        owner_name: string | null;
      }>;
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

  // Sökningen körs ENBART när man klickar Sök (submitted-snapshot), aldrig per tangenttryck
  const searchQuery = useQuery({
    queryKey: ["prospecting-search", submitted?.industry, submitted?.location, market, submitted?.nonce],
    queryFn: async () => {
      const sIndustry = submitted!.industry;
      const sLocation = submitted!.location;

      // Återanvänd cachat resultat (24h) för att slippa onödiga betal-API-anrop
      const cached = getCachedResults(sIndustry, sLocation);
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
        body: { query: sIndustry, location: sLocation, radius: 50000, market },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || t("prospecting.searchFailed"));

      const results = data.results as PlaceResult[];

      // Reset accumulated state for new search
      seenPlaceIdsRef.current = new Set(results.map(r => r.placeId));
      setAccumulatedResults(results);
      setSearchCenter(data.center || null);
      setLoadMoreIteration(0);
      setCanLoadMore(data.hasMore ?? false);

      // Spara i cache för återanvändning vid identisk sökning inom 24h
      cacheResults(sIndustry, sLocation, results as any);

      return results;
    },
    enabled: !!submitted?.industry,
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
            query: submitted?.industry ?? industry,
            location: submitted?.location ?? location,
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
      toast.success(t("prospecting.newResultsFound", { count: allNew.length }));
    } else {
      toast.info(t("prospecting.noMoreResults"));
      setCanLoadMore(false);
    }
    
    setLoadMoreIteration(nextIteration);
    setIsLoadingMore(false);
    
    // Stop after 3 iterations (enough coverage)
    if (nextIteration >= 3 && totalNewResults === 0) {
      setCanLoadMore(false);
    }
  }, [searchCenter, isLoadingMore, loadMoreIteration, industry, location, submitted]);

  // Check duplicates
  const getDuplicateInfo = useCallback(
    (place: PlaceResult): { isDuplicate: boolean; emailSent: boolean; ownerName: string | null } => {
      if (!existingLeads?.length) return { isDuplicate: false, emailSent: false, ownerName: null };
      const placeWebsite = place.website ? normalizeUrl(place.website) : null;
      const placeName = normalizeCompanyName(place.name);
      const existingLead = existingLeads.find((lead) => {
        if (placeWebsite && lead.website) {
          if (normalizeUrl(lead.website) === placeWebsite) return true;
        }
        if (lead.company_name && normalizeCompanyName(lead.company_name) === placeName) return true;
        return false;
      });
      if (!existingLead) return { isDuplicate: false, emailSent: false, ownerName: null };
      return {
        isDuplicate: true,
        emailSent: sentEmailLeadIds?.has(existingLead.id) || false,
        ownerName: existingLead.owner_name ?? null,
      };
    },
    [existingLeads, sentEmailLeadIds]
  );

  const results = accumulatedResults;
  // Companies without a website are still valuable, callable leads (phone +
  // address), so we show and import them too — no longer filtered out.
  const filteredResults = results;
  const newResults = filteredResults.filter((r) => !getDuplicateInfo(r).isDuplicate);
  const duplicateResults = filteredResults.filter((r) => getDuplicateInfo(r).isDuplicate);
  const noWebsiteCount = results.filter((r) => !r.website).length;

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
      if (!orgId) throw new Error(t("prospecting.noOrg"));
      const toImport = filteredResults.filter((r) => selectedIds.has(r.placeId));
      if (!toImport.length) throw new Error(t("prospecting.noLeadsSelected"));

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
      if (inserted > 0) parts.push(t("prospecting.newLeadsImported", { count: inserted }));
      if (reset > 0) parts.push(t("prospecting.existingLeadsReset", { count: reset }));
      toast.success(parts.join(", ") || t("prospecting.noChanges"), {
        description: (inserted + reset) > 0 ? t("prospecting.autoStartDesc") : undefined,
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
      toast.error(t("prospecting.importFailed", { message: err.message }));
    },
  });

  // ── Register (company_registry) search ──
  const runRegistrySearch = useCallback(async (page = 0) => {
    setIsRegistrySearching(true);
    setRegistrySearched(true);
    setRegistrySelected(new Set());
    try {
      let q = supabase.from("company_registry" as any).select("*", { count: "exact" });
      if (industry.trim()) {
        // Match SNI text (CSV imports) OR the business description (Bolagsverket).
        const term = industry.trim().replace(/[%,()]/g, " ").trim();
        q = q.or(`sni_descriptions.ilike.%${term}%,business_description.ilike.%${term}%`);
      }
      if (location.trim()) q = q.ilike("city", `%${location.trim()}%`);
      if (companyForm) q = q.ilike("company_form", `%${companyForm}%`);
      if (region) {
        const prefixes = COUNTIES.find((c) => c.code === region)?.prefixes ?? [];
        if (prefixes.length) q = q.or(prefixes.map((p) => `postal_code.like.${p}%`).join(","));
      }
      if (regDateFrom) q = q.gte("registration_date", regDateFrom);
      const younger = parseInt(youngerThan, 10);
      if (Number.isFinite(younger) && younger > 0) q = q.gte("registration_date", isoYearsAgo(younger));
      const older = parseInt(olderThan, 10);
      if (Number.isFinite(older) && older > 0) q = q.lte("registration_date", isoYearsAgo(older));
      const from = page * REGISTRY_PAGE_SIZE;
      q = q.order("company_name").range(from, from + REGISTRY_PAGE_SIZE - 1);

      const { data, count, error } = await q;
      if (error) throw error;
      setRegistryResults(((data as unknown) as RegistryRow[]) || []);
      setRegistryTotal(count ?? 0);
      setRegistryPage(page);
    } catch (err: any) {
      toast.error(t("prospecting.searchFailed"), { description: err?.message });
      setRegistryResults([]);
    } finally {
      setIsRegistrySearching(false);
    }
  }, [industry, location, companyForm, region, regDateFrom, youngerThan, olderThan, t]);

  const toggleRegistrySelect = (id: string) => {
    setRegistrySelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Hide companies already imported as leads (dedup by org number).
  const registryDisplay = registryResults.filter(
    (r) => !registryExistingOrg?.has(String(r.org_number).replace(/\D/g, "")),
  );

  const allRegistrySelected =
    registryDisplay.length > 0 && registryDisplay.every((r) => registrySelected.has(r.id));

  const toggleRegistrySelectAll = () => {
    if (allRegistrySelected) setRegistrySelected(new Set());
    else setRegistrySelected(new Set(registryDisplay.map((r) => r.id)));
  };

  const handleRegistryImport = async () => {
    if (!orgId) {
      toast.error(t("prospecting.noOrg"));
      return;
    }
    const selectedRows = registryResults.filter((r) => registrySelected.has(r.id));
    if (!selectedRows.length) {
      toast.error(t("prospecting.noLeadsSelected"));
      return;
    }
    setIsRegistryImporting(true);
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      const leads = selectedRows.map((c) => ({
        company_name: c.company_name,
        org_number: c.org_number,
        phone: c.phone || null,
        source: "company_registry",
        prospecting_source: "company_registry",
        imported_via_prospecting: true,
        enrichment_status: "pending",
        organization_id: orgId,
        created_by: currentUser.user?.id || null,
        source_data: {
          company_form: c.company_form,
          registration_date: c.registration_date,
          legal_form: c.legal_form,
          address: c.address,
          co_address: c.co_address,
          postal_code: c.postal_code,
          city: c.city,
          country: c.country,
          sni_codes: c.sni_codes,
          sni_descriptions: c.sni_descriptions,
        } as any,
      }));

      const { error } = await supabase.from("leads").insert(leads);
      if (error) throw error;

      toast.success(t("prospecting.regImported", { count: leads.length }), {
        description: t("prospecting.autoStartDesc"),
      });
      setRegistrySelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["prospecting-existing-leads"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue-count"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-queue"] });
      // Refresh the imported-org dedup set and reload the current page so the
      // companies just imported drop out of the results.
      await queryClient.invalidateQueries({ queryKey: ["prospecting-lead-orgnumbers"] });
      runRegistrySearch(registryPage);

      try {
        await supabase.functions.invoke("process-enrichment-queue", {
          body: { organization_id: orgId, user_id: currentUser.user?.id },
        });
      } catch (e) {
        console.warn("Auto-enrich trigger failed:", e);
      }
    } catch (err: any) {
      toast.error(t("prospecting.importFailed", { message: err?.message ?? "" }));
    } finally {
      setIsRegistryImporting(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSource === "registry") {
      runRegistrySearch(0);
      return;
    }
    if (!industry.trim()) return;
    addToSavedSearches(industry, location);
    setSelectedIds(new Set());
    setAccumulatedResults([]);
    seenPlaceIdsRef.current = new Set();
    setSearchCenter(null);
    setLoadMoreIteration(0);
    setCanLoadMore(false);
    setSubmitted({ industry: industry.trim(), location: location.trim(), nonce: Date.now() });
  };

  const handleClear = () => {
    setIndustry("");
    setLocation("");
    setSelectedIds(new Set());
    setAccumulatedResults([]);
    seenPlaceIdsRef.current = new Set();
    setSearchCenter(null);
    setLoadMoreIteration(0);
    setCanLoadMore(false);
    setSubmitted(null);
    clearCache(); // töm 24h-cachen så nästa sökning hämtar färska resultat
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
      {/* ── Search-source toggle (Swedish market only) ── */}
      {market === "SE" && (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t("prospecting.sourceLabel")}:</span>
        <div className="inline-flex rounded-lg border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={searchSource === "places" ? "default" : "ghost"}
            className="h-7"
            onClick={() => setSearchSource("places")}
          >
            {t("prospecting.sourcePlaces")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={searchSource === "registry" ? "default" : "ghost"}
            className="h-7"
            onClick={() => setSearchSource("registry")}
          >
            {t("prospecting.sourceRegistry")}
          </Button>
        </div>
      </div>
      )}

      {/* ── Search form ── */}
      <form onSubmit={handleSearch} className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-0 sm:min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("prospecting.industry")}</label>
          <Input
            placeholder={t("prospecting.industryPlaceholder")}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[180px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("prospecting.city")}</label>
          <Input
            placeholder={MARKET_LOCATION_PLACEHOLDER[market]}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        {searchSource === "places" ? (
          <Button type="submit" disabled={!industry.trim() || searchQuery.isFetching} className="gap-1.5">
            {searchQuery.isFetching ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t("prospecting.searching")}</>
            ) : (
              <><Search className="h-4 w-4" />{t("prospecting.search")}</>
            )}
          </Button>
        ) : (
          <Button type="submit" disabled={isRegistrySearching} className="gap-1.5">
            {isRegistrySearching ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t("prospecting.searching")}</>
            ) : (
              <><Search className="h-4 w-4" />{t("prospecting.search")}</>
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          disabled={searchQuery.isFetching || (!industry && !location && accumulatedResults.length === 0)}
          className="gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          {t("prospecting.clear")}
        </Button>
      </form>

      {/* ── Register advanced filters ── */}
      {searchSource === "registry" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted/50 rounded-lg">
          <Select value={region || "__all__"} onValueChange={(v) => setRegion(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={t("companyRegistry.filterCounty")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("companyRegistry.filterCountyAll")}</SelectItem>
              {COUNTIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={companyForm || "__all__"} onValueChange={(v) => setCompanyForm(v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={t("companyRegistry.filterForm")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("companyRegistry.filterFormAll")}</SelectItem>
              {COMPANY_FORMS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={INDUSTRIES.some((i) => i.value === industry) ? industry : "__all__"}
            onValueChange={(v) => setIndustry(v === "__all__" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder={t("companyRegistry.filterIndustry")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("companyRegistry.filterIndustryAll")}</SelectItem>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            placeholder={t("companyRegistry.filterYoungerThan")}
            title={t("companyRegistry.filterYoungerThan")}
            value={youngerThan}
            onChange={(e) => setYoungerThan(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            placeholder={t("companyRegistry.filterOlderThan")}
            title={t("companyRegistry.filterOlderThan")}
            value={olderThan}
            onChange={(e) => setOlderThan(e.target.value)}
          />
          <div className="col-span-2 md:col-span-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("companyRegistry.newlyStarted")}:</span>
            {[3, 6, 12].map((m) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => setRegDateFrom(isoMonthsAgo(m))}
              >
                {t("companyRegistry.lastMonths", { months: m })}
              </Button>
            ))}
            {regDateFrom && (
              <Badge variant="secondary" className="text-[10px]">{regDateFrom}</Badge>
            )}
          </div>
        </div>
      )}

      {/* ── Saved searches ── */}
      {searchSource === "places" && savedSearches.length > 0 && (
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
      {searchSource === "places" && searchQuery.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {searchQuery.error instanceof Error ? searchQuery.error.message : t("prospecting.searchFailed")}
        </div>
      )}

      {/* ── Results ── */}
      {searchSource === "places" && filteredResults.length > 0 && (
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
                  <strong>{newResults.length}</strong> {t("prospecting.newLeadsSuffix")}
                  {duplicateResults.length > 0 && (
                    <span className="text-muted-foreground ml-2">
                      {t("prospecting.alreadyInSystem", { count: duplicateResults.length })}
                    </span>
                  )}
                  {noWebsiteCount > 0 && (
                    <span className="text-muted-foreground ml-2">
                      {t("prospecting.withoutSite", { count: noWebsiteCount })}
                    </span>
                  )}
                  {accumulatedResults.length > 20 && (
                    <span className="text-muted-foreground ml-2">
                      {t("prospecting.totalCount", { count: accumulatedResults.length })}
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
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("prospecting.importing")}</>
                ) : (
                  <><Download className="h-4 w-4" />{t("prospecting.importLeads", { count: selectedIds.size })}</>
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
                          {dupInfo.ownerName
                            ? t("prospecting.takenBy", { name: dupInfo.ownerName })
                            : dupInfo.emailSent
                            ? t("prospecting.mailSent")
                            : t("prospecting.alreadyExists")}
                        </Badge>
                      )}
                      {!place.website && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          {t("prospecting.noWebsiteBadge")}
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
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("prospecting.searchingMore")}</>
                ) : (
                  <><ChevronDown className="h-4 w-4" />{t("prospecting.loadMore")}</>
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {searchSource === "places" && submitted && !searchQuery.isFetching && filteredResults.length === 0 && !searchQuery.isError && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("prospecting.noResults")}</p>
        </div>
      )}

      {searchSource === "places" && !submitted && savedSearches.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium mb-1">{t("prospecting.emptyTitle")}</p>
          <p className="text-xs">{t("prospecting.emptyDesc")}</p>
        </div>
      )}

      {/* ── Register results ── */}
      {searchSource === "registry" && registrySearched && registryTotal > 0 && (
        <>
          <Card className="border-primary/20">
            <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allRegistrySelected}
                  onCheckedChange={toggleRegistrySelectAll}
                  disabled={registryDisplay.length === 0}
                />
                <div className="text-sm">
                  <strong>{registryTotal.toLocaleString()}</strong> {t("prospecting.regHits")}
                  {" · "}
                  {t("companyRegistry.selectedCount", { count: registrySelected.size })}
                </div>
              </div>
              <Button
                disabled={registrySelected.size === 0 || isRegistryImporting}
                onClick={handleRegistryImport}
                className="gap-1.5"
              >
                {isRegistryImporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />{t("prospecting.importing")}</>
                ) : (
                  <><Download className="h-4 w-4" />{t("prospecting.regImportSelected", { count: registrySelected.size })}</>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={allRegistrySelected}
                      onCheckedChange={toggleRegistrySelectAll}
                    />
                  </th>
                  <th className="px-3 py-2">{t("companyRegistry.colCompany")}</th>
                  <th className="px-3 py-2 hidden md:table-cell">{t("companyRegistry.colOrgNr")}</th>
                  <th className="px-3 py-2 hidden md:table-cell">{t("companyRegistry.colCity")}</th>
                  <th className="px-3 py-2 hidden lg:table-cell">{t("companyRegistry.colForm")}</th>
                  <th className="px-3 py-2 hidden md:table-cell">{t("companyRegistry.colRegDate")}</th>
                </tr>
              </thead>
              <tbody>
                {registryDisplay.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      {t("prospecting.regAllImported")}
                    </td>
                  </tr>
                ) : registryDisplay.map((row) => {
                  const selected = registrySelected.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b last:border-0 cursor-pointer transition-colors ${
                        selected ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                      onClick={() => toggleRegistrySelect(row.id)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleRegistrySelect(row.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{row.company_name}</td>
                      <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{row.org_number}</td>
                      <td className="px-3 py-2 hidden md:table-cell">{row.city || "—"}</td>
                      <td className="px-3 py-2 hidden lg:table-cell">{row.company_form || "—"}</td>
                      <td className="px-3 py-2 hidden md:table-cell">{row.registration_date || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t("prospecting.regPage", {
                page: registryPage + 1,
                pages: Math.max(1, Math.ceil(registryTotal / REGISTRY_PAGE_SIZE)),
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={registryPage === 0 || isRegistrySearching}
                onClick={() => runRegistrySearch(registryPage - 1)}
              >
                {t("prospecting.regPrev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(registryPage + 1) * REGISTRY_PAGE_SIZE >= registryTotal || isRegistrySearching}
                onClick={() => runRegistrySearch(registryPage + 1)}
              >
                {t("prospecting.regNext")}
              </Button>
            </div>
          </div>
        </>
      )}

      {searchSource === "registry" && registrySearched && !isRegistrySearching && registryTotal === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("prospecting.regNoResults")}</p>
        </div>
      )}

      {searchSource === "registry" && !registrySearched && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium mb-1">{t("prospecting.regEmptyTitle")}</p>
          <p className="text-xs">{t("prospecting.regEmptyDesc")}</p>
        </div>
      )}
    </div>
  );
}
