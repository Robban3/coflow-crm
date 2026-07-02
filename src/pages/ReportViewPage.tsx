import { useTranslation } from "@/i18n/LanguageProvider";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { ReportRenderer } from "@/components/reports/ReportRenderer";
import { GrowthReportRenderer } from "@/components/reports/growth/GrowthReportRenderer";
import { ReportInsightsPanel } from "@/components/reports/ReportInsightsPanel";
import { isGrowthReport } from "@/components/reports/growth/types";
import { validateReportSchema } from "@/components/reports/reportSchema";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  FileText,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Mail,
} from "lucide-react";
import { CreateGrowthReportDialog } from "@/components/reports/growth/CreateGrowthReportDialog";
import { SendReportDialog } from "@/components/reports/SendReportDialog";

export default function ReportViewPage() {
  const { t } = useTranslation();
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showNewReportDialog, setShowNewReportDialog] = useState(false);
  const [sendReportUrl, setSendReportUrl] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!reportId,
  });

  // Fetch lead info for "create new report" dialog
  const { data: leadForDialog } = useQuery({
    queryKey: ["lead-for-report-dialog", report?.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, company_name, website, email, contact_name")
        .eq("id", report!.lead_id!)
        .single();
      return data;
    },
    enabled: !!report?.lead_id,
  });

  const { data: share, refetch: refetchShare } = useQuery({
    queryKey: ["report-share", reportId],
    queryFn: async () => {
      const { data } = await supabase
        .from("report_shares")
        .select("*")
        .eq("report_id", reportId!)
        .maybeSingle();
      return data;
    },
    enabled: !!reportId,
  });

  const toggleShare = async () => {
    if (!reportId) return;
    if (!share) {
      await supabase.from("report_shares").insert({ report_id: reportId, enabled: true });
    } else {
      await supabase
        .from("report_shares")
        .update({ enabled: !share.enabled })
        .eq("id", share.id);
    }
    refetchShare();
    toast({ title: share?.enabled ? t("reports.view.shareDisabled") : t("reports.view.shareEnabled") });
  };

  const shareUrl = share?.token
    ? `${window.location.origin}/r/${share.token}`
    : null;

  // Ensure the report is publicly shared (enabled + token), then open the
  // "email report" dialog with a working /r/{token} link.
  const handleEmailReport = async () => {
    if (!reportId) return;
    let token = share?.token as string | undefined;
    if (!share) {
      const { data } = await supabase
        .from("report_shares")
        .insert({ report_id: reportId, enabled: true })
        .select("token")
        .single();
      token = data?.token;
      refetchShare();
    } else if (!share.enabled) {
      await supabase.from("report_shares").update({ enabled: true }).eq("id", share.id);
      token = share.token;
      refetchShare();
    }
    if (!token) {
      toast({ title: t("reports.email.shareError"), variant: "destructive" });
      return;
    }
    setSendReportUrl(`${window.location.origin}/r/${token}`);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: t("reports.view.linkCopied") });
    setTimeout(() => setCopied(false), 2000);
  };

  const reportData = report?.data;
  const isGrowth = isGrowthReport(reportData);
  const isValid = isGrowth || (reportData && validateReportSchema(reportData));

  if (isLoading) {
    return (
      <AppLayout title={t("reports.view.title")}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!report || !isValid) {
    return (
      <AppLayout title={t("reports.view.title")}>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t("reports.view.loadError")}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />{t("reports.view.back")}</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={report.title}>
      {/* Toolbar */}
      <div className="no-print flex items-center justify-between gap-3 mb-6 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />{t("reports.view.back")}</Button>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              checked={share?.enabled ?? false}
              onCheckedChange={toggleShare}
              id="share-toggle"
            />
            <Label htmlFor="share-toggle" className="text-sm cursor-pointer">{t("reports.view.shareLink")}</Label>
          </div>

          {share?.enabled && shareUrl && (
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {copied ? "Kopierad" : t("reports.view.copyLink")}
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <FileText className="mr-1 h-3 w-3" />{t("reports.view.exportPdf")}</Button>

          <Button variant="outline" size="sm" onClick={handleEmailReport}>
            <Mail className="mr-1 h-3 w-3" />{t("reports.view.emailReport")}</Button>

          {isGrowth && report.lead_id && (
            <Button variant="outline" size="sm" onClick={() => setShowNewReportDialog(true)}>
              <RefreshCw className="mr-1 h-3 w-3" />{t("reports.view.createNew")}</Button>
          )}
        </div>
      </div>

      {/* Report Insights */}
      {share?.enabled && share?.token && (
        <div className="mb-6">
          <ReportInsightsPanel reportId={reportId!} shareToken={share.token} />
        </div>
      )}

      {isGrowth ? (
        <GrowthReportRenderer data={reportData as any} reportId={reportId} leadId={report.lead_id} />
      ) : (
        <ReportRenderer data={reportData as any} reportId={reportId} leadId={report.lead_id} />
      )}

      {/* New Report Dialog */}
      {isGrowth && leadForDialog && (
        <CreateGrowthReportDialog
          open={showNewReportDialog}
          onOpenChange={setShowNewReportDialog}
          lead={{ id: leadForDialog.id, company_name: leadForDialog.company_name, website: leadForDialog.website }}
        />
      )}

      {/* Email Report Dialog */}
      {sendReportUrl && (
        <SendReportDialog
          reportId={reportId!}
          reportUrl={sendReportUrl}
          recipientEmail={leadForDialog?.email}
          recipientName={leadForDialog?.contact_name || leadForDialog?.company_name}
          onClose={() => setSendReportUrl(null)}
        />
      )}
    </AppLayout>
  );
}
