import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Mail, Phone, ExternalLink, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { webAnalysisApi } from "@/lib/api/webAnalysis";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Lead {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
}

interface LinkedLeadInfoProps {
  leadId?: string | null;
  url?: string;
}

export function LinkedLeadInfo({ leadId, url }: LinkedLeadInfoProps) {
  const { t } = useTranslation();
  const [lead, setLead] = useState<Lead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLead = async () => {
      setIsLoading(true);
      
      // First try by leadId if provided
      if (leadId) {
        const { data, error } = await supabase
          .from('leads')
          .select('id, company_name, contact_name, email, phone')
          .eq('id', leadId)
          .maybeSingle();

        if (!error && data) {
          setLead(data);
          setIsLoading(false);
          return;
        }
      }
      
      // Fall back to URL matching if no leadId or not found
      if (url) {
        const matchedLead = await webAnalysisApi.findLeadByUrl(url);
        if (matchedLead) {
          setLead(matchedLead);
          setIsLoading(false);
          return;
        }
      }
      
      setLead(null);
      setIsLoading(false);
    };

    fetchLead();
  }, [leadId, url]);

  if (isLoading) {
    return null; // Don't show loading state, just hide
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      
      <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
        <span className="font-medium text-sm truncate">
          {lead.company_name || t("webAnalysis.unknownCompany")}
        </span>
        
        {lead.contact_name && (
          <span className="text-sm text-muted-foreground truncate">
            {lead.contact_name}
          </span>
        )}
        
        {lead.email && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {lead.email}
          </span>
        )}
        
        {lead.phone && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {lead.phone}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => navigate(`/leads/${lead.id}`)}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          {t("webAnalysis.view")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => navigate(`/leads/${lead.id}?edit=true`)}
        >
          <Pencil className="h-3 w-3 mr-1" />
          {t("webAnalysis.edit")}
        </Button>
      </div>
    </div>
  );
}
