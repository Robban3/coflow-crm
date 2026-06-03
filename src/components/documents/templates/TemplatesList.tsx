import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { fromTable } from "../supabaseHelper";
import { type DocumentTemplate } from "../types";
import { getStarterTemplates } from "../template-starters";
import { TemplateCreationWizard } from "./TemplateCreationWizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FileText, Pencil, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TemplatesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = useOrganizationId();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["document_templates", orgId],
    queryFn: async () => {
      const { data, error } = await fromTable("document_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentTemplate[];
    },
    enabled: !!orgId,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const starters = getStarterTemplates();
      for (const starter of starters) {
        const { data, error } = await fromTable("document_templates")
          .insert({
            name: starter.name,
            type: starter.type,
            description: starter.description,
            organization_id: orgId!,
            created_by: user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        const tpl = data as DocumentTemplate;

        await fromTable("template_versions").insert({
          template_id: tpl.id,
          version: 1,
          blocks_json: starter.blocks,
          created_by: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_templates"] });
      toast.success("3 rekommenderade mallar skapade!");
    },
    onError: () => toast.error("Kunde inte skapa startmallar"),
  });

  const typeLabels: Record<string, string> = {
    offer: "Offert",
    contract: "Avtal",
    other: "Övrigt",
  };

  const isEmpty = !isLoading && (!templates || templates.length === 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mallar</h1>
          <p className="text-muted-foreground text-sm">
            Skapa och hantera dokumentmallar för offerter och avtal
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)}>
          <Plus className="h-4 w-4 mr-1" /> Ny mall
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Laddar...</p>
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="font-semibold text-lg mb-2">Kom igång snabbt</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              Vi har förberett professionella mallar med CRM-fält som automatiskt fylls i med kunddata.
              Skapa rekommenderade mallar med ett klick eller bygg din egen från grunden.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="gap-2"
              >
                {seedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Skapa rekommenderade mallar
              </Button>
              <Button variant="outline" onClick={() => setShowWizard(true)}>
                <Plus className="h-4 w-4 mr-1" /> Skapa egen mall
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates!.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/settings/templates/${t.id}`)}
            >
              <CardContent className="py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{t.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {typeLabels[t.type] || t.type}
                    {t.description && ` • ${t.description}`}
                    {" • "}Skapad{" "}
                    {new Date(t.created_at).toLocaleDateString("sv-SE")}
                  </p>
                </div>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TemplateCreationWizard open={showWizard} onOpenChange={setShowWizard} />
    </div>
  );
}
