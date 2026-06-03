import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  MapPin,
  Loader2,
  Building2,
  Phone,
  Globe,
  Star,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Plus,
  CheckCircle2,
  History,
  X,
  RefreshCw,
  Trash2,
  Clock,
  Zap,
  Eye,
  MailCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useGooglePlacesCache } from "@/hooks/useGooglePlacesCache";
import { useMarket } from "@/hooks/useMarket";
import { PlaceWorkflowDialog } from "./PlaceWorkflowDialog";

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

interface GooglePlacesSearchProps {
  onLeadCreated: () => void;
}

// Analysis status tracking
interface AnalysisStatus {
  placeId: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  analysisId?: string;
  error?: string;
}

// Session storage key for persisting search state across navigation
const SESSION_KEY = "google_places_search_state";

interface PersistedState {
  keyword: string;
  location: string;
  results: PlaceResult[];
  addedPlaces: string[];
  analysisStatuses: Array<[string, AnalysisStatus]>;
  usedCache: boolean;
}

export function GooglePlacesSearch({ onLeadCreated }: GooglePlacesSearchProps) {
  // Load initial state from session storage
  const loadPersistedState = (): Partial<PersistedState> => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error loading persisted state:", e);
    }
    return {};
  };

  const persistedState = loadPersistedState();

  const [keyword, setKeyword] = useState(persistedState.keyword ?? "");
  const [location, setLocation] = useState(persistedState.location ?? "");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>(persistedState.results ?? []);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());
  const [addedPlaces, setAddedPlaces] = useState<Set<string>>(new Set(persistedState.addedPlaces ?? []));
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [usedCache, setUsedCache] = useState(persistedState.usedCache ?? false);
  
  // Pagination state
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Contacted indicator (avoid re-contacting same company)
  const [contactedPlaceIds, setContactedPlaceIds] = useState<Set<string>>(new Set());
  
  // Track inline analysis status per place
  const [analysisStatuses, setAnalysisStatuses] = useState<Map<string, AnalysisStatus>>(
    new Map(persistedState.analysisStatuses ?? [])
  );
  
  // Workflow dialog state
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selectedPlaceAnalysisId, setSelectedPlaceAnalysisId] = useState<string | undefined>();
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { market } = useMarket();
  
  // Use cache hook
  const { getCachedResults, cacheResults, getRecentSearches, clearCache, hasCachedSearches } = useGooglePlacesCache();

  // Persist state to session storage whenever key values change
  useEffect(() => {
    const stateToSave: PersistedState = {
      keyword,
      location,
      results,
      addedPlaces: Array.from(addedPlaces),
      analysisStatuses: Array.from(analysisStatuses.entries()),
      usedCache,
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.error("Error persisting state:", e);
    }
  }, [keyword, location, results, addedPlaces, analysisStatuses, usedCache]);

  const refreshContactedIndicators = async (places: PlaceResult[]) => {
    try {
      const placeIds = places.map((p) => p.placeId).filter(Boolean);
      if (placeIds.length === 0) {
        setContactedPlaceIds(new Set());
        return;
      }

      // 1) Map placeId -> leadId (only for leads created from google_places)
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("id, source_data")
        .eq("source", "google_places")
        // PostgREST supports json path filters with ->>
        .in("source_data->>place_id", placeIds);

      if (leadsError) throw leadsError;

      const leadIds = (leads || []).map((l) => l.id).filter(Boolean);
      if (leadIds.length === 0) {
        setContactedPlaceIds(new Set());
        return;
      }

      // 2) Any sent email for those leads => contacted
      const { data: sent, error: sentError } = await supabase
        .from("sent_emails")
        .select("lead_id")
        .in("lead_id", leadIds)
        .limit(1000);

      if (sentError) throw sentError;

      const contactedLeadIds = new Set((sent || []).map((s) => s.lead_id).filter(Boolean));
      const contactedPlaces = new Set<string>();

      for (const l of leads || []) {
        const pid = (l as any).source_data?.place_id as string | undefined;
        if (pid && contactedLeadIds.has(l.id)) contactedPlaces.add(pid);
      }

      setContactedPlaceIds(contactedPlaces);
    } catch (e) {
      console.error("Failed to load contacted indicators:", e);
      // Fail open: just hide indicators if query fails
      setContactedPlaceIds(new Set());
    }
  };

  useEffect(() => {
    // Keep badges up to date when results change (page 1 + appended pages)
    if (results.length === 0) return;
    void refreshContactedIndicators(results);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const handleSearch = async (searchKeyword?: string, searchLocation?: string, forceNew = false) => {
    const queryKeyword = searchKeyword ?? keyword;
    const queryLocation = searchLocation ?? location;
    
    if (!queryKeyword) {
      toast({ title: "Ange ett sökord", variant: "destructive" });
      return;
    }

    // Update inputs if using a recent search
    if (searchKeyword) setKeyword(searchKeyword);
    if (searchLocation !== undefined) setLocation(searchLocation);

    // Check cache first (unless forcing new search)
    if (!forceNew) {
      const cached = getCachedResults(queryKeyword, queryLocation);
      if (cached) {
        setResults(cached);
        setSelectedPlaces(new Set());
        setShowRecentSearches(false);
        setUsedCache(true);
        setNextPageToken(null); // Cache doesn't have pagination
        setCurrentPage(1);
        toast({ 
          title: `${cached.length} företag (från cache)`,
          description: "Klicka på 'Ny sökning' för att hämta nya resultat",
        });
        return;
      }
    }

    setIsSearching(true);
    setResults([]);
    setSelectedPlaces(new Set());
    setShowRecentSearches(false);
    setUsedCache(false);
    setNextPageToken(null);
    setCurrentPage(1);

    try {
      const { data, error } = await supabase.functions.invoke("google-places-search", {
        body: { query: queryKeyword, location: queryLocation, market },
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results);
        setNextPageToken(data.nextPageToken || null);
        // Cache the results
        cacheResults(queryKeyword, queryLocation, data.results);
        
        if (data.results.length === 0) {
          toast({ title: "Inga resultat", description: "Försök med andra söktermer" });
        } else {
          toast({ 
            title: `${data.results.length} företag hittade`,
            description: data.hasMore ? "Fler resultat finns - klicka 'Ladda fler'" : undefined,
          });
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Sökningen misslyckades",
        description: error instanceof Error ? error.message : "Ett fel uppstod",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Load more results using pagination token
  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const { data, error } = await supabase.functions.invoke("google-places-search", {
        body: { query: keyword, location, pageToken: nextPageToken, market },
      });

      if (error) throw error;

      if (data.success && data.results.length > 0) {
        // Append new results, avoiding duplicates
        setResults(prev => {
          const existingIds = new Set(prev.map(r => r.placeId));
          const newResults = data.results.filter((r: PlaceResult) => !existingIds.has(r.placeId));
          const merged = [...prev, ...newResults];
          // Update cache with merged results so going back to the same search still shows all loaded pages
          cacheResults(keyword, location, merged);
          return merged;
        });
        setNextPageToken(data.nextPageToken || null);
        setCurrentPage(prev => prev + 1);
        
        toast({ 
          title: `${data.results.length} fler företag laddade`,
          description: data.hasMore ? "Fler resultat finns" : "Inga fler resultat",
        });
      } else {
        setNextPageToken(null);
        toast({ title: "Inga fler resultat" });
      }
    } catch (error) {
      console.error("Load more error:", error);
      toast({
        title: "Kunde inte ladda fler",
        description: error instanceof Error ? error.message : "Ett fel uppstod",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleSelection = (placeId: string) => {
    const newSelection = new Set(selectedPlaces);
    if (newSelection.has(placeId)) {
      newSelection.delete(placeId);
    } else {
      newSelection.add(placeId);
    }
    setSelectedPlaces(newSelection);
  };

  const selectAll = () => {
    if (selectedPlaces.size === results.filter(r => !addedPlaces.has(r.placeId)).length) {
      setSelectedPlaces(new Set());
    } else {
      setSelectedPlaces(new Set(results.filter(r => !addedPlaces.has(r.placeId)).map(r => r.placeId)));
    }
  };

  const addSingleLead = async (place: PlaceResult) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Ej inloggad", variant: "destructive" });
        return null;
      }

      const { data, error } = await supabase
        .from("leads")
        .insert({
          company_name: place.name,
          phone: place.phone || null,
          website: place.website || null,
          source: "google_places",
          source_data: {
            place_id: place.placeId,
            address: place.address,
            rating: place.rating,
            user_ratings_total: place.userRatingsTotal,
            types: place.types,
          },
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error adding lead:", error);
      throw error;
    }
  };

  const handleAddSingle = async (place: PlaceResult) => {
    try {
      await addSingleLead(place);
      setAddedPlaces(prev => new Set(prev).add(place.placeId));
      toast({ title: `${place.name} tillagd som lead` });
      onLeadCreated();
    } catch (error) {
      toast({ 
        title: "Kunde inte lägga till lead", 
        variant: "destructive" 
      });
    }
  };

  const handleBulkAdd = async () => {
    if (selectedPlaces.size === 0) return;

    setIsBulkSaving(true);
    let successCount = 0;
    const newAddedPlaces = new Set(addedPlaces);

    for (const placeId of selectedPlaces) {
      const place = results.find(r => r.placeId === placeId);
      if (place) {
        try {
          await addSingleLead(place);
          newAddedPlaces.add(placeId);
          successCount++;
        } catch (error) {
          console.error(`Failed to add ${place.name}:`, error);
        }
      }
    }

    setAddedPlaces(newAddedPlaces);
    setSelectedPlaces(new Set());
    setShowBulkDialog(false);
    setIsBulkSaving(false);

    toast({
      title: `${successCount} leads tillagda`,
      description: successCount < selectedPlaces.size 
        ? `${selectedPlaces.size - successCount} kunde inte läggas till`
        : undefined,
    });
    onLeadCreated();
  };

  // Inline analysis - runs analysis without navigation
  const handleInlineAnalyze = async (place: PlaceResult) => {
    if (!place.website) {
      toast({ 
        title: "Ingen webbplats", 
        description: "Företaget har ingen webbplats att analysera",
        variant: "destructive" 
      });
      return;
    }

    // Update status to analyzing
    setAnalysisStatuses(prev => {
      const newMap = new Map(prev);
      newMap.set(place.placeId, { placeId: place.placeId, status: 'analyzing' });
      return newMap;
    });

    try {
      // First add as lead if not already added
      let leadId: string | undefined;
      if (!addedPlaces.has(place.placeId)) {
        const lead = await addSingleLead(place);
        if (lead) {
          leadId = lead.id;
          setAddedPlaces(prev => new Set(prev).add(place.placeId));
          onLeadCreated();
        }
      } else {
        // Find existing lead by website
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .ilike("website", `%${place.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}%`)
          .limit(1)
          .maybeSingle();
        
        leadId = existingLead?.id;
      }

      // Run the PageSpeed analysis
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke("pagespeed-analyze", {
        body: { url: place.website, strategy: "mobile" },
      });

      if (analysisError) throw analysisError;
      if (!analysisData.success) throw new Error(analysisData.error);

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");

      // Save analysis to database
      const { data: savedAnalysis, error: saveError } = await supabase
        .from("web_analyses")
        .insert({
          url: place.website,
          lead_id: leadId,
          analyzed_by: user.id,
          performance_score: analysisData.data.performance_score,
          accessibility_score: analysisData.data.accessibility_score,
          best_practices_score: analysisData.data.best_practices_score,
          seo_score: analysisData.data.seo_score,
          raw_data: analysisData.data,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      // Update status to done
      setAnalysisStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(place.placeId, { 
          placeId: place.placeId, 
          status: 'done',
          analysisId: savedAnalysis.id,
        });
        return newMap;
      });

      toast({ 
        title: "Analys klar",
        description: `${place.name} har analyserats`,
      });

    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysisStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(place.placeId, { 
          placeId: place.placeId, 
          status: 'error',
          error: error instanceof Error ? error.message : "Fel vid analys",
        });
        return newMap;
      });

      toast({
        title: "Analys misslyckades",
        description: error instanceof Error ? error.message : "Kunde inte analysera webbplatsen",
        variant: "destructive",
      });
    }
  };

  // Batch analyze all selected with websites
  const handleBatchAnalyze = async () => {
    const placesToAnalyze = results.filter(
      r => selectedPlaces.has(r.placeId) && r.website && analysisStatuses.get(r.placeId)?.status !== 'done'
    );

    if (placesToAnalyze.length === 0) {
      toast({ 
        title: "Inga att analysera", 
        description: "Välj företag med webbplatser",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: `Startar ${placesToAnalyze.length} analyser`,
      description: "Detta kan ta en stund...",
    });

    // Run analyses sequentially to avoid rate limits
    for (const place of placesToAnalyze) {
      await handleInlineAnalyze(place);
    }

    toast({
      title: "Batch-analys klar",
      description: `${placesToAnalyze.length} webbplatser analyserade`,
    });
  };

  const formatTypes = (types?: string[]) => {
    if (!types) return null;
    const readable: Record<string, string> = {
      restaurant: "Restaurang",
      cafe: "Café",
      store: "Butik",
      establishment: "Företag",
      point_of_interest: "Intressepunkt",
      food: "Mat",
      health: "Hälsa",
      lodging: "Boende",
      finance: "Finans",
      real_estate_agency: "Mäklare",
      lawyer: "Jurist",
      accounting: "Redovisning",
      insurance_agency: "Försäkring",
      car_dealer: "Bilhandlare",
      car_repair: "Bilverkstad",
      gym: "Gym",
      spa: "Spa",
      beauty_salon: "Skönhetssalong",
      hair_care: "Frisör",
      dentist: "Tandläkare",
      doctor: "Läkare",
      hospital: "Sjukhus",
      pharmacy: "Apotek",
      veterinary_care: "Veterinär",
      school: "Skola",
      university: "Universitet",
    };
    
    const filtered = types
      .filter(t => readable[t])
      .slice(0, 2)
      .map(t => readable[t]);
    
    return filtered.length > 0 ? filtered : null;
  };

  // Open workflow dialog for a place
  const openWorkflowDialog = (place: PlaceResult) => {
    const analysisStatus = analysisStatuses.get(place.placeId);
    setSelectedPlace(place);
    setSelectedPlaceAnalysisId(analysisStatus?.analysisId);
    setWorkflowDialogOpen(true);
  };

  // Handle when analysis completes from workflow dialog
  const handleWorkflowAnalysisComplete = (analysisId: string) => {
    if (selectedPlace) {
      setAnalysisStatuses(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedPlace.placeId, {
          placeId: selectedPlace.placeId,
          status: 'done',
          analysisId,
        });
        return newMap;
      });
    }
  };

  // Handle when lead is created from workflow dialog
  const handleWorkflowLeadCreated = () => {
    if (selectedPlace) {
      setAddedPlaces(prev => new Set(prev).add(selectedPlace.placeId));
    }
    onLeadCreated();
  };

  const recentSearches = getRecentSearches();
  const selectedWithWebsites = results.filter(r => selectedPlaces.has(r.placeId) && r.website).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Sök via Google Places
        </CardTitle>
        <CardDescription>
          Hitta företag baserat på bransch och geografiskt område
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Form */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="T.ex. 'restauranger', 'redovisningsbyrå', 'frisör'"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              onFocus={() => hasCachedSearches && setShowRecentSearches(true)}
            />
          </div>
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Stad eller område (t.ex. 'Stockholm')"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => handleSearch()} disabled={isSearching || !keyword} className="w-full sm:w-auto">
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Söker...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Sök
                </>
              )}
            </Button>
            {hasCachedSearches && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setShowRecentSearches(!showRecentSearches)}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Senaste sökningar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        {/* Recent Searches Dropdown */}
        {showRecentSearches && recentSearches.length > 0 && (
          <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Senaste sökningar (cache)
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={clearCache}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Rensa
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setShowRecentSearches(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((search, i) => (
                <Button
                  key={i}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleSearch(search.query, search.location)}
                  className="text-xs"
                >
                  {search.query}
                  {search.location && ` i ${search.location}`}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {search.resultCount}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            {/* Cache indicator and force refresh */}
            {usedCache && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Visar cachade resultat
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSearch(keyword, location, true)}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Ny sökning
                </Button>
              </div>
            )}
            
            {/* Bulk Actions */}
            <div className="flex items-center justify-between py-2 border-b flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedPlaces.size > 0 && selectedPlaces.size === results.filter(r => !addedPlaces.has(r.placeId)).length}
                  onCheckedChange={selectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedPlaces.size > 0 
                    ? `${selectedPlaces.size} valda`
                    : `${results.length} resultat (max 20 per sökning)`
                  }
                </span>
              </div>
              {selectedPlaces.size > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedWithWebsites > 0 && (
                    <Button size="sm" variant="secondary" onClick={handleBatchAnalyze}>
                      <Zap className="mr-2 h-4 w-4" />
                      Analysera {selectedWithWebsites} st
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setShowBulkDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Lägg till {selectedPlaces.size} leads
                  </Button>
                </div>
              )}
            </div>

            {/* Result List */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {results.map((place) => {
                  const isAdded = addedPlaces.has(place.placeId);
                  const isSelected = selectedPlaces.has(place.placeId);
                  const types = formatTypes(place.types);
                  const analysisStatus = analysisStatuses.get(place.placeId);
                  const isContacted = contactedPlaceIds.has(place.placeId);

                  return (
                    <div
                      key={place.placeId}
                      className={`p-4 rounded-lg border transition-colors ${
                        isAdded 
                          ? "bg-primary/5 border-primary/20" 
                          : isSelected 
                            ? "bg-accent border-accent-foreground/20" 
                            : "bg-card hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {!isAdded && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(place.placeId)}
                            className="mt-1"
                          />
                        )}
                        {isAdded && (
                          <CheckCircle2 className="h-5 w-5 text-primary mt-1 shrink-0" />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-medium truncate">{place.name}</h4>
                              <p className="text-sm text-muted-foreground truncate">
                                {place.address}
                              </p>
                            </div>
                            {place.rating && (
                              <div className="flex items-center gap-1 text-sm shrink-0">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                <span>{place.rating.toFixed(1)}</span>
                                {place.userRatingsTotal && (
                                  <span className="text-muted-foreground">
                                    ({place.userRatingsTotal})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {types && types.map((type, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                            {place.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {place.phone}
                              </span>
                            )}
                            {place.website && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                Webbplats
                              </span>
                            )}
                            {/* Analysis status badge */}
                            {analysisStatus?.status === 'done' && (
                              <Badge 
                                variant="default" 
                                className="text-xs cursor-pointer"
                                onClick={() => navigate(`/web-analysis?id=${analysisStatus.analysisId}`)}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Analyserad
                              </Badge>
                            )}
                            {analysisStatus?.status === 'error' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="destructive" className="text-xs">
                                      Fel
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{analysisStatus.error}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {/* Contacted badge (email sent) */}
                            {isContacted && (
                              <Badge variant="secondary" className="text-xs">
                                <MailCheck className="h-3 w-3 mr-1" />
                                Kontaktad
                              </Badge>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {/* Primary action: Open workflow dialog */}
                            <Button
                              size="sm"
                              onClick={() => openWorkflowDialog(place)}
                              className="gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              Öppna
                            </Button>
                            
                            {!isAdded && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSingle(place);
                                }}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Lägg till
                              </Button>
                            )}
                            {place.website && analysisStatus?.status !== 'done' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInlineAnalyze(place);
                                }}
                                disabled={analysisStatus?.status === 'analyzing'}
                              >
                                {analysisStatus?.status === 'analyzing' ? (
                                  <>
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    Analyserar...
                                  </>
                                ) : (
                                  <>
                                    <BarChart3 className="mr-1 h-3 w-3" />
                                    Analysera
                                  </>
                                )}
                              </Button>
                            )}
                            {analysisStatus?.status === 'done' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/web-analysis?id=${analysisStatus.analysisId}`);
                                }}
                              >
                                <ChevronRight className="mr-1 h-3 w-3" />
                                Visa analys
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Search refinement suggestions instead of pagination */}
                {results.length >= 15 && !usedCache && (
                  <div className="pt-4 pb-2 space-y-2">
                    <p className="text-xs text-muted-foreground text-center">
                      Google visar max 20 resultat. Förfina sökningen för fler:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {location && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLocation(`${location} Centrum`);
                              handleSearch(keyword, `${location} Centrum`, true);
                            }}
                          >
                            {location} Centrum
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLocation(`${location} Väster`);
                              handleSearch(keyword, `${location} Väster`, true);
                            }}
                          >
                            {location} Väster
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLocation(`${location} Öster`);
                              handleSearch(keyword, `${location} Öster`, true);
                            }}
                          >
                            {location} Öster
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Results summary */}
            <div className="text-xs text-muted-foreground text-center pt-2">
              Visar {results.length} resultat
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && results.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Sök efter företag med bransch och plats</p>
            <p className="text-sm mt-1">T.ex. "Redovisningsbyrå Stockholm"</p>
          </div>
        )}
      </CardContent>

      {/* Bulk Add Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lägg till {selectedPlaces.size} leads</DialogTitle>
            <DialogDescription>
              Följande företag kommer att läggas till som leads:
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <ul className="space-y-2">
              {results
                .filter(r => selectedPlaces.has(r.placeId))
                .map(place => (
                  <li key={place.placeId} className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{place.name}</span>
                    {place.website && (
                      <Badge variant="outline" className="text-xs">Webbplats</Badge>
                    )}
                  </li>
                ))}
            </ul>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleBulkAdd} disabled={isBulkSaving}>
              {isBulkSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lägger till...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Lägg till alla
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Dialog */}
      <PlaceWorkflowDialog
        open={workflowDialogOpen}
        onOpenChange={setWorkflowDialogOpen}
        place={selectedPlace}
        existingAnalysisId={selectedPlaceAnalysisId}
        onLeadCreated={handleWorkflowLeadCreated}
        onAnalysisComplete={handleWorkflowAnalysisComplete}
      />
    </Card>
  );
}
