import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Users, CheckCircle2, AlertCircle } from "lucide-react";

interface SellerRow {
  user_id: string;
  email: string;
  full_name: string | null;
  has_profile: boolean;
  first_name: string | null;
  last_name: string | null;
  external_email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  personnummer: string | null;
  company_form: string | null;
  external_service_name: string | null;
  updated_at: string | null;
}

const companyFormLabel = (v: string | null) =>
  v === "enskild_firma" ? "Enskild firma"
    : v === "aktiebolag" ? "Aktiebolag"
    : v === "extern_tjanst" ? "Extern tjänst"
    : "-";

export default function SalespeoplePage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SellerRow | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).rpc("get_org_sellers");
      if (active) {
        setRows((data as SellerRow[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (!isAdmin) {
    return (
      <AppLayout title="Säljare">
        <p className="text-sm text-muted-foreground">Endast administratörer har åtkomst till denna sida.</p>
      </AppLayout>
    );
  }

  const filledCount = rows.filter((r) => r.has_profile).length;

  return (
    <AppLayout title="Säljare">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6" /> Säljare
            </h2>
            <p className="text-muted-foreground text-sm">
              Alla säljare och deras uppgifter. {filledCount} av {rows.length} har fyllt i.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Översikt</CardTitle>
            <CardDescription>Klicka på en säljare för att se alla uppgifter.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">Inga säljare hittades.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>Applabbet-epost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const name = r.has_profile
                      ? [r.first_name, r.last_name].filter(Boolean).join(" ")
                      : r.full_name;
                    return (
                      <TableRow
                        key={r.user_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => r.has_profile && setSelected(r)}
                      >
                        <TableCell className="font-medium">{name || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.email}</TableCell>
                        <TableCell>
                          {r.has_profile ? (
                            <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Ifylld
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-400">
                              <AlertCircle className="h-3 w-3" /> Saknas
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {r.has_profile && (
                            <Button variant="ghost" size="sm" onClick={() => setSelected(r)}>Visa</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selected ? [selected.first_name, selected.last_name].filter(Boolean).join(" ") : ""}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Detail label="Applabbet-epost" value={selected.email} />
              <Detail label="E-post utanför Applabbet" value={selected.external_email} />
              <Detail label="Adress" value={selected.address} />
              <Detail label="Postnummer" value={selected.postal_code} />
              <Detail label="Postort" value={selected.city} />
              <Detail label="Personnummer" value={selected.personnummer} />
              <Detail label="Bolagsform" value={companyFormLabel(selected.company_form)} />
              {selected.company_form === "extern_tjanst" && (
                <Detail label="Extern tjänst" value={selected.external_service_name} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground break-words">{value || "-"}</p>
    </div>
  );
}
