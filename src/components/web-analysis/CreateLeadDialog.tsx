import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Building2, User, Mail, Phone, Globe, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { firecrawlApi, ExtractedCompanyData } from "@/lib/api/firecrawl";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/LanguageProvider";

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  analysisId?: string;
  onLeadCreated: (leadId: string) => void;
}

export function CreateLeadDialog({ open, onOpenChange, url, analysisId, onLeadCreated }: CreateLeadDialogProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCompanyData | null>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    notes: "",
  });
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      const response = await firecrawlApi.extractCompanyData(url);
      
      if (response.success && response.data) {
        setExtractedData(response.data);
        setFormData({
          companyName: response.data.companyName || "",
          contactName: response.data.contactName || "",
          email: response.data.email || "",
          phone: response.data.phone || "",
          notes: response.data.description || "",
        });
        toast({
          title: t("webAnalysis.dataExtractedTitle"),
          description: t("webAnalysis.dataExtractedDesc"),
        });
      } else {
        toast({
          title: t("webAnalysis.couldNotExtractTitle"),
          description: response.error || t("webAnalysis.couldNotExtractDesc"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("webAnalysis.error"),
        description: t("webAnalysis.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.companyName) {
      toast({
        title: t("webAnalysis.companyNameRequiredTitle"),
        description: t("webAnalysis.companyNameRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({ title: t("webAnalysis.notLoggedIn"), variant: "destructive" });
        return;
      }

      // Create the lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          company_name: formData.companyName,
          contact_name: formData.contactName || null,
          email: formData.email || null,
          phone: formData.phone || null,
          website: url,
          source: 'web_analysis',
          source_data: extractedData ? { ...extractedData, notes: formData.notes } : { notes: formData.notes },
          created_by: user.id,
        })
        .select('id')
        .single();

      if (leadError) throw leadError;

      // Link the analysis to the lead if we have an analysis ID
      if (analysisId && lead) {
        await supabase
          .from('web_analyses')
          .update({ lead_id: lead.id })
          .eq('id', analysisId);
      }

      toast({
        title: t("webAnalysis.leadCreatedSimpleTitle"),
        description: t("webAnalysis.leadCreatedSimpleDesc", { company: formData.companyName }),
      });

      onLeadCreated(lead.id);
      onOpenChange(false);
      
      // Reset form
      setFormData({ companyName: "", contactName: "", email: "", phone: "", notes: "" });
      setExtractedData(null);

    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: t("webAnalysis.error"),
        description: t("webAnalysis.couldNotCreateLead"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {t("webAnalysis.createLeadFromAnalysis")}
          </DialogTitle>
          <DialogDescription>
            {t("webAnalysis.createLeadDialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* URL Display */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm truncate flex-1">{url}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExtract}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  {t("webAnalysis.fetching")}
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-3 w-3" />
                  {t("webAnalysis.fetchData")}
                </>
              )}
            </Button>
          </div>

          {extractedData && (
            <div className="flex flex-wrap gap-2">
              {extractedData.industry && (
                <Badge variant="secondary">{extractedData.industry}</Badge>
              )}
              {extractedData.orgNumber && (
                <Badge variant="outline">{t("webAnalysis.orgNumber", { value: extractedData.orgNumber })}</Badge>
              )}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                {t("webAnalysis.companyNameLabel")}
              </Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder={t("webAnalysis.companyNamePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactName" className="flex items-center gap-2">
                <User className="h-3 w-3" />
                {t("webAnalysis.contactPerson")}
              </Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder={t("webAnalysis.contactPersonPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  {t("webAnalysis.emailLabel")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={t("webAnalysis.emailPlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {t("webAnalysis.phoneLabel")}
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder={t("webAnalysis.phonePlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                {t("webAnalysis.notesLabel")}
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t("webAnalysis.notesPlaceholder")}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("webAnalysis.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.companyName}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("webAnalysis.saving")}
              </>
            ) : (
              t("webAnalysis.createLead")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
