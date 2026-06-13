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
import { useTranslation } from "@/i18n/LanguageProvider";

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
  const { t } = useTranslation();

  const handleConfirmSearch = () => {
    if (!website) {
      toast({
        title: t("leadDetail.ef_noWebsiteTitle"),
        description: t("leadDetail.ef_noWebsiteDesc"),
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
          title: t("leadDetail.ef_searchFailedTitle"),
          description: data?.error || t("leadDetail.ef_couldNotFetchContact"),
          variant: "destructive",
        });
        return;
      }

      const found: EnrichResult = data.found || {};
      setResult(found);
      setShowDialog(true);

      if (!found.email && !found.phone && !found.contact_name) {
        toast({
          title: t("leadDetail.ef_noContactFoundTitle"),
          description: t("leadDetail.ef_noContactFoundDesc"),
        });
      } else if (data.updated) {
        toast({ title: t("leadDetail.ef_contactUpdatedTitle") });
        if (found.email) onEmailFound(found.email);
      } else {
        toast({ title: t("leadDetail.ef_contactFoundTitle") });
      }
    } catch (err) {
      console.error("Enrich error:", err);
      toast({
        title: t("leadDetail.ef_errorTitle"),
        description: t("leadDetail.ef_couldNotFetchContact"),
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
        title: t("leadDetail.ef_emailSavedTitle"),
        description: t("leadDetail.ef_emailSavedDesc", { email: result.email }),
      });
    } catch {
      toast({
        title: t("leadDetail.ef_couldNotSaveTitle"),
        description: t("leadDetail.ef_genericError"),
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
            {t("leadDetail.ef_confirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("leadDetail.ef_confirmQuestion")}
            <span className="block text-xs text-muted-foreground mt-2">
              {t("leadDetail.ef_confirmHint")}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("leadDetail.ef_cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleSearch}>{t("leadDetail.ef_search")}</AlertDialogAction>
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
            {currentEmail ? t("leadDetail.ef_tooltipSearchMore") : t("leadDetail.ef_tooltipFind")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <WolfConfirmDialog />

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("leadDetail.ef_dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("leadDetail.ef_dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          {!result || (!result.email && !result.phone && !result.contact_name) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{t("leadDetail.ef_noContactFoundShort")}</p>
              <p className="text-sm mt-1">{t("leadDetail.ef_addManuallyHint")}</p>
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
                            <CheckCircle2 className="h-4 w-4 mr-1" /> {t("leadDetail.ef_select")}
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
                  {t("leadDetail.ef_sourcePrefix", { hostname: new URL(result.source_url).hostname })}
                </a>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <AlertCircle className="h-3 w-3" />
            {t("leadDetail.ef_footerNote")}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
