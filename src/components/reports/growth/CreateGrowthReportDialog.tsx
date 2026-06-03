import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, BarChart3, Eye, Search, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildGrowthReportSnapshot, type ModuleSelection } from "./buildGrowthReport";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    company_name: string | null;
    website: string | null;
    organization_id?: string | null;
  };
}

export function CreateGrowthReportDialog({ open, onOpenChange, lead }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [modules, setModules] = useState<ModuleSelection>({ web: true, geo: true, seo: true });
  const [available, setAvailable] = useState<ModuleSelection>({ web: false, geo: false, seo: false });
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check which modules have data when dialog opens
  useEffect(() => {
    if (!open || !lead.id) return;
    setChecking(true);
    Promise.all([
      supabase.from("web_analyses").select("id").eq("lead_id", lead.id).limit(1).maybeSingle(),
      supabase.from("geo_analyses").select("id").eq("lead_id", lead.id).eq("status", "completed").limit(1).maybeSingle(),
      supabase.from("seo_analyses").select("id").eq("lead_id", lead.id).limit(1).maybeSingle(),
    ]).then(([webRes, geoRes, seoRes]) => {
      const avail = { web: !!webRes.data, geo: !!geoRes.data, seo: !!seoRes.data };
      setAvailable(avail);
      setModules({ web: avail.web, geo: avail.geo, seo: avail.seo });
      setChecking(false);
    });
  }, [open, lead.id]);

  const anySelected = modules.web || modules.geo || modules.seo;

  const handleCreate = async () => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      const orgId = profile?.organization_id || null;

      const snapshot = await buildGrowthReportSnapshot(
        { ...lead, organization_id: orgId },
        modules
      );

      const { data: report, error } = await supabase
        .from("reports")
        .insert({
          title: `Tillväxtrapport – ${lead.company_name || "Okänt företag"}`,
          report_type: "complete_growth_report",
          lead_id: lead.id,
          organization_id: orgId,
          created_by: user.id,
          data: snapshot as any,
          source_refs: { included_modules: snapshot.included_modules },
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({ title: "Rapport skapad!", description: "Rapporten har genererats som en snapshot." });
      onOpenChange(false);
      navigate(`/reports/${report.id}`);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Fel",
        description: err.message || "Kunde inte skapa rapporten",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa komplett rapport</DialogTitle>
          <DialogDescription>
            Sammanställer befintlig analysdata till en kundredo rapport.
            Ingen ny analys körs — endast existerande data används.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {lead.company_name || "Okänt företag"}
          </p>
          {checking ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Kontrollerar tillgänglig data…
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Välj vilka analyser som ska inkluderas:</p>
              <label className={`flex items-center gap-2 text-sm ${!available.web ? 'opacity-50' : ''}`}>
                <Checkbox
                  checked={modules.web}
                  onCheckedChange={(v) => setModules((m) => ({ ...m, web: !!v }))}
                  disabled={!available.web}
                />
                <BarChart3 className="h-3.5 w-3.5" /> Webbanalys
                {!available.web && <span className="text-xs text-muted-foreground">(ingen data)</span>}
              </label>
              <label className={`flex items-center gap-2 text-sm ${!available.geo ? 'opacity-50' : ''}`}>
                <Checkbox
                  checked={modules.geo}
                  onCheckedChange={(v) => setModules((m) => ({ ...m, geo: !!v }))}
                  disabled={!available.geo}
                />
                <Eye className="h-3.5 w-3.5" /> GEO / AI-synlighet
                {!available.geo && <span className="text-xs text-muted-foreground">(ingen data)</span>}
              </label>
              <label className={`flex items-center gap-2 text-sm ${!available.seo ? 'opacity-50' : ''}`}>
                <Checkbox
                  checked={modules.seo}
                  onCheckedChange={(v) => setModules((m) => ({ ...m, seo: !!v }))}
                  disabled={!available.seo}
                />
                <Search className="h-3.5 w-3.5" /> SEO Intelligence
                {!available.seo && <span className="text-xs text-muted-foreground">(ingen data)</span>}
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreate} disabled={isGenerating || !anySelected}>
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Genererar...</>
            ) : (
              <><FileText className="mr-2 h-4 w-4" />Skapa rapport</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
