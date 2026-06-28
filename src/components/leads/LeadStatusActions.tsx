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
import { MoreHorizontal, XCircle, PhoneOff, RotateCcw, Loader2, Undo2, Eraser } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useAuth } from "@/hooks/useAuth";

interface LeadStatusActionsProps {
  leadId: string;
  leadStatus: string;
  onStatusChange: () => void;
}

export function LeadStatusActions({ leadId, leadStatus, onStatusChange }: LeadStatusActionsProps) {
  const [showNotInterestedDialog, setShowNotInterestedDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [reason, setReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  // A test deal/offer that can be reverted: won, lost, or an offer already sent.
  const isDeal = ["won", "lost", "offer_sent"].includes(leadStatus);

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
      toast({ title: t("leadDetail.ls_errorTitle"), description: e.message, variant: "destructive" });
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
        title: t("leadDetail.lsa_backInPoolTitle"),
        description: t("leadDetail.lsa_backInPoolDesc"),
      });
      setShowReleaseDialog(false);
      setReleaseReason("");
      onStatusChange();
    } catch (e: any) {
      toast({ title: t("leadDetail.ls_errorTitle"), description: e.message, variant: "destructive" });
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

  const handleRevertDeal = async () => {
    setLoading(true);
    try {
      const { error } = await (supabase as any).rpc("admin_revert_deal_to_lead", {
        _lead_id: leadId,
      });
      if (error) throw error;
      toast({ title: t("leadDetail.lsa_revertDealDone") });
      setShowRevertDialog(false);
      onStatusChange();
    } catch (e: any) {
      toast({ title: t("leadDetail.ls_errorTitle"), description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
                {t("leadDetail.ls_markInvalidPhone")}
              </DropdownMenuItem>
            </>
          )}
          {leadStatus !== "active" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReactivate}>
                <RotateCcw className="h-4 w-4 mr-2 text-primary" />
                {t("leadDetail.ls_reactivate")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowReleaseDialog(true)}>
            <Undo2 className="h-4 w-4 mr-2 text-muted-foreground" />
            {t("leadDetail.ls_backToPool")}
          </DropdownMenuItem>
          {isAdmin && isDeal && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowRevertDialog(true)}>
                <Eraser className="h-4 w-4 mr-2 text-amber-600" />
                {t("leadDetail.lsa_revertDeal")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showNotInterestedDialog} onOpenChange={setShowNotInterestedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("leadDetail.lsa_markNotInterested")}</DialogTitle>
            <DialogDescription>
              {t("leadDetail.ls_dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reason">{t("leadDetail.ls_reasonLabel")}</Label>
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
              {t("leadDetail.ls_cancel")}
            </Button>
            <Button variant="destructive" onClick={handleNotInterested} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("leadDetail.ls_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("leadDetail.lsa_revertDeal")}</DialogTitle>
            <DialogDescription>{t("leadDetail.lsa_revertDealDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevertDialog(false)}>
              {t("leadDetail.ls_cancel")}
            </Button>
            <Button variant="destructive" onClick={handleRevertDeal} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("leadDetail.lsa_revertDealConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("leadDetail.ls_backToPool")}</DialogTitle>
            <DialogDescription>
              {t("leadDetail.ls_releaseDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="release-reason">{t("leadDetail.ls_reasonLabel")}</Label>
            <Textarea
              id="release-reason"
              value={releaseReason}
              onChange={(e) => setReleaseReason(e.target.value)}
              placeholder={t("leadDetail.ls_releasePlaceholder")}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReleaseDialog(false)}>
              {t("leadDetail.ls_cancel")}
            </Button>
            <Button onClick={handleReleaseToPool} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("leadDetail.ls_returnBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
