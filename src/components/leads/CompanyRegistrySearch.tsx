import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Building2,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTIES, COMPANY_FORMS, INDUSTRIES } from "@/lib/swedishProspecting";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CompanyRegistryUpload } from "./CompanyRegistryUpload";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useTranslation } from "@/i18n/LanguageProvider";

interface CompanyRow {
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

const SESSION_KEY = "company_registry_search";

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(state: Record<string, any>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch { /* sessionStorage kan saknas/vara full – ignorera */ }
}

// Saved prospecting segments (persisted per-browser via localStorage).
const SEGMENTS_KEY = "company_registry_segments";

export interface SegmentFilters {
  searchQuery: string;
  cityFilter: string;
  postalCodeFilter: string;
  companyFormFilter: string;
  sniFilter: string;
  regDateFrom: string;
  regDateTo: string;
  regionFilter: string;
  youngerThan: string;
  olderThan: string;
}
interface SavedSegment { name: string; filters: SegmentFilters }

function loadSegments(): SavedSegment[] {
  try {
    const raw = localStorage.getItem(SEGMENTS_KEY);
    return raw ? (JSON.parse(raw) as SavedSegment[]) : [];
  } catch { return []; }
}
function persistSegments(list: SavedSegment[]) {
  try { localStorage.setItem(SEGMENTS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

const PAGE_SIZE = 50;

export function CompanyRegistrySearch({ onLeadCreated }: { onLeadCreated?: () => void }) {
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const numberLocale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "sv-SE";
  const { user, isAdmin } = useAuth();
  const organizationId = useOrganizationId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  const saved = useRef(loadSession()).current;

  const [searchQuery, setSearchQuery] = useState(saved?.searchQuery ?? "");
  const [cityFilter, setCityFilter] = useState(saved?.cityFilter ?? "");
  const [postalCodeFilter, setPostalCodeFilter] = useState(saved?.postalCodeFilter ?? "");
  const [companyFormFilter, setCompanyFormFilter] = useState(saved?.companyFormFilter ?? "");
  const [sniFilter, setSniFilter] = useState(saved?.sniFilter ?? "");
  const [regDateFrom, setRegDateFrom] = useState(saved?.regDateFrom ?? "");
  const [regDateTo, setRegDateTo] = useState(saved?.regDateTo ?? "");
  const [regionFilter, setRegionFilter] = useState<string>(saved?.regionFilter ?? "");
  const [youngerThan, setYoungerThan] = useState<string>(saved?.youngerThan ?? "");
  const [olderThan, setOlderThan] = useState<string>(saved?.olderThan ?? "");
  const [segments, setSegments] = useState<SavedSegment[]>(loadSegments);
  const [showFilters, setShowFilters] = useState(saved?.showFilters ?? false);
  const [sortField, setSortField] = useState<"company_name" | "registration_date">(saved?.sortField ?? "company_name");
  const [sortAsc, setSortAsc] = useState(saved?.sortAsc ?? true);

  const [results, setResults] = useState<CompanyRow[]>(saved?.results ?? []);
  const [totalCount, setTotalCount] = useState(saved?.totalCount ?? 0);
  const [page, setPage] = useState(saved?.page ?? 0);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(saved?.hasSearched ?? false);

  const [selected, setSelected] = useState<Set<string>>(new Set(saved?.selected ?? []));
  const [isImporting, setIsImporting] = useState(false);
  const [hideExistingLeads, setHideExistingLeads] = useState(saved?.hideExistingLeads ?? false);

  // Set of org_numbers that already exist as leads for this organization
  const [existingLeadOrgNumbers, setExistingLeadOrgNumbers] = useState<Set<string>>(new Set());

  // Fetch existing leads' org_numbers for this organization
  const fetchExistingLeads = useCallback(async () => {
    if (!organizationId) return;
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("org_number")
        .eq("organization_id", organizationId)
        .not("org_number", "is", null);
      if (!error && data) {
        setExistingLeadOrgNumbers(new Set(data.map((d) => d.org_number!).filter(Boolean)));
      }
    } catch { /* nätverksfel – behåll tom uppsättning */ }
  }, [organizationId]);

  useEffect(() => {
    fetchExistingLeads();
  }, [fetchExistingLeads]);

  // Filter results based on hideExistingLeads
  const displayResults = hideExistingLeads
    ? results.filter((r) => !existingLeadOrgNumbers.has(r.org_number))
    : results;

  // Save state to sessionStorage on changes
  useEffect(() => {
    saveSession({
      searchQuery, cityFilter, postalCodeFilter, companyFormFilter, sniFilter,
      regDateFrom, regDateTo, regionFilter, youngerThan, olderThan, showFilters, sortField, sortAsc,
      results, totalCount, page, hasSearched,
      selected: Array.from(selected),
      hideExistingLeads,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
    });
  }, [searchQuery, cityFilter, postalCodeFilter, companyFormFilter, sniFilter, regDateFrom, regDateTo, regionFilter, youngerThan, olderThan, showFilters, sortField, sortAsc, results, totalCount, page, hasSearched, selected, hideExistingLeads]);

  // Restore scroll position after mount
  useEffect(() => {
    if (!restoredRef.current && saved?.scrollTop && scrollRef.current) {
      scrollRef.current.scrollTop = saved.scrollTop;
      restoredRef.current = true;
    }
  }, [results]);

  const performSearch = useCallback(
    async (pageNum: number) => {
      setIsSearching(true);
      setHasSearched(true);

      try {
        let query = supabase
          .from("company_registry" as any)
          .select("*", { count: "exact" });

        if (searchQuery.trim()) {
          query = query.ilike("company_name", `%${searchQuery.trim()}%`);
        }
        if (cityFilter.trim()) {
          query = query.ilike("city", `%${cityFilter.trim()}%`);
        }
        if (postalCodeFilter.trim()) {
          query = query.ilike("postal_code", `${postalCodeFilter.trim()}%`);
        }
        if (companyFormFilter.trim()) {
          query = query.ilike("company_form", `%${companyFormFilter.trim()}%`);
        }
        if (sniFilter.trim()) {
          // Match SNI text (CSV imports) OR the business description (Bolagsverket).
          const term = sniFilter.trim().replace(/[%,()]/g, " ").trim();
          query = query.or(`sni_descriptions.ilike.%${term}%,business_description.ilike.%${term}%`);
        }
        if (regDateFrom.trim()) {
          query = query.gte("registration_date", regDateFrom.trim());
        }
        if (regDateTo.trim()) {
          query = query.lte("registration_date", regDateTo.trim());
        }
        if (regionFilter) {
          // County (län) derived from 2-digit postnummer prefixes.
          const prefixes = COUNTIES.find((c) => c.code === regionFilter)?.prefixes ?? [];
          if (prefixes.length) {
            query = query.or(prefixes.map((p) => `postal_code.like.${p}%`).join(","));
          }
        }
        // Company age: younger/older than N years -> registration_date bounds.
        const isoYearsAgo = (years: number) => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - years);
          return d.toISOString().slice(0, 10);
        };
        const younger = parseInt(youngerThan, 10);
        if (Number.isFinite(younger) && younger > 0) {
          query = query.gte("registration_date", isoYearsAgo(younger));
        }
        const older = parseInt(olderThan, 10);
        if (Number.isFinite(older) && older > 0) {
          query = query.lte("registration_date", isoYearsAgo(older));
        }

        const from = pageNum * PAGE_SIZE;
        query = query
          .order(sortField, { ascending: sortAsc })
          .range(from, from + PAGE_SIZE - 1);

        const { data, count, error } = await query;

        if (error) {
          console.error("Search error:", error);
          toast({
            title: t("companyRegistry.searchErrorTitle"),
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        setResults((data as unknown as CompanyRow[]) || []);
        setTotalCount(count || 0);
        setPage(pageNum);
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery, cityFilter, postalCodeFilter, companyFormFilter, sniFilter, regDateFrom, regDateTo, regionFilter, youngerThan, olderThan, sortField, sortAsc, toast, t]
  );

  const handleSearch = () => {
    setSelected(new Set());
    performSearch(0);
  };

  // Quick preset: companies registered within the last N months ("nystartade").
  // Bump a trigger so the search runs after the date state has updated (avoids
  // performSearch closing over stale filter values).
  const [autoSearch, setAutoSearch] = useState(0);
  useEffect(() => {
    if (autoSearch) performSearch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearch]);

  const applyNewlyStarted = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    setRegDateFrom(d.toISOString().slice(0, 10));
    setRegDateTo("");
    setShowFilters(true);
    setSelected(new Set());
    setAutoSearch((n) => n + 1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.id)));
    }
  };

  const handleImport = async () => {
    if (!organizationId || selected.size === 0) return;

    setIsImporting(true);
    try {
      const toImport = results.filter((r) => selected.has(r.id));

      const leads = toImport.map((c) => ({
        company_name: c.company_name,
        org_number: c.org_number,
        phone: c.phone || null,
        source: "company_registry",
        organization_id: organizationId,
        created_by: user?.id,
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
        },
      }));

      const { error } = await supabase.from("leads").insert(leads);

      if (error) throw error;

      toast({
        title: t("companyRegistry.importedTitle"),
        description: t("companyRegistry.importedDesc", { count: leads.length }),
      });

      setSelected(new Set());
      fetchExistingLeads();
      onLeadCreated?.();
    } catch (error: any) {
      toast({
        title: t("companyRegistry.importErrorTitle"),
        description: error.message || t("companyRegistry.importErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const clearFilters = () => {
    setCityFilter("");
    setPostalCodeFilter("");
    setCompanyFormFilter("");
    setSniFilter("");
    setRegDateFrom("");
    setRegDateTo("");
    setRegionFilter("");
    setYoungerThan("");
    setOlderThan("");
  };

  // ── Saved segments (filter combos) ───────────────────────────────────────
  const currentFilters = (): SegmentFilters => ({
    searchQuery, cityFilter, postalCodeFilter, companyFormFilter, sniFilter,
    regDateFrom, regDateTo, regionFilter, youngerThan, olderThan,
  });

  const saveSegment = () => {
    const name = window.prompt(t("companyRegistry.segmentNamePrompt"));
    if (!name?.trim()) return;
    const next = [
      ...segments.filter((s) => s.name !== name.trim()),
      { name: name.trim(), filters: currentFilters() },
    ];
    setSegments(next);
    persistSegments(next);
  };

  const applySegment = (seg: SavedSegment) => {
    const f = seg.filters;
    setSearchQuery(f.searchQuery ?? "");
    setCityFilter(f.cityFilter ?? "");
    setPostalCodeFilter(f.postalCodeFilter ?? "");
    setCompanyFormFilter(f.companyFormFilter ?? "");
    setSniFilter(f.sniFilter ?? "");
    setRegDateFrom(f.regDateFrom ?? "");
    setRegDateTo(f.regDateTo ?? "");
    setRegionFilter(f.regionFilter ?? "");
    setYoungerThan(f.youngerThan ?? "");
    setOlderThan(f.olderThan ?? "");
    setShowFilters(true);
    setSelected(new Set());
    setAutoSearch((n) => n + 1);
  };

  const deleteSegment = (name: string) => {
    const next = segments.filter((s) => s.name !== name);
    setSegments(next);
    persistSegments(next);
  };

  const toggleSort = (field: "company_name" | "registration_date") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "company_name");
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasActiveFilters = cityFilter || postalCodeFilter || companyFormFilter || sniFilter || regDateFrom || regDateTo || regionFilter || youngerThan || olderThan;

  return (
    <div className="space-y-4" ref={scrollRef}>
      {isAdmin && <CompanyRegistryUpload />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            {t("companyRegistry.searchTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search bar */}
          <div className="flex gap-2">
            <Input
              placeholder={t("companyRegistry.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">{t("companyRegistry.search")}</span>
            </Button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-muted/50 rounded-lg">
              <Input
                placeholder={t("companyRegistry.filterCity")}
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Input
                placeholder={t("companyRegistry.filterPostal")}
                value={postalCodeFilter}
                onChange={(e) => setPostalCodeFilter(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Select value={regionFilter || "__all__"} onValueChange={(v) => setRegionFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={t("companyRegistry.filterCounty")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("companyRegistry.filterCountyAll")}</SelectItem>
                  {COUNTIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={companyFormFilter || "__all__"} onValueChange={(v) => setCompanyFormFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={t("companyRegistry.filterForm")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t("companyRegistry.filterFormAll")}</SelectItem>
                  {COMPANY_FORMS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={INDUSTRIES.some((i) => i.value === sniFilter) ? sniFilter : "__all__"}
                onValueChange={(v) => setSniFilter(v === "__all__" ? "" : v)}
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
                placeholder={t("companyRegistry.filterSni")}
                value={sniFilter}
                onChange={(e) => setSniFilter(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Input
                type="date"
                placeholder={t("companyRegistry.filterRegFrom")}
                title={t("companyRegistry.filterRegFrom")}
                value={regDateFrom}
                onChange={(e) => setRegDateFrom(e.target.value)}
              />
              <Input
                type="date"
                placeholder={t("companyRegistry.filterRegTo")}
                title={t("companyRegistry.filterRegTo")}
                value={regDateTo}
                onChange={(e) => setRegDateTo(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                placeholder={t("companyRegistry.filterYoungerThan")}
                title={t("companyRegistry.filterYoungerThan")}
                value={youngerThan}
                onChange={(e) => setYoungerThan(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Input
                type="number"
                min={0}
                placeholder={t("companyRegistry.filterOlderThan")}
                title={t("companyRegistry.filterOlderThan")}
                value={olderThan}
                onChange={(e) => setOlderThan(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="col-span-2 md:col-span-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{t("companyRegistry.newlyStarted")}:</span>
                {[3, 6, 12].map((m) => (
                  <Button key={m} variant="outline" size="sm" className="h-7" onClick={() => applyNewlyStarted(m)}>
                    {t("companyRegistry.lastMonths", { months: m })}
                  </Button>
                ))}
              </div>
              {segments.length > 0 && (
                <div className="col-span-2 md:col-span-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t("companyRegistry.savedSegments")}:</span>
                  {segments.map((s) => (
                    <Badge
                      key={s.name}
                      variant="secondary"
                      className="gap-1 cursor-pointer"
                      onClick={() => applySegment(s)}
                    >
                      {s.name}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSegment(s.name); }}
                        className="hover:text-destructive"
                        title={t("companyRegistry.deleteSegment")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="col-span-2 md:col-span-4 flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7" onClick={saveSegment} disabled={!hasActiveFilters && !searchQuery}>
                  {t("companyRegistry.saveSegment")}
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-7" onClick={clearFilters}>
                    <X className="h-3 w-3 mr-1" /> {t("companyRegistry.clearFilters")}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Import bar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="text-sm font-medium">
                {t("companyRegistry.selectedCount", { count: selected.size })}
              </span>
              <Button onClick={handleImport} disabled={isImporting} size="sm">
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {t("companyRegistry.importAsLeads")}
              </Button>
            </div>
          )}

          {/* Results table */}
          {hasSearched && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("companyRegistry.hitsCount", { count: totalCount.toLocaleString(numberLocale) })}
                  {hideExistingLeads && displayResults.length < results.length && (
                    <span className="ml-1">{t("companyRegistry.hiddenCount", { count: results.length - displayResults.length })}</span>
                  )}
                </span>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={hideExistingLeads}
                    onCheckedChange={setHideExistingLeads}
                  />
                  <span className="text-muted-foreground">{t("companyRegistry.hideExisting")}</span>
                </label>
              </div>

              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={results.length > 0 && selected.size === results.length}
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { toggleSort("company_name"); performSearch(0); }}>
                          {t("companyRegistry.colCompany")}
                          {sortField === "company_name" ? (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </TableHead>
                      <TableHead className="hidden md:table-cell">{t("companyRegistry.colOrgNr")}</TableHead>
                      <TableHead className="hidden md:table-cell">
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => { toggleSort("registration_date"); performSearch(0); }}>
                          {t("companyRegistry.colRegDate")}
                          {sortField === "registration_date" ? (sortAsc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </TableHead>
                      <TableHead className="hidden md:table-cell">{t("companyRegistry.colCity")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("companyRegistry.colForm")}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t("companyRegistry.colSni")}</TableHead>
                      <TableHead className="hidden xl:table-cell">{t("companyRegistry.colPhone")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayResults.map((row) => {
                      const isExistingLead = existingLeadOrgNumbers.has(row.org_number);
                      return (
                        <TableRow
                          key={row.id}
                          className={`cursor-pointer ${isExistingLead ? "opacity-60" : ""}`}
                          onClick={() => toggleSelect(row.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(row.id)}
                              onCheckedChange={() => toggleSelect(row.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {row.company_name}
                              {isExistingLead && (
                                <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {t("companyRegistry.leadBadge")}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {row.org_number}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{row.registration_date || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell">{row.city || "—"}</TableCell>
                          <TableCell className="hidden lg:table-cell">{row.company_form || "—"}</TableCell>
                          <TableCell className="hidden lg:table-cell max-w-[200px] truncate">
                            {row.sni_descriptions || "—"}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">{row.phone || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                    {displayResults.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {hideExistingLeads && results.length > 0
                            ? t("companyRegistry.allAlreadyLeads")
                            : t("companyRegistry.noResults")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("companyRegistry.pageOf", { page: page + 1, total: totalPages })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0 || isSearching}
                      onClick={() => performSearch(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1 || isSearching}
                      onClick={() => performSearch(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
