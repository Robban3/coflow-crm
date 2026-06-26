import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fromTable } from "../supabaseHelper";
import { type DocumentTemplate, type TemplateVersion } from "../types";
import { type DocumentBlock, type BlockType } from "../blocks/types";
import { getBlockEntry } from "../blocks/registry";
import { SortableBlockList } from "../shared/SortableBlockList";
import { BlockEditorToolbar } from "../shared/BlockEditorToolbar";
import { BrandSettingsPanel } from "./BrandSettingsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function TemplateEditor() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [name, setName] = useState("");
  const [brandSettings, setBrandSettings] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);

  const { data: template } = useQuery({
    queryKey: ["document_template", id],
    queryFn: async () => {
      const { data, error } = await fromTable("document_templates")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as DocumentTemplate;
    },
    enabled: !!id,
  });

  const { data: latestVersion } = useQuery({
    queryKey: ["template_version_latest", id],
    queryFn: async () => {
      const { data, error } = await fromTable("template_versions")
        .select("*")
        .eq("template_id", id!)
        .order("version", { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as TemplateVersion | null;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (template) {
      setName(template.name);
      setBrandSettings(template.brand_settings || {});
    }
  }, [template]);

  useEffect(() => {
    if (latestVersion) {
      const parsed = latestVersion.blocks_json || [];
      setBlocks(
        parsed.map((b: any, i: number) => ({
          id: b.id || crypto.randomUUID(),
          type: b.type,
          sort_order: i,
          config: b.config || {},
        }))
      );
    }
  }, [latestVersion]);

  const addBlock = useCallback(
    (type: BlockType) => {
      const entry = getBlockEntry(type);
      if (!entry) return;
      const newBlock: DocumentBlock = {
        id: crypto.randomUUID(),
        type,
        sort_order: blocks.length,
        config: entry.defaultConfig(),
      };
      setBlocks((prev) => [...prev, newBlock]);
      setDirty(true);
    },
    [blocks.length]
  );

  const handleReorder = (activeId: string, overId: string) => {
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === activeId);
      const newIndex = prev.findIndex((b) => b.id === overId);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(oldIndex, 1);
      updated.splice(newIndex, 0, moved);
      return updated.map((b, i) => ({ ...b, sort_order: i }));
    });
    setDirty(true);
  };

  const handleUpdateBlock = (blockId: string, config: DocumentBlock["config"]) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, config } : b))
    );
    setDirty(true);
  };

  const handleDuplicate = (blockId: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const dup: DocumentBlock = {
        ...prev[idx],
        id: crypto.randomUUID(),
        sort_order: idx + 1,
      };
      const updated = [...prev];
      updated.splice(idx + 1, 0, dup);
      return updated.map((b, i) => ({ ...b, sort_order: i }));
    });
    setDirty(true);
  };

  const handleDelete = (blockId: string) => {
    setBlocks((prev) =>
      prev.filter((b) => b.id !== blockId).map((b, i) => ({ ...b, sort_order: i }))
    );
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      await fromTable("document_templates")
        .update({ name, brand_settings: brandSettings })
        .eq("id", id!);

      const nextVersion = (latestVersion?.version || 0) + 1;
      const blocksJson = blocks.map((b) => ({
        id: b.id,
        type: b.type,
        config: b.config,
      }));

      await fromTable("template_versions").insert({
        template_id: id!,
        version: nextVersion,
        blocks_json: blocksJson,
        created_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template_version_latest", id] });
      queryClient.invalidateQueries({ queryKey: ["document_template", id] });
      setDirty(false);
      toast.success(t("templates.editor.savedTitle"));
    },
    onError: () => toast.error(t("templates.editor.saveError")),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          className="text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
          placeholder={t("templates.editor.namePlaceholder")}
        />
        <div className="ml-auto flex gap-2 w-full sm:w-auto justify-end">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-1" /> {t("templates.editor.brand")}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>{t("templates.editor.brandSettings")}</SheetTitle>
              </SheetHeader>
              <BrandSettingsPanel
                settings={brandSettings}
                onChange={(s) => {
                  setBrandSettings(s);
                  setDirty(true);
                }}
              />
            </SheetContent>
          </Sheet>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-1" /> {t("templates.editor.save")}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <BlockEditorToolbar onAddBlock={addBlock} />
      </div>

      {blocks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{t("templates.editor.emptyBlocks")}</p>
        </div>
      ) : (
        <SortableBlockList
          blocks={blocks}
          onReorder={handleReorder}
          onUpdateBlock={handleUpdateBlock}
          onDuplicateBlock={handleDuplicate}
          onDeleteBlock={handleDelete}
        />
      )}
    </div>
  );
}
