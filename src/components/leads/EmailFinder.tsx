import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Mail,
  User,
  Briefcase,
  Phone,
  CheckCircle2,
  AlertCircle,
  Dog,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMarket } from "@/hooks/useMarket";

interface EmailFinderProps {
  leadId: string;
  website: string | null;
  companyName: string | null;
  contactName: string | null;
  currentEmail: string | null;
  onEmailFound: (email: string) => void;
}

interface EnrichResult {
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_title: string | null;
  source_url: string | null;
}

export function EmailFinder({
  leadId,
  website,
  contactName,
  currentEmail,
  onEmailFound,
}: EmailFinderProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { market } = useMarket();

  const handleConfirmSearch = () => {
    if (!website) {
      toast({
        title: "Ingen webbplats",
        description: "Lägg till en webbplats för att söka kontaktuppgifter",
        variant: "destructive",
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleSearch = async () => {
    setShowConfirmDialog(false);
    setIsSearching(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("enrich-lead-contact", {
        body: { leadId, website_url: website, market },
      });

      if (error) throw error;
      if (!data?.success) {
        toast({
          title: "Sökning misslyckades",
          description: data?.error || "Kunde inte hämta kontaktuppgifter",
          variant: "destructive",
        });
        return;
      }

      const found: EnrichResult = data.found || {};
      setResult(found);
      setShowDialog(true);

      if (!found.email && !found.phone && !found.contact_name) {
        toast({
          title: "Inga kontaktuppgifter hittades",
          description: "Webbplatsen avslöjade inga e-post, telefon eller namn",
        });
      } else if (data.updated) {
        toast({ title: "Kontaktuppgifter uppdaterade på leadet" });
        if (found.email) onEmailFound(found.email);
      } else {
        toast({ title: "Kontaktuppgifter hittade" });
      }
    } catch (err) {
      console.error("Enrich error:", err);
      toast({
        title: "Fel",
        description: "Kunde inte hämta kontaktuppgifter",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!result?.email) return;
    setIsSaving(true);
    try {
      const updates: Record<string, string> = { email: result.email };
      if (result.contact_name && !contactName) updates.contact_name = result.contact_name;

      const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
      if (error) throw error;

      onEmailFound(result.email);
      setShowDialog(false);
      toast({
        title: "E-post sparad",
        description: `${result.email} har lagts till`,
      });
    } catch {
      toast({
        title: "Kunde inte spara",
        description: "Ett fel uppstod",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!website) return null;

  const WolfConfirmDialog = () => (
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Dog className="h-5 w-5" />
            Aooohh!
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you wanna let the dogs out?
            <span className="block text-xs text-muted-foreground mt-2">
              Berikningen skannar webbplatsen efter e-post, telefon och kontaktperson.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={handleSearch}>Sök</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const TriggerButton = (
    <Button
      variant={currentEmail ? "ghost" : "outline"}
      size="icon"
      className={currentEmail ? "h-8 w-8 text-muted-foreground hover:text-foreground" : "h-8 w-8"}
      onClick={handleConfirmSearch}
      disabled={isSearching}
    >
      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dog className="h-4 w-4" />}
    </Button>
  );

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{TriggerButton}</TooltipTrigger>
          <TooltipContent>
            {currentEmail ? "Sök fler kontaktuppgifter" : "Hitta kontaktuppgifter"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <WolfConfirmDialog />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Kontaktuppgifter
            </DialogTitle>
            <DialogDescription>
              Hämtade från webbplatsen via Firecrawl
            </DialogDescription>
          </DialogHeader>

          {!result || (!result.email && !result.phone && !result.contact_name) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Inga kontaktuppgifter hittades</p>
              <p className="text-sm mt-1">Lägg till manuellt om du vet dem</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.email && (
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-sm truncate">{result.email}</span>
                        <Badge variant="secondary" className="text-xs">Firecrawl</Badge>
                      </div>
                    </div>
                    {!currentEmail && (
                      <Button size="sm" onClick={handleSaveEmail} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Välj
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {result.contact_name && (
                <div className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{result.contact_name}</span>
                  </div>
                  {result.contact_title && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Briefcase className="h-3 w-3" />
                      {result.contact_title}
                    </div>
                  )}
                </div>
              )}

              {result.phone && (
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{result.phone}</span>
                  </div>
                </div>
              )}

              <Separator />

              {result.source_url && (
                <a
                  href={result.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  Källa: {new URL(result.source_url).hostname}
                </a>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <AlertCircle className="h-3 w-3" />
            Data extraherad från företagets webbplats med Firecrawl.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
