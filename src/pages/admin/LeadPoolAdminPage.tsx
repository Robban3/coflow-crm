// Adminsidan där företagspoolen fylls och analyseras.
//
// Hela poängen med den här sidan är att säljarna aldrig ska behöva se den.
// De väljer marknad och bransch i Power Call och får färdiganalyserade företag.
// Allt ops-arbete — hämta ur registret, hitta webbplatser, mäta prestanda —
// sker här, av en admin.
//
// De tre stegen drivs av samma webbläsarloop som prospektlistorna använder:
// anropa, läs `remaining`, anropa igen tills `done`. Det är inte elegant, men
// det är befintligt, beprövat och kräver ingen ny infrastruktur.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Database, Globe, Gauge, Loader2, ShieldAlert } from "lucide-react";
import { INDUSTRY_OPTIONS, industryLabel, type IndustryKey } from "@/lib/industries";
import { COUNTIES } from "@/lib/swedishProspecting";
import { scoreBand } from "@/lib/prospectLists";

type PoolRow = {
  industry_key: string | null;
  website_status: string;
  opportunity_score: number | null;
  scored_at: string | null;
  psi_checked_at: string | null;
};

type Stat = {
  key: string;
  total: number;
  unresolved: number;
  scored: number;
  psi: number;
  callable: number;
  avgScore: number | null;
};

const MIN_CALLABLE_SCORE = 50;

export default function LeadPoolAdminPage() {
  const { isAdmin } = useAuth();
  const orgId = useOrganizationId();
  const queryClient = useQueryClient();

  const [industryKey, setIndustryKey] = useState<IndustryKey>("frisor");
  const [countyCode, setCountyCode] = useState<string>("__all__");
  const [progress, setProgress] = useState<string | null>(null);

  const county = useMemo(
    () => COUNTIES.find((c) => c.code === countyCode) ?? null,
    [countyCode],
  );

  const { data: rows = [], isLoading } = useQuery<PoolRow[]>({
    queryKey: ["lead-pool-stats", orgId],
    enabled: !!orgId && isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("lead_pool")
        .select("industry_key, website_status, opportunity_score, scored_at, psi_checked_at")
        .eq("organization_id", orgId)
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as PoolRow[];
    },
  });

  const stats = useMemo<Stat[]>(() => {
    const byKey = new Map<string, PoolRow[]>();
    for (const r of rows) {
      const k = r.industry_key ?? "—";
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(r);
    }
    return [...byKey.entries()]
      .map(([key, list]) => {
        const scored = list.filter((r) => r.scored_at);
        const withScore = scored.filter((r) => r.opportunity_score != null);
        return {
          key,
          total: list.length,
          unresolved: list.filter((r) => r.website_status === "unknown").length,
          scored: scored.length,
          psi: list.filter((r) => r.psi_checked_at).length,
          callable: withScore.filter((r) => (r.opportunity_score ?? 0) >= MIN_CALLABLE_SCORE).length,
          avgScore: withScore.length
            ? Math.round(
                withScore.reduce((s, r) => s + (r.opportunity_score ?? 0), 0) / withScore.length,
              )
            : null,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["lead-pool-stats", orgId] });

  /**
   * Kör en batch-funktion tills den rapporterar `done`. Samma mönster som
   * prospektlistorna: funktionen gör en begränsad mängd arbete per anrop och
   * säger hur mycket som återstår, loopen håller i.
   */
  const runLoop = async (
    fn: string,
    body: Record<string, unknown>,
    label: (r: any, total: number) => string,
    maxRounds = 200,
  ) => {
    let total = 0;
    let cursor: string | null = null;
    for (let round = 0; round < maxRounds; round++) {
      const { data, error } = await supabase.functions.invoke(fn, {
        body: cursor ? { ...body, cursor } : body,
      });
      if (error) throw error;
      const res = data as any;
      total += res.inserted ?? res.processed ?? res.measured ?? 0;
      cursor = res.cursor ?? null;
      setProgress(label(res, total));
      invalidate();
      if (res.done) break;
      // Skyddsnät: gör funktionen inga framsteg är det inget att vinna på att
      // fortsätta ringa den.
      if (!res.cursor && !res.processed && !res.measured && !res.inserted) break;
    }
    return total;
  };

  const fillMutation = useMutation({
    mutationFn: () =>
      runLoop(
        "fill-lead-pool",
        { market: "SE", industryKey, countyPrefixes: county?.prefixes ?? null },
        (r, total) => `${total} tillagda, ${r.scanned ?? 0} genomsökta…`,
      ),
    onSuccess: (n) => {
      setProgress(null);
      invalidate();
      toast.success(n > 0 ? `${n} företag tillagda i poolen` : "Inga nya företag hittades");
    },
    onError: (e: Error) => {
      setProgress(null);
      toast.error("Påfyllningen misslyckades", { description: e.message });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      runLoop(
        "resolve-prospect-websites",
        { scope: "pool", market: "SE", industryKey },
        (r, total) => `${total} analyserade, ${r.remaining ?? 0} kvar…`,
      ),
    onSuccess: (n) => {
      setProgress(null);
      invalidate();
      toast.success(n > 0 ? `${n} företag analyserade` : "Allt är redan analyserat");
    },
    onError: (e: Error) => {
      setProgress(null);
      toast.error("Analysen misslyckades", { description: e.message });
    },
  });

  const psiMutation = useMutation({
    mutationFn: () =>
      runLoop(
        "score-prospect-performance",
        { scope: "pool", market: "SE", industryKey },
        (r, total) => `${total} mätta, ${r.remaining ?? 0} kvar…`,
      ),
    onSuccess: (n) => {
      setProgress(null);
      invalidate();
      toast.success(n > 0 ? `${n} webbplatser mätta` : "Inget kvar att mäta");
    },
    onError: (e: Error) => {
      setProgress(null);
      toast.error("Prestandamätningen misslyckades", { description: e.message });
    },
  });

  const busy =
    fillMutation.isPending || resolveMutation.isPending || psiMutation.isPending;

  if (!isAdmin) {
    return (
      <AppLayout title="Företagspool">
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="py-10 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-semibold mb-1">Endast för administratörer</h3>
            <p className="text-sm text-muted-foreground">
              Företagspoolen fylls och analyseras av en administratör. Säljare når
              de färdiga listorna via Power Call.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Företagspool">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Företagspool</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fyll poolen ur företagsregistret och analysera den i förväg. Säljarna
            väljer sedan bara marknad och bransch i Power Call och får
            färdiganalyserade företag.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kör analys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs">Marknad</Label>
                <Select value="SE" disabled>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SE">🇸🇪 Sverige</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Företagsregistret är svenskt. Fler marknader kräver Google Places.
                </p>
              </div>
              <div>
                <Label className="text-xs">Bransch</Label>
                <Select
                  value={industryKey}
                  onValueChange={(v) => setIndustryKey(v as IndustryKey)}
                  disabled={busy}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Län</Label>
                <Select value={countyCode} onValueChange={setCountyCode} disabled={busy}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Hela landet</SelectItem>
                    {COUNTIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => fillMutation.mutate()} disabled={busy} className="gap-1.5">
                {fillMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                1. Fyll poolen
              </Button>
              <Button
                variant="outline"
                onClick={() => resolveMutation.mutate()}
                disabled={busy}
                className="gap-1.5"
              >
                {resolveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                2. Hitta webbplatser &amp; poängsätt
              </Button>
              <Button
                variant="outline"
                onClick={() => psiMutation.mutate()}
                disabled={busy}
                className="gap-1.5"
              >
                {psiMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Gauge className="h-4 w-4" />
                )}
                3. Mät prestanda
              </Button>
              {progress && (
                <span className="text-xs text-muted-foreground tabular-nums">{progress}</span>
              )}
            </div>

            {busy && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Låt fliken stå öppen. Arbetet drivs härifrån och pausar om du
                stänger den — men allt är idempotent, så du kan fortsätta senare.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Steg 3 tar 10–20 sekunder per webbplats. På stora branscher: kör steg
              1 och 2 på allt, och steg 3 bara när du behöver skilja topparna åt.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Poolens status</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {isLoading ? (
              <div className="py-10 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : stats.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 pb-6">
                Poolen är tom. Välj bransch och kör steg 1.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bransch</TableHead>
                    <TableHead className="text-right">Totalt</TableHead>
                    <TableHead className="text-right">Oanalyserade</TableHead>
                    <TableHead className="text-right">Poängsatta</TableHead>
                    <TableHead className="text-right">Prestandamätta</TableHead>
                    <TableHead className="text-right">Ringbara</TableHead>
                    <TableHead className="text-right">Snittpoäng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((s) => (
                    <TableRow key={s.key}>
                      <TableCell className="font-medium">{industryLabel(s.key)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.total}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {s.unresolved}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.scored}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.psi}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={s.callable > 0 ? "default" : "outline"}>
                          {s.callable}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums font-medium",
                          scoreBand(s.avgScore)?.textClass,
                        )}
                      >
                        {s.avgScore ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          "Ringbara" = poängsatta företag med minst {MIN_CALLABLE_SCORE} poäng. Det
          är dem Power Call serverar.
        </p>
      </div>
    </AppLayout>
  );
}
