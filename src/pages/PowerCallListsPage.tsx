import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Plus,
  List,
  ArrowLeft,
  PhoneCall,
  Trash2,
  Users,
  Loader2,
  Filter,
  Hash,
} from "lucide-react";

interface PowerCallList {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  shared_to_team: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  static: "Statisk lista",
  filter: "Dynamisk (filter)",
  import: "Import",
};

export default function PowerCallListsPage() {
  const organizationId = useOrganizationId();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = userRole === "admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState("static");
  const [sharedToTeam, setSharedToTeam] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data: lists = [], isLoading } = useQuery<PowerCallList[]>({
    queryKey: ["power-call-lists", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("power_call_lists")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const handleCreate = async () => {
    if (!name.trim() || !organizationId || !user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("power_call_lists").insert({
        organization_id: organizationId,
        created_by: user.id,
        name: name.trim(),
        description: description.trim() || null,
        source_type: sourceType,
        shared_to_team: sharedToTeam,
      });
      if (error) throw error;
      toast({ title: "Lista skapad" });
      queryClient.invalidateQueries({ queryKey: ["power-call-lists"] });
      setCreateOpen(false);
      setName("");
      setDescription("");
      setSourceType("static");
      setSharedToTeam(true);
    } catch (err) {
      toast({ title: "Fel", description: "Kunde inte skapa lista", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ta bort listan?")) return;
    const { error } = await supabase.from("power_call_lists").delete().eq("id", id);
    if (error) {
      toast({ title: "Fel", description: "Kunde inte ta bort listan", variant: "destructive" });
    } else {
      toast({ title: "Lista borttagen" });
      queryClient.invalidateQueries({ queryKey: ["power-call-lists"] });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/outreach-pro"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Ringlistor</h1>
              <p className="text-sm text-muted-foreground">Köer av leads för Power Call-sessioner</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
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
          <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card/50">
            <List className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold mb-1">Inga listor ännu</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Skapa din första ringlista för att starta Power Call-sessioner
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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{list.name}</h3>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {list.source_type === "filter" ? (
                            <Filter className="h-3 w-3 mr-1" />
                          ) : (
                            <Hash className="h-3 w-3 mr-1" />
                          )}
                          {SOURCE_TYPE_LABELS[list.source_type] || list.source_type}
                        </Badge>
                        {list.shared_to_team && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            <Users className="h-3 w-3 mr-1" />
                            Delad
                          </Badge>
                        )}
                      </div>
                      {list.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{list.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Skapad {format(new Date(list.created_at), "d MMM yyyy", { locale: sv })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" asChild>
                        <Link to={`/outreach-pro/power-call?list=${list.id}`}>
                          <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                          Ringa
                        </Link>
                      </Button>
                      {(isAdmin || list.created_by === user?.id) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(list.id)}
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
            <DialogTitle>Ny ringlista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Namn *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="T.ex. Restauranger Stockholm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Beskrivning</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Valfri beskrivning..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Statisk lista (välj leads manuellt)</SelectItem>
                  <SelectItem value="filter">Dynamisk (filtrerade leads)</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Dela med teamet</p>
                <p className="text-xs text-muted-foreground">Alla i organisationen kan se och använda listan</p>
              </div>
              <Switch checked={sharedToTeam} onCheckedChange={setSharedToTeam} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Avbryt</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Skapa lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
