import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMarket } from "@/hooks/useMarket";
import { useTranslation } from "@/i18n/LanguageProvider";

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
  const { t } = useTranslation();
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
        if (found.phone) parts.push(t("leadDetail.el_partPhone"));
        if (found.email) parts.push(t("leadDetail.el_partEmail"));
        if (found.contact_name) parts.push(t("leadDetail.el_partContact"));

        toast({
          title: t("leadDetail.el_doneTitle"),
          description: parts.length
            ? `${t("leadDetail.el_foundDesc", { parts: parts.join(", ") })}${found.source_url ? ` (${new URL(found.source_url).hostname})` : ""}`
            : t("leadDetail.el_leadUpdated"),
        });
        onEnriched?.();
      } else {
        toast({
          title: t("leadDetail.el_noNewDataTitle"),
          description: t("leadDetail.el_noNewDataDesc"),
        });
      }
    } catch (error: any) {
      toast({
        title: t("leadDetail.el_errorTitle"),
        description: error.message || t("leadDetail.el_couldNotEnrich"),
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
      {t("leadDetail.el_button")}
    </Button>
  );
}
