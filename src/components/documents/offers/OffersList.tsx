import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { fromTable } from "../supabaseHelper";
import { type Document as DocType, type TemplateVersion } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  Search,
  ArrowUpDown,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Pencil,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";

const statusConfig: Record<string, { labelKey: string; icon: typeof FileText; className: string }> = {
  draft: {
    labelKey: "offers.status.draft",
    icon: Pencil,
    className: "bg-muted text-muted-foreground border-border",
  },
  sent: {
    labelKey: "offers.status.sent",
    icon: Send,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  viewed: {
    labelKey: "offers.status.viewed",
    icon: Eye,
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  accepted: {
    labelKey: "offers.status.accepted",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  rejected: {
    labelKey: "offers.status.rejected",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  expired: {
    labelKey: "offers.status.expired",
    icon: Clock,
    className: "bg-muted text-muted-foreground border-border",
  },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {t(config.labelKey)}
    </span>
  );
}

function formatAmount(amount: number | null, currency: string | null | undefined, numberLocale: string = "sv-SE") {
  if (!amount) return "–";
  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: currency || "SEK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OffersList() {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const numberLocale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "sv-SE";
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = useOrganizationId();
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", orgId],
    queryFn: async () => {
      const { data, error } = await fromTable("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocType[];
    },
    enabled: !!orgId,
  });

  const { data: legacyQuotes } = useQuery({
    queryKey: ["legacy_quotes", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, title, status, quote_number, total, created_at, recipient_name, recipient_email, currency")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { data: version } = await fromTable("template_versions")
        .select("*")
        .eq("template_id", templateId)
        .order("version", { ascending: false })
        .limit(1)
        .single();
      const ver = version as TemplateVersion | null;

      const { data: template } = await fromTable("document_templates")
        .select("name, type")
        .eq("id", templateId)
        .single();
      const tpl = template as { name: string; type: string } | null;

      const { data: doc, error } = await fromTable("documents")
        .insert({
          title: t("offers.list.newOfferTitle"),
          type: tpl?.type || "offer",
          template_id: templateId,
          template_version: ver?.version || 1,
          organization_id: orgId!,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      const newDoc = doc as DocType;

      const blocks = (ver?.blocks_json as any[]) || [];
      if (blocks.length > 0) {
        const blockInserts = blocks.map((b: any, i: number) => ({
          document_id: newDoc.id,
          type: b.type,
          sort_order: i,
          config: b.config || {},
        }));
        await fromTable("document_blocks").insert(blockInserts);
      }

      return newDoc;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setShowPicker(false);
      navigate(`/offers/${doc.id}`);
      toast.success(t("offers.list.toastCreated"));
    },
    onError: () => toast.error(t("offers.list.toastCreateError")),
  });

  // Merge and filter
  type OfferRow = {
    id: string;
    title: string;
    recipient: string | null;
    status: string;
    amount: number | null;
    currency: string | null;
    date: string;
    docNumber: string | null;
    isLegacy: boolean;
  };

  const allOffers: OfferRow[] = [
    ...(documents || []).map((d) => ({
      id: d.id,
      title: d.title,
      recipient: d.recipient_name || null,
      status: d.status,
      amount: d.total ? Number(d.total) : null,
      currency: d.currency,
      date: d.created_at,
      docNumber: d.document_number,
      isLegacy: false,
    })),
    ...(legacyQuotes || []).map((q) => ({
      id: q.id,
      title: q.title,
      recipient: q.recipient_name || null,
      status: q.status,
      amount: q.total ? Number(q.total) : null,
      currency: q.currency,
      date: q.created_at,
      docNumber: q.quote_number,
      isLegacy: true,
    })),
  ];

  const filtered = searchQuery
    ? allOffers.filter(
        (o) =>
          o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.recipient?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.docNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allOffers;

  // Stats
  const stats = {
    total: allOffers.length,
    draft: allOffers.filter((o) => o.status === "draft").length,
    sent: allOffers.filter((o) => ["sent", "viewed"].includes(o.status)).length,
    accepted: allOffers.filter((o) => o.status === "accepted").length,
    totalValue: allOffers
      .filter((o) => o.status === "accepted")
      .reduce((sum, o) => sum + (o.amount || 0), 0),
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("offers.list.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("offers.list.subtitle")}
          </p>
        </div>
        <Button onClick={() => setShowPicker(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {t("offers.list.newOffer")}
        </Button>
      </div>

      {/* Stats row */}
      {allOffers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{t("offers.list.statTotal")}</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{stats.total}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{t("offers.list.statDraft")}</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{stats.draft}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{t("offers.list.statSent")}</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{stats.sent}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{t("offers.list.statAccepted")}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold tracking-tight">{stats.accepted}</p>
              {stats.totalValue > 0 && (
                <p className="text-sm font-medium text-muted-foreground">
                  {formatAmount(stats.totalValue, null, numberLocale)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {allOffers.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("offers.list.searchPlaceholder")}
            className="pl-9 h-10"
          />
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {t("offers.list.colOffer")}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                    {t("offers.list.colRecipient")}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                    {t("offers.list.colDate")}
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    {t("offers.list.colAmount")}
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    {t("offers.list.colStatus")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((offer) => (
                  <tr
                    key={offer.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() =>
                      navigate(offer.isLegacy ? `/quotes/${offer.id}` : `/offers/${offer.id}`)
                    }
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate leading-tight">
                            {offer.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {offer.docNumber ? `#${offer.docNumber}` : ""}
                            {offer.isLegacy && (
                              <span className="ml-1 text-muted-foreground/60">· {t("offers.list.legacy")}</span>
                            )}
                            <span className="md:hidden">
                              {offer.recipient && ` · ${offer.recipient}`}
                            </span>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-foreground/80 truncate block max-w-[200px]">
                        {offer.recipient || (
                          <span className="text-muted-foreground/50 italic">{t("offers.list.noRecipient")}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="text-muted-foreground whitespace-nowrap">
                        {format(new Date(offer.date), "d MMM yyyy", { locale: sv })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-medium tabular-nums whitespace-nowrap">
                        {formatAmount(offer.amount, offer.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <StatusBadge status={offer.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : allOffers.length > 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("offers.list.noMatch")}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{t("offers.list.emptyTitle")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {t("offers.list.emptyDesc")}
            </p>
            <Button onClick={() => setShowPicker(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("offers.list.createOffer")}
            </Button>
          </div>
        </div>
      )}

      <TemplatePickerDialog
        open={showPicker}
        onOpenChange={setShowPicker}
        onSelect={(templateId) => createMutation.mutate(templateId)}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
