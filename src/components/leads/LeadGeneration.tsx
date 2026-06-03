import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Globe, 
  Zap, 
  Loader2, 
  Building2,
  User,
  Mail,
  Phone,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { firecrawlApi } from "@/lib/api/firecrawl";
import { GooglePlacesSearch } from "./GooglePlacesSearch";

interface LeadGenerationProps {
  onLeadCreated: () => void;
}

export function LeadGeneration({ onLeadCreated }: LeadGenerationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleExtractFromUrl = async () => {
    if (!searchQuery) return;

    setIsExtracting(true);
    try {
      const response = await firecrawlApi.extractCompanyData(searchQuery);

      if (response.success && response.data) {
        setFormData({
          companyName: response.data.companyName || "",
          contactName: response.data.contactName || "",
          email: response.data.email || "",
          phone: response.data.phone || "",
          website: searchQuery,
        });
        setShowAddDialog(true);
        toast({
          title: "Data extraherad!",
          description: "Granska och komplettera informationen",
        });
      } else {
        toast({
          title: "Kunde inte extrahera data",
          description: response.error || "Försök lägga till manuellt",
          variant: "destructive",
        });
        setFormData(prev => ({ ...prev, website: searchQuery }));
        setShowAddDialog(true);
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

  const handleSaveLead = async () => {
    if (!formData.companyName) {
      toast({
        title: "Företagsnamn krävs",
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

      const { error } = await supabase
        .from('leads')
        .insert({
          company_name: formData.companyName,
          contact_name: formData.contactName || null,
          email: formData.email || null,
          phone: formData.phone || null,
          website: formData.website || null,
          source: 'manual',
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Lead skapad!",
        description: `${formData.companyName} har lagts till`,
      });

      setShowAddDialog(false);
      setFormData({ companyName: "", contactName: "", email: "", phone: "", website: "" });
      setSearchQuery("");
      onLeadCreated();

    } catch (error) {
      console.error('Error saving lead:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara lead",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openManualDialog = () => {
    setFormData({ companyName: "", contactName: "", email: "", phone: "", website: "" });
    setShowAddDialog(true);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Hitta nya leads</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Sök efter företag via Google Places eller extrahera data från webbplatser
          </p>
        </div>
        <Button onClick={openManualDialog} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Lägg till manuellt
        </Button>
      </div>

      {/* Google Places Search */}
      <GooglePlacesSearch onLeadCreated={onLeadCreated} />

      {/* URL Extraction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Sök via URL
          </CardTitle>
          <CardDescription>
            Extrahera kontaktuppgifter och företagsinformation från webbplatser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="https://exempel.se"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === 'Enter' && handleExtractFromUrl()}
              />
            </div>
            <Button onClick={handleExtractFromUrl} disabled={isExtracting || !searchQuery} className="w-full sm:w-auto">
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Extraherar...</span>
                  <span className="sm:hidden">Laddar...</span>
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Extrahera info</span>
                  <span className="sm:hidden">Extrahera</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Lead Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {formData.website ? "Granska extraherad data" : "Lägg till lead"}
            </DialogTitle>
            <DialogDescription>
              {formData.website 
                ? "Granska och komplettera informationen nedan"
                : "Fyll i information om den nya leaden"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="h-3 w-3" />
                Webbplats
              </Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://företag.se"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSaveLead} disabled={isSaving || !formData.companyName}>
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
    </div>
  );
}
