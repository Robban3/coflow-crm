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
          title: "Data extraherad!",
          description: "Granska och komplettera informationen nedan",
        });
      } else {
        toast({
          title: "Kunde inte extrahera data",
          description: response.error || "Försök fylla i manuellt",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fel",
        description: "Ett oväntat fel uppstod",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.companyName) {
      toast({
        title: "Företagsnamn krävs",
        description: "Ange minst ett företagsnamn för att skapa lead",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({ title: "Ej inloggad", variant: "destructive" });
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
        title: "Lead skapad!",
        description: `${formData.companyName} har lagts till som lead`,
      });

      onLeadCreated(lead.id);
      onOpenChange(false);
      
      // Reset form
      setFormData({ companyName: "", contactName: "", email: "", phone: "", notes: "" });
      setExtractedData(null);

    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa lead",
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
            Skapa lead från analys
          </DialogTitle>
          <DialogDescription>
            Extrahera företagsdata automatiskt eller fyll i manuellt
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
                  Hämtar...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-3 w-3" />
                  Hämta data
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
                <Badge variant="outline">Org.nr: {extractedData.orgNumber}</Badge>
              )}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2">
                <Building2 className="h-3 w-3" />
                Företagsnamn *
              </Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Företagets namn"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactName" className="flex items-center gap-2">
                <User className="h-3 w-3" />
                Kontaktperson
              </Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder="Namn på kontaktperson"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  E-post
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@företag.se"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  Telefon
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="08-xxx xx xx"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Anteckningar
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ev. noteringar om företaget..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !formData.companyName}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sparar...
              </>
            ) : (
              "Skapa lead"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
