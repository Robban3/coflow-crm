import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, XCircle, PhoneOff, RotateCcw, Loader2, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";

interface LeadStatusActionsProps {
  leadId: string;
  leadStatus: string;
  onStatusChange: () => void;
}

export function LeadStatusActions({ leadId, leadStatus, onStatusChange }: LeadStatusActionsProps) {
  const [showNotInterestedDialog, setShowNotInterestedDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const updateStatus = async (
    status: string,
    extra: Record<string, unknown> = {}
  ) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          lead_status: status,
          ...extra,
        })
        .eq("id", leadId);

      if (error) throw error;
      toast({ title: t("leadDetail.lsa_statusUpdated") });
      onStatusChange();
    } catch (e: any) {
      toast({ title: "Fel", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleNotInterested = async () => {
    await updateStatus("not_interested", {
      is_not_interested: true,
      not_interested_at: new Date().toISOString(),
      not_interested_reason: reason || null,
    });
    setShowNotInterestedDialog(false);
    setReason("");
  };

  const handleInvalidPhone = () => {
    updateStatus("invalid_phone");
  };

  const handleReleaseToPool = async () => {
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("release_lead_to_pool", {
        _lead_id: leadId,
        _reason: releaseReason || null,
      });
      if (error) throw error;
      toast({
        title: "Leadet är tillbaka i poolen",
        description: "All historik sparas. En annan säljare kan plocka upp det efter karenstiden.",
      });
      setShowReleaseDialog(false);
      setReleaseReason("");
      onStatusChange();
    } catch (e: any) {
      toast({ title: "Fel", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = () => {
    updateStatus("active", {
      is_not_interested: false,
      not_interested_at: null,
      not_interested_reason: null,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {leadStatus === "active" && (
            <>
              <DropdownMenuItem onClick={() => setShowNotInterestedDialog(true)}>
                <XCircle className="h-4 w-4 mr-2 text-destructive" />
                {t("leadDetail.lsa_markNotInterested")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleInvalidPhone}>
                <PhoneOff className="h-4 w-4 mr-2 text-muted-foreground" />
                Markera felaktigt nummer
              </DropdownMenuItem>
            </>
          )}
          {leadStatus !== "active" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReactivate}>
                <RotateCcw className="h-4 w-4 mr-2 text-primary" />
                Återaktivera lead
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowReleaseDialog(true)}>
            <Undo2 className="h-4 w-4 mr-2 text-muted-foreground" />
            Tillbaka till poolen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showNotInterestedDialog} onOpenChange={setShowNotInterestedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("leadDetail.lsa_markNotInterested")}</DialogTitle>
            <DialogDescription>
              Ange en valfri anledning. Leaden kommer att filtreras bort från uppföljning.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reason">Anledning (valfritt)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("leadDetail.lsa_notInterestedPlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotInterestedDialog(false)}>
              Avbryt
            </Button>
            <Button variant="destructive" onClick={handleNotInterested} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Bekräfta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tillbaka till poolen</DialogTitle>
            <DialogDescription>
              Leadet frigörs så att en annan säljare kan plocka upp det. All
              historik (samtal, anteckningar, mejl) sparas och följer med. Skriv
              gärna kort varför det inte blev någon affär – det hjälper nästa säljare.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="release-reason">Anledning (valfritt)</Label>
            <Textarea
              id="release-reason"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder="T.ex. fel tajming, redan avtal med konkurrent, vill bli kontaktad senare..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleReleaseToPool} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Lämna tillbaka
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
