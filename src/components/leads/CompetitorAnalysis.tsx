import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Trash2, 
  ExternalLink, 
  BarChart3, 
  Loader2,
  Globe,
  MapPin,
  Star,
  Zap
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Competitor {
  id: string;
  competitor_name: string;
  competitor_url: string;
  web_analysis_id: string | null;
  source: string;
  added_at: string;
}

interface CompetitorWithAnalysis extends Competitor {
  analysis?: {
    performance_score: number | null;
    seo_score: number | null;
    accessibility_score: number | null;
    best_practices_score: number | null;
  } | null;
}

interface AutoFoundCompetitor {
  name: string;
  address: string;
  website?: string;
  rating?: number;
  placeId: string;
}

interface CompetitorAnalysisProps {
  leadId: string;
  leadWebsite: string | null;
  leadCompanyName: string | null;
}

export function CompetitorAnalysis({ leadId, leadWebsite, leadCompanyName }: CompetitorAnalysisProps) {
  const organizationId = useOrganizationId();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const [competitors, setCompetitors] = useState<CompetitorWithAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAutoDialog, setShowAutoDialog] = useState(false);
  
  const [manualForm, setManualForm] = useState({ name: '', url: '' });
  const [autoSearchQuery, setAutoSearchQuery] = useState('');
  const [autoSearchLocation, setAutoSearchLocation] = useState('');
  const [autoResults, setAutoResults] = useState<AutoFoundCompetitor[]>([]);
  const [selectedAuto, setSelectedAuto] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCompetitors();
  }, [leadId]);

  const fetchCompetitors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('lead_competitors')
        .select(`
          *,
          web_analyses:web_analysis_id (
            performance_score,
            seo_score,
            accessibility_score,
            best_practices_score
          )
        `)
        .eq('lead_id', leadId)
        .order('added_at', { ascending: false });

      if (error) throw error;

      setCompetitors((data || []).map(c => ({
        ...c,
        analysis: c.web_analyses,
      })));
    } catch (error) {
      console.error('Error fetching competitors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddManual = async () => {
    if (!manualForm.name || !manualForm.url || !organizationId) return;

    setIsAddingManual(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('lead_competitors').insert({
        lead_id: leadId,
        organization_id: organizationId,
        competitor_name: manualForm.name,
        competitor_url: manualForm.url.startsWith('http') ? manualForm.url : `https://${manualForm.url}`,
        source: 'manual',
        added_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: t("leadDetail.co_competitorAddedTitle"),
        description: t("leadDetail.co_competitorAddedDesc", { name: manualForm.name }),
      });

      setShowAddDialog(false);
      setManualForm({ name: '', url: '' });
      fetchCompetitors();
    } catch (error) {
      toast({
        title: t("leadDetail.co_errorTitle"),
        description: t("leadDetail.co_addCompetitorError"),
        variant: "destructive",
      });
    } finally {
      setIsAddingManual(false);
    }
  };

  const handleAutoSearch = async () => {
    if (!autoSearchQuery) return;

    setIsSearching(true);
    setAutoResults([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('find-competitors', {
        body: {
          query: autoSearchQuery,
          location: autoSearchLocation || undefined,
          excludeUrl: leadWebsite || undefined,
          limit: 10,
        },
      });

      if (error) throw error;

      setAutoResults(data.competitors || []);
      
      if (data.competitors?.length === 0) {
        toast({
          title: t("leadDetail.co_noResultsTitle"),
          description: t("leadDetail.co_noResultsDesc"),
        });
      }
    } catch (error) {
      console.error('Error searching competitors:', error);
      toast({
        title: t("leadDetail.co_searchErrorTitle"),
        description: t("leadDetail.co_searchErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSelected = async () => {
    if (selectedAuto.size === 0 || !organizationId) return;

    setIsAddingManual(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const toAdd = autoResults
        .filter(r => selectedAuto.has(r.placeId) && r.website)
        .map(r => ({
          lead_id: leadId,
          organization_id: organizationId,
          competitor_name: r.name,
          competitor_url: r.website!,
          source: 'auto',
          added_by: user?.id,
        }));

      if (toAdd.length === 0) {
        toast({
          title: t("leadDetail.co_noWebsiteTitle"),
          description: t("leadDetail.co_noWebsiteDesc"),
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from('lead_competitors').insert(toAdd);

      if (error) throw error;

      toast({
        title: t("leadDetail.co_competitorsAddedTitle"),
        description: t("leadDetail.co_competitorsAddedDesc", { count: toAdd.length }),
      });

      setShowAutoDialog(false);
      setAutoResults([]);
      setSelectedAuto(new Set());
      fetchCompetitors();
    } catch (error) {
      toast({
        title: t("leadDetail.co_errorTitle"),
        description: t("leadDetail.co_addCompetitorsError"),
        variant: "destructive",
      });
    } finally {
      setIsAddingManual(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('lead_competitors').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: t("leadDetail.co_deletedTitle"),
        description: t("leadDetail.co_deletedDesc"),
      });
      
      fetchCompetitors();
    } catch (error) {
      toast({
        title: t("leadDetail.co_errorTitle"),
        description: t("leadDetail.co_deleteCompetitorError"),
        variant: "destructive",
      });
    }
  };

  const handleAnalyzeCompetitor = (competitor: CompetitorWithAnalysis) => {
    navigate(`/web-analysis?url=${encodeURIComponent(competitor.competitor_url)}&competitorId=${competitor.id}`);
  };

  const toggleAutoSelect = (placeId: string) => {
    const next = new Set(selectedAuto);
    if (next.has(placeId)) {
      next.delete(placeId);
    } else {
      next.add(placeId);
    }
    setSelectedAuto(next);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 90) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getAvgScore = (analysis: CompetitorWithAnalysis['analysis']) => {
    if (!analysis) return null;
    const scores = [
      analysis.performance_score,
      analysis.seo_score,
      analysis.accessibility_score,
      analysis.best_practices_score,
    ].filter(s => s !== null) as number[];
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("leadDetail.co_addManually")}
        </Button>
        <Button size="sm" onClick={() => {
          setAutoSearchQuery(leadCompanyName ? t("leadDetail.co_defaultSearchQuery", { name: leadCompanyName }) : '');
          setShowAutoDialog(true);
        }}>
          <Zap className="mr-2 h-4 w-4" />
          {t("leadDetail.co_findAutomatically")}
        </Button>
      </div>

      {/* Competitors list */}
      {competitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {t("leadDetail.co_emptyTitle")}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t("leadDetail.co_emptyDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((competitor) => {
            const avgScore = getAvgScore(competitor.analysis);
            
            return (
              <Card key={competitor.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{competitor.competitor_name}</h4>
                        <Badge variant={competitor.source === 'auto' ? 'secondary' : 'outline'} className="text-[10px] shrink-0">
                          {competitor.source === 'auto' ? t("leadDetail.co_sourceAuto") : t("leadDetail.co_sourceManual")}
                        </Badge>
                      </div>
                      <a 
                        href={competitor.competitor_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3" />
                        {competitor.competitor_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      
                      {competitor.analysis && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="outline" className={`text-[10px] ${getScoreColor(competitor.analysis.performance_score)}`}>
                            {t("leadDetail.co_badgePerformance", { score: competitor.analysis.performance_score ?? '-' })}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${getScoreColor(competitor.analysis.seo_score)}`}>
                            {t("leadDetail.co_badgeSeo", { score: competitor.analysis.seo_score ?? '-' })}
                          </Badge>
                          {avgScore !== null && (
                            <Badge variant="secondary" className={`text-[10px] ${getScoreColor(avgScore)}`}>
                              {t("leadDetail.co_badgeAverage", { score: avgScore })}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleAnalyzeCompetitor(competitor)}
                        title={t("leadDetail.pw_actionAnalyzeTitle")}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDelete(competitor.id)}
                        className="text-destructive hover:text-destructive"
                        title={t("leadDetail.co2_remove")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Manual add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leadDetail.co2_addCompetitor")}</DialogTitle>
            <DialogDescription>{t("leadDetail.co2_addManualDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("leadDetail.co2_companyName")}</label>
              <Input
                placeholder={t("leadDetail.co_namePlaceholder")}
                value={manualForm.name}
                onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("leadDetail.pw_badgeWebsite")}</label>
              <Input
                placeholder={t("leadDetail.co_urlPlaceholder")}
                value={manualForm.url}
                onChange={(e) => setManualForm(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>{t("leadDetail.ef_cancel")}</Button>
            <Button 
              onClick={handleAddManual} 
              disabled={!manualForm.name || !manualForm.url || isAddingManual}
            >
              {isAddingManual && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("leadDetail.co_addBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto search dialog */}
      <Dialog open={showAutoDialog} onOpenChange={setShowAutoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("leadDetail.co2_findAuto")}</DialogTitle>
            <DialogDescription>{t("leadDetail.co2_searchDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("leadDetail.co2_searchPhrase")}</label>
              <Input
                placeholder={t("leadDetail.co2_searchPlaceholder")}
                value={autoSearchQuery}
                onChange={(e) => setAutoSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("leadDetail.co_locationLabel")}</label>
              <Input
                placeholder={t("leadDetail.co_locationPlaceholder")}
                value={autoSearchLocation}
                onChange={(e) => setAutoSearchLocation(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAutoSearch} 
              disabled={!autoSearchQuery || isSearching}
              className="w-full"
            >
              {isSearching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              {t("leadDetail.ef_search")}
            </Button>

            {/* Results */}
            {autoResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm text-muted-foreground">{t("leadDetail.co2_selectToAdd")}</p>
                {autoResults.map((result) => (
                  <div 
                    key={result.placeId}
                    onClick={() => result.website && toggleAutoSelect(result.placeId)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAuto.has(result.placeId) 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    } ${!result.website ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedAuto.has(result.placeId)}
                        onChange={() => {}}
                        disabled={!result.website}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{result.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {result.address}
                        </p>
                        {result.website ? (
                          <p className="text-xs text-primary truncate">{result.website}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">{t("leadDetail.co_noWebsiteTitle")}</p>
                        )}
                        {result.rating && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {result.rating}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoDialog(false)}>{t("leadDetail.ef_cancel")}</Button>
            {autoResults.length > 0 && (
              <Button 
                onClick={handleAddSelected} 
                disabled={selectedAuto.size === 0 || isAddingManual}
              >
                {isAddingManual && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("leadDetail.co_addSelectedCount", { count: selectedAuto.size })}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
