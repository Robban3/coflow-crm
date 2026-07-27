import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  LIST_STATUS_VARIANTS,
  listStatusLabel,
  type ProspectList,
  type ProspectListStatus,
} from "@/lib/prospectLists";

export default function ProspectListsPage() {
  const organizationId = useOrganizationId();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sharedToTeam, setSharedToTeam] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProspectList | null>(null);

  const { data: lists = [], isLoading } = useQuery<ProspectList[]>({
    queryKey: ["prospect-lists", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("prospect_lists")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProspectList[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId || !user) throw new Error("Ingen organisation");
      const { data, error } = await (supabase as any)
        .from("prospect_lists")
        .insert({
          organization_id: organizationId,
          created_by: user.id,
          name: name.trim(),
          description: description.trim() || null,
          shared_to_team: sharedToTeam,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProspectList;
    },
    onSuccess: () => {
      toast.success("Prospektlistan skapades");
      queryClient.invalidateQueries({ queryKey: ["prospect-lists"] });
      setCreateOpen(false);
      setName("");
      setDescription("");
      setSharedToTeam(false);
    },
    onError: (err: Error) => {
      toast.error("Kunde inte skapa listan", { description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("prospect_lists")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prospektlistan raderades");
      queryClient.invalidateQueries({ queryKey: ["prospect-lists"] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast.error("Kunde inte radera listan", { description: err.message });
    },
  });

  return (
    <AppLayout title="Prospektlistor">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">Prospektlistor</h1>
            <p className="text-sm text-muted-foreground">
              Bygg en riktad lista, gallra den och importera de bästa som leads
            </p>
          </div>
          <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ny lista
          </Button>
        </div>

        {/* Lists */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-border rounded-xl bg-card/50">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">Inga prospektlistor ännu</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Skapa en lista och fyll den från Prospektering
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Skapa lista
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {lists.map((list) => (
              <Card key={list.id} className="hover:border-border/80 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold truncate">{list.name}</h3>
                        <Badge
                          variant={
                            LIST_STATUS_VARIANTS[list.status as ProspectListStatus] ?? "outline"
                          }
                          className="text-xs shrink-0"
                        >
                          {listStatusLabel(list.status)}
                        </Badge>
                        {list.shared_to_team && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            <Users className="h-3 w-3 mr-1" />
                            Delad
                          </Badge>
                        )}
                      </div>
                      {list.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {list.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {list.item_count} företag
                        {list.imported_lead_count > 0 &&
                          ` · ${list.imported_lead_count} importerade som leads`}
                        {" · "}
                        Skapad {format(new Date(list.created_at), "d MMM yyyy", { locale: sv })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" asChild>
                        <Link to={`/prospect-lists/${list.id}`}>
                          Öppna
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Link>
                      </Button>
                      {(isAdmin || list.created_by === user?.id) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(list)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ny prospektlista</DialogTitle>
            <DialogDescription>
              Samla företag att bearbeta innan de blir leads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Namn</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="t.ex. Frisörer Göteborg Q3"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Beskrivning</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Valfri beskrivning av urvalet"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Dela med teamet</p>
                <p className="text-xs text-muted-foreground">
                  Alla i organisationen kan se listan
                </p>
              </div>
              <Switch checked={sharedToTeam} onCheckedChange={setSharedToTeam} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              Skapa lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera prospektlista?</AlertDialogTitle>
            <AlertDialogDescription>
              Listan "{deleteTarget?.name}" och alla {deleteTarget?.item_count ?? 0} företag i
              den tas bort permanent. Redan importerade leads påverkas inte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
