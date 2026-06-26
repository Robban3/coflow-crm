import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Eye, Send, ExternalLink, Copy } from "lucide-react";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total: number;
  currency: string;
  valid_until: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  view_token: string;
  view_count: number;
  created_at: string;
  sent_at: string | null;
  lead_id: string | null;
}

interface QuotesListProps {
  onCreateNew: () => void;
  onEdit: (id: string) => void;
}

const STATUS_CONFIG: Record<string, { labelKey: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { labelKey: "quotes.statusDraft", variant: "secondary" },
  sent: { labelKey: "quotes.statusSent", variant: "default" },
  viewed: { labelKey: "quotes.statusViewed", variant: "outline" },
  accepted: { labelKey: "quotes.statusAccepted", variant: "default" },
  won: { labelKey: "quotes.statusWon", variant: "default" },
  rejected: { labelKey: "quotes.statusRejected", variant: "destructive" },
  expired: { labelKey: "quotes.statusExpired", variant: "secondary" },
};

export function QuotesList({ onCreateNew, onEdit }: QuotesListProps) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const numberLocale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "sv-SE";
  const organizationId = useOrganizationId();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (organizationId) fetchQuotes();
  }, [organizationId]);

  const fetchQuotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setQuotes(data as Quote[]);
    setLoading(false);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/quote/${token}`;
    navigator.clipboard.writeText(url);
    toast.success(t("quotes.linkCopied"));
  };

  const filtered = quotes.filter((q) => {
    const matchSearch =
      !search ||
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.quote_number.toLowerCase().includes(search.toLowerCase()) ||
      q.recipient_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("quotes.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("quotes.subtitle")}</p>
        </div>
        <Button onClick={onCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          {t("quotes.newQuote")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("quotes.searchQuote")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {["all", "draft", "sent", "viewed", "accepted", "won", "rejected"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? t("quotes.filterAll") : STATUS_CONFIG[s] ? t(STATUS_CONFIG[s].labelKey) : s}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">{t("quotes.loading")}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">{t("quotes.noQuotesYet")}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t("quotes.createFirstQuote")}</p>
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              {t("quotes.createQuote")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const statusInfo = STATUS_CONFIG[q.status] || STATUS_CONFIG.draft;
            return (
              <Card
                key={q.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onEdit(q.id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{q.title}</span>
                        <Badge variant={statusInfo.variant} className="shrink-0">
                          {t(statusInfo.labelKey)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span>#{q.quote_number}</span>
                        {q.recipient_name && <span>→ {q.recipient_name}</span>}
                        <span>{format(new Date(q.created_at), "d MMM yyyy", { locale: dateLocale })}</span>
                        {q.view_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {q.view_count}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold text-lg whitespace-nowrap">
                        {Number(q.total).toLocaleString(numberLocale)} {q.currency}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLink(q.view_token);
                        }}
                        title={t("quotes.copyLink")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
