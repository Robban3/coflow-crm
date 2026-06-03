import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMarket } from "@/hooks/useMarket";

interface EnrichLeadButtonProps {
  leadId: string;
  companyName: string | null;
  orgNumber: string | null;
  website?: string | null;
  onEnriched?: () => void;
}

export function EnrichLeadButton({ leadId, companyName, orgNumber, website, onEnriched }: EnrichLeadButtonProps) {
  const { toast } = useToast();
  const { market } = useMarket();
  const [isEnriching, setIsEnriching] = useState(false);

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-lead-contact", {
        body: { leadId, companyName, orgNumber, website_url: website, market },
      });

      if (error) throw error;

      if (data?.updated) {
        const found = data.found || {};
        const parts: string[] = [];
        if (found.phone) parts.push("telefon");
        if (found.email) parts.push("e-post");
        if (found.contact_name) parts.push("kontaktperson");

        toast({
          title: "Berikning klar!",
          description: parts.length
            ? `Hittade: ${parts.join(", ")}${found.source_url ? ` (${new URL(found.source_url).hostname})` : ""}`
            : "Lead uppdaterat",
        });
        onEnriched?.();
      } else {
        toast({
          title: "Ingen ny data hittades",
          description: "Kunde inte hitta kontaktuppgifter på webbplatsen",
        });
      }
    } catch (error: any) {
      toast({
        title: "Berikningsfel",
        description: error.message || "Kunde inte berika lead",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <Button onClick={handleEnrich} disabled={isEnriching} variant="outline" size="sm">
      {isEnriching ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4 mr-2" />
      )}
      Berika kontaktinfo
    </Button>
  );
}
