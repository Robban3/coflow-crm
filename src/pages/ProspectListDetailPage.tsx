import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Globe,
  Loader2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  LIST_STATUS_VARIANTS,
  WEBSITE_STATUS_VARIANTS,
  listStatusLabel,
  websiteStatusLabel,
  issueLabel,
  scoreBand,
  SCORE_BANDS,
  type ImportProspectListResult,
  type ProspectList,
  type ProspectListItem,
  type ProspectListStatus,
  type ReviewStatus,
  type WebsiteStatus,
} from "@/lib/prospectLists";

function hostOf(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ProspectListDetailPage() {
  const { id: listId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [onlyKeepers, setOnlyKeepers] = useState(true);

  const { data: list } = useQuery<ProspectList | null>({
    queryKey: ["prospect-list", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("prospect_lists")
        .select("*")
        .eq("id", listId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProspectList | null;
    },
  });

  const { data: items = [], isLoading } = useQuery<ProspectListItem[]>({
    queryKey: ["prospect-list-items", listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("prospect_list_items")
        .select("*")
        .eq("list_id", listId)
        .order("opportunity_score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProspectListItem[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["prospect-list-items", listId] });
    queryClient.invalidateQueries({ queryKey: ["prospect-list", listId] });
    queryClient.invalidateQueries({ queryKey: ["prospect-lists"] });
  };

  // Dubbletter är utestängda från importen, så de går inte att markera heller.
  const selectableItems = useMemo(
    () => items.filter((i) => !i.duplicate_of_lead_id && !i.imported_lead_id),
    [items],
  );

  const stats = useMemo(() => {
    const duplicates = items.filter((i) => i.duplicate_of_lead_id).length;
    const keepers = selectableItems.filter((i) => i.review_status === "keep").length;
    const discarded = selectableItems.filter((i) => i.review_status === "discard").length;
    const imported = items.filter((i) => i.imported_lead_id).length;
    return { duplicates, keepers, discarded, imported };
  }, [items, selectableItems]);

  const allSelected =
    selectableItems.length > 0 && selectableItems.every((i) => selectedIds.has(i.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableItems.map((i) => i.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Sätt review_status (en rad eller markerade rader) ──
  const reviewMutation = useMutation({
    mutationFn: async ({
      ids,
      status,
    }: {
      ids: string[];
      status: ReviewStatus | null;
    }) => {
      const { error } = await (supabase as any)
        .from("prospect_list_items")
        .update({ review_status: status })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (err: Error) => {
      toast.error("Kunde inte uppdatera urvalet", { description: err.message });
    },
  });

  const bulkReview = (status: ReviewStatus) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    reviewMutation.mutate(
      { ids, status },
      {
        onSuccess: () => {
          toast.success(
            status === "keep"
              ? `${ids.length} företag behålls`
              : `${ids.length} företag kastas`,
          );
          setSelectedIds(new Set());
        },
      },
    );
  };

  // ── Hämta webbplatser & poängsätt ──
  // The edge function works in batches (25 per invocation) and reports how many
  // items are still unresolved, so we loop until it says it's done. Doing it in
  // one request would exceed the function timeout on a large list.
  const [resolveProgress, setResolveProgress] = useState<string | null>(null);

  const resolveMutation = useMutation({
    mutationFn: async () => {
      let processedTotal = 0;
      // Hard stop so a bug upstream can never spin forever.
      for (let round = 0; round < 40; round++) {
        const { data, error } = await supabase.functions.invoke(
          "resolve-prospect-websites",
          { body: { listId } },
        );
        if (error) throw error;
        const res = data as { processed: number; remaining: number; done: boolean };
        processedTotal += res.processed ?? 0;
        setResolveProgress(
          res.remaining > 0
            ? `${processedTotal} klara, ${res.remaining} kvar…`
            : `${processedTotal} klara`,
        );
        invalidate();
        if (res.done || res.remaining === 0 || res.processed === 0) break;
      }
      return processedTotal;
    },
    onSuccess: (processed) => {
      setResolveProgress(null);
      invalidate();
      toast.success(
        processed > 0
          ? `${processed} företag analyserade`
          : "Alla företag i listan är redan analyserade",
      );
    },
    onError: (err: Error) => {
      setResolveProgress(null);
      toast.error("Analysen misslyckades", { description: err.message });
    },
  });

  const unresolvedCount = useMemo(
    () => items.filter((i) => i.website_status === "unknown").length,
    [items],
  );

  // ── Kontrollera dubbletter ──
  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "mark_prospect_list_duplicates",
        { _list_id: listId },
      );
      if (error) throw error;
      return (data ?? 0) as number;
    },
    onSuccess: (marked) => {
      invalidate();
      toast.success(
        marked > 0
          ? `${marked} företag finns redan som leads och markerades`
          : "Inga nya dubbletter hittades",
      );
    },
    onError: (err: Error) => {
      toast.error("Dubblettkontrollen misslyckades", { description: err.message });
    },
  });

  // ── Importera som leads ──
  const importMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "import_prospect_list_to_leads",
        { _list_id: listId, _only_keepers: onlyKeepers },
      );
      if (error) throw error;
      const rows = (data ?? []) as ImportProspectListResult[];
      return (
        rows[0] ?? { imported: 0, skipped_duplicates: 0, remaining: 0 }
      );
    },
    onSuccess: ({ imported, skipped_duplicates, remaining }) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["leads-enriched"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-existing-leads"] });
      queryClient.invalidateQueries({ queryKey: ["prospecting-lead-orgnumbers"] });
      setSelectedIds(new Set());

      toast.success(
        `${imported} leads importerade, ${skipped_duplicates} dubbletter hoppades över`,
      );

      // Taket för öppna leads per användare är nått – förväntat, inte ett fel.
      if (remaining > 0) {
        toast.warning(`${remaining} företag ligger kvar i listan`, {
          description:
            "Ditt tak för öppna leads är nått. Bearbeta eller stäng några leads och importera resten senare.",
          duration: 10000,
        });
      }
    },
    onError: (err: Error) => {
      toast.error("Importen misslyckades", { description: err.message });
    },
  });

  const importDisabled =
    importMutation.isPending ||
    (onlyKeepers ? stats.keepers === 0 : selectableItems.length === 0);

  return (
    <AppLayout title={list?.name ?? "Prospektlista"}>
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/prospect-lists">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight truncate">
                  {list?.name ?? "Prospektlista"}
                </h1>
                {list && (
                  <Badge
                    variant={
                      LIST_STATUS_VARIANTS[list.status as ProspectListStatus] ?? "outline"
                    }
                    className="text-xs"
                  >
                    {listStatusLabel(list.status)}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {items.length} företag · {stats.keepers} behålls · {stats.discarded} kastas ·{" "}
                {stats.duplicates} dubbletter
                {stats.imported > 0 && ` · ${stats.imported} importerade`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending || unresolvedCount === 0}
              className="gap-1.5"
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              {resolveMutation.isPending
                ? (resolveProgress ?? "Analyserar…")
                : unresolvedCount > 0
                  ? `Hämta webbplatser (${unresolvedCount})`
                  : "Alla analyserade"}
            </Button>
            <Button
              variant="outline"
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending || items.length === 0}
              className="gap-1.5"
            >
              {duplicateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Kontrollera dubbletter
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importDisabled}
              className="gap-1.5"
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Importera som leads
            </Button>
          </div>
        </div>

        {/* Bulk-verktygsrad */}
        {items.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  disabled={selectableItems.length === 0}
                >
                  {allSelected ? "Avmarkera alla" : "Markera alla"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => bulkReview("keep")}
                  disabled={selectedIds.size === 0 || reviewMutation.isPending}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Behåll markerade
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => bulkReview("discard")}
                  disabled={selectedIds.size === 0 || reviewMutation.isPending}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Kasta markerade
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} markerade
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="only-keepers"
                  checked={onlyKeepers}
                  onCheckedChange={setOnlyKeepers}
                />
                <Label htmlFor="only-keepers" className="text-sm text-muted-foreground">
                  Importera endast behållna
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabell */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-xl bg-card/50">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">Listan är tom</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sök fram företag under Prospektering och välj "Lägg i prospektlista"
            </p>
            <Button asChild>
              <Link to="/prospecting">Till Prospektering</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Poängförklaring — utan den säger siffran ingenting, och röd
                läses lätt som "hoppa över" när den betyder motsatsen. */}
            <Card className="mb-4">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <p className="text-xs text-muted-foreground max-w-md">
                    Poängen beskriver <strong className="text-foreground">webbplatsens skick</strong> —
                    inte leadets värde. Hög poäng betyder sämre sajt, alltså större
                    behov och bättre säljläge.
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {SCORE_BANDS.map((band) => (
                      <div key={band.min} className="flex items-start gap-2">
                        <span
                          className={cn("h-2 w-2 rounded-full mt-1 shrink-0", band.dotClass)}
                        />
                        <div className="leading-tight">
                          <div className="text-xs font-medium">
                            {band.min}–{band.max} · {band.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground max-w-[190px]">
                            {band.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="border border-border rounded-lg overflow-x-auto bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      disabled={selectableItems.length === 0}
                    />
                  </TableHead>
                  <TableHead>Företag</TableHead>
                  <TableHead className="hidden md:table-cell">Ort</TableHead>
                  <TableHead className="hidden lg:table-cell">Org.nr</TableHead>
                  <TableHead>Webbplats</TableHead>
                  <TableHead className="w-20 text-right">Poäng</TableHead>
                  <TableHead className="w-[190px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isDuplicate = !!item.duplicate_of_lead_id;
                  const isImported = !!item.imported_lead_id;
                  const selectable = !isDuplicate && !isImported;
                  const selected = selectedIds.has(item.id);
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        isDuplicate && "opacity-50",
                        selected && "bg-primary/5",
                      )}
                    >
                      <TableCell>
                        {selectable && (
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleSelect(item.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span className="truncate max-w-[280px]">{item.company_name}</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isDuplicate && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Finns redan som lead
                              </Badge>
                            )}
                            {isImported && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Importerad
                              </Badge>
                            )}
                            {item.industry && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {item.industry}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {item.city || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {item.org_number || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          {item.website ? (
                            <a
                              href={
                                item.website.startsWith("http")
                                  ? item.website
                                  : `https://${item.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 min-w-0"
                            >
                              <Globe className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {hostOf(item.website)}
                              </span>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          <Badge
                            variant={
                              WEBSITE_STATUS_VARIANTS[item.website_status as WebsiteStatus] ??
                              "outline"
                            }
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {websiteStatusLabel(item.website_status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.opportunity_score == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div
                            className="flex flex-col items-end leading-tight"
                            title={scoreBand(item.opportunity_score)?.description}
                          >
                            <span
                              className={cn(
                                "tabular-nums font-semibold",
                                scoreBand(item.opportunity_score)?.textClass,
                              )}
                            >
                              {item.opportunity_score}
                            </span>
                            {issueLabel(item.main_issue_code) && (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {issueLabel(item.main_issue_code)}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {selectable ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant={item.review_status === "keep" ? "default" : "outline"}
                              className="h-7 gap-1 px-2"
                              disabled={reviewMutation.isPending}
                              onClick={() =>
                                reviewMutation.mutate({
                                  ids: [item.id],
                                  status: item.review_status === "keep" ? null : "keep",
                                })
                              }
                            >
                              <ThumbsUp className="h-3 w-3" />
                              Behåll
                            </Button>
                            <Button
                              size="sm"
                              variant={
                                item.review_status === "discard" ? "secondary" : "outline"
                              }
                              className="h-7 gap-1 px-2"
                              disabled={reviewMutation.isPending}
                              onClick={() =>
                                reviewMutation.mutate({
                                  ids: [item.id],
                                  status: item.review_status === "discard" ? null : "discard",
                                })
                              }
                            >
                              <ThumbsDown className="h-3 w-3" />
                              Kasta
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {isImported ? "Importerad" : "Utesluten"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
