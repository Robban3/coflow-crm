import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ReportRenderer } from "@/components/reports/ReportRenderer";
import { GrowthReportRenderer } from "@/components/reports/growth/GrowthReportRenderer";
import { isGrowthReport } from "@/components/reports/growth/types";
import { validateReportSchema } from "@/components/reports/reportSchema";
import { supabase } from "@/integrations/supabase/client";
import { useReportTracking } from "@/hooks/useReportTracking";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function PublicReportPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const { trackCta, trackPdf, trackShare } = useReportTracking(token);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-report", token],
    queryFn: async () => {
      const { data: reports, error } = await (supabase as any).rpc("get_public_report_by_token", {
        share_token: token!,
      });
      const report = Array.isArray(reports) ? reports[0] : null;
      if (error || !report) throw new Error(t("publicPages.report.unavailable"));

      (supabase as any).rpc("increment_public_report_view", { share_token: token! }).then(() => {});

      return report;
    },
    enabled: !!token,
  });

  const reportData = data?.data;
  const isGrowth = isGrowthReport(reportData);
  const isValid = isGrowth || (reportData && validateReportSchema(reportData));

  // Dynamic page title + OG meta tags
  useEffect(() => {
    if (!isValid) return;
    const rd = reportData as any;
    const name = isGrowth ? rd?.company?.name : rd?.meta?.companyName;
    const domain = isGrowth ? rd?.company?.domain : rd?.meta?.domain;
    const type = isGrowth ? t("publicPages.report.growthType") : t("publicPages.report.webSeoType");
    const title = name ? t("publicPages.report.titleFor", { name, type }) : type;
    const description = name
      ? t("publicPages.report.descWithName", { type, name, domain: domain ? ` (${domain})` : "" })
      : t("publicPages.report.descNoName", { type });

    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("name", "description", description);

    return () => {
      document.title = "CoFlow - CRM";
      setMeta("property", "og:title", "CoFlow - CRM");
      setMeta("property", "og:description", "CoFlow CRM");
      setMeta("name", "description", "CoFlow CRM");
    };
  }, [isValid, reportData, isGrowth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm px-6">
          <h1 className="text-xl font-semibold mb-2 text-foreground">{t("publicPages.report.unavailable")}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {error instanceof Error ? error.message : t("publicPages.report.invalidOrExpired")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isGrowth ? (
        <GrowthReportRenderer data={reportData as any} publicMode reportId={data?.id} leadId={data?.lead_id} onCtaClick={trackCta} onPdfClick={trackPdf} onShareClick={trackShare} />
      ) : (
        <ReportRenderer data={reportData as any} publicMode reportId={data?.id} leadId={data?.lead_id} />
      )}
    </div>
  );
}
