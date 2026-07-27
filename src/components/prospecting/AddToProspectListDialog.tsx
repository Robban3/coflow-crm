import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import type { NewProspectListItem, ProspectList } from "@/lib/prospectLists";

interface AddToProspectListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Företagen som ska läggas till, redan mappade på item-kolumnerna. */
  items: NewProspectListItem[];
  /** Körs efter lyckad insert, t.ex. för att rensa markeringen. */
  onAdded?: () => void;
}

const NEW_LIST = "__new__";

export function AddToProspectListDialog({
  open,
  onOpenChange,
  items,
  onAdded,
}: AddToProspectListDialogProps) {
  const orgId = useOrganizationId();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [listId, setListId] = useState<string>(NEW_LIST);
  const [newName, setNewName] = useState("");
  const [sharedToTeam, setSharedToTeam] = useState(false);

  // Man kan bara skriva till listor man äger (eller alla, som admin) – samma
  // regel som RLS-policyn på prospect_list_items.
  const { data: lists = [] } = useQuery<ProspectList[]>({
    queryKey: ["prospect-lists", orgId],
    enabled: !!orgId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("prospect_lists")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProspectList[];
    },
  });

  const writableLists = lists.filter((l) => isAdmin || l.created_by === user?.id);

  useEffect(() => {
    if (open && writableLists.length > 0 && listId === NEW_LIST && !newName) {
      setListId(writableLists[0].id);
    }
    // Avsiktligt bara vid öppning/listbyte – annars låser vi användarens val.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, writableLists.length]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !user) throw new Error("Ingen organisation");
      if (!items.length) throw new Error("Inga företag valda");

      let targetId = listId;
      if (targetId === NEW_LIST) {
        if (!newName.trim()) throw new Error("Ange ett namn på listan");
        const { data, error } = await (supabase as any)
          .from("prospect_lists")
          .insert({
            organization_id: orgId,
            created_by: user.id,
            name: newName.trim(),
            shared_to_team: sharedToTeam,
          })
          .select("id")
          .single();
        if (error) throw error;
        targetId = (data as { id: string }).id;
      }

      // (list_id, org_number) har ett unikt index. Filtrera bort företag som
      // redan ligger i listan i stället för att fälla hela inserten på en
      // dubblett.
      const { data: existing, error: existingError } = await (supabase as any)
        .from("prospect_list_items")
        .select("org_number")
        .eq("list_id", targetId)
        .not("org_number", "is", null);
      if (existingError) throw existingError;

      const seen = new Set<string>(
        ((existing ?? []) as { org_number: string }[]).map((r) => r.org_number),
      );

      const rows: Record<string, unknown>[] = [];
      for (const item of items) {
        const orgNumber = item.org_number ?? null;
        if (orgNumber) {
          if (seen.has(orgNumber)) continue;
          seen.add(orgNumber);
        }
        rows.push({
          list_id: targetId,
          organization_id: orgId,
          company_name: item.company_name,
          org_number: orgNumber,
          city: item.city ?? null,
          address: item.address ?? null,
          postal_code: item.postal_code ?? null,
          phone: item.phone ?? null,
          email: item.email ?? null,
          industry: item.industry ?? null,
          sni_codes: item.sni_codes ?? null,
          website: item.website ?? null,
          // Always "unknown" on insert — a URL from a search result is an
          // unverified candidate. resolve-prospect-websites promotes it to
          // "linked"/"discovered" only after fetching and verifying it.
          website_status: "unknown",
          source: item.source,
          source_data: item.source_data ?? null,
        });
      }

      if (rows.length > 0) {
        const { error } = await (supabase as any)
          .from("prospect_list_items")
          .insert(rows);
        if (error) throw error;
      }

      return { count: rows.length, skipped: items.length - rows.length, listId: targetId };
    },
    onSuccess: ({ count, skipped }) => {
      toast.success(`${count} företag lades i prospektlistan`, {
        description: skipped > 0 ? `${skipped} fanns redan i listan` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["prospect-list-items"] });
      setNewName("");
      onOpenChange(false);
      onAdded?.();
    },
    onError: (err: Error) => {
      toast.error("Kunde inte lägga till i listan", { description: err.message });
    },
  });

  const canSubmit =
    items.length > 0 &&
    !addMutation.isPending &&
    (listId !== NEW_LIST || !!newName.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg i prospektlista</DialogTitle>
          <DialogDescription>
            {items.length} företag läggs till utan att bli leads ännu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Lista</Label>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {writableLists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} ({l.item_count})
                  </SelectItem>
                ))}
                <SelectItem value={NEW_LIST}>
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Ny lista…
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {listId === NEW_LIST && (
            <>
              <div className="space-y-1.5">
                <Label>Namn på ny lista</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="t.ex. Frisörer Göteborg Q3"
                  autoFocus
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
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={() => addMutation.mutate()} disabled={!canSubmit}>
            {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Lägg till
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
