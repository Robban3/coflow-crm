import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "../supabaseHelper";
import { type Document as DocType, type DocumentBlockRow } from "../types";
import { type DocumentBlock, type BlockType } from "../blocks/types";
import { calculateDocumentTotals } from "../blocks/totals";
import { SortableBlockList } from "../shared/SortableBlockList";
import { SendOfferDialog } from "./SendOfferDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Send, Search, UserPlus, Eye } from "lucide-react";
import { toast } from "sonner";
import { OfferPreviewDialog } from "./OfferPreviewDialog";
import { useTranslation } from "@/i18n/LanguageProvider";

const statusLabelKeys: Record<string, string> = {
  draft: "templates.offerStatus.draft",
  sent: "templates.offerStatus.sent",
  viewed: "templates.offerStatus.viewed",
  accepted: "templates.offerStatus.accepted",
  rejected: "templates.offerStatus.rejected",
  expired: "templates.offerStatus.expired",
};

interface LeadResult {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
}

export function OfferEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [title, setTitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Lead search
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<LeadResult[]>([]);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [linkedLead, setLinkedLead] = useState<LeadResult | null>(null);
  const leadSearchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: doc } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      const { data, error } = await fromTable("documents")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as DocType;
    },
    enabled: !!id,
  });

  const { data: dbBlocks } = useQuery({
    queryKey: ["document_blocks", id],
    queryFn: async () => {
      const { data, error } = await fromTable("document_blocks")
        .select("*")
        .eq("document_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data as DocumentBlockRow[];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setRecipientName(doc.recipient_name || "");
      setRecipientEmail(doc.recipient_email || "");
      // Load linked lead
      if (doc.lead_id) {
        supabase
          .from("leads")
          .select("id, company_name, contact_name, email, phone")
          .eq("id", doc.lead_id)
          .single()
          .then(({ data }) => {
            if (data) setLinkedLead(data);
          });
      }
    }
  }, [doc]);

  useEffect(() => {
    if (dbBlocks) {
      setBlocks(
        dbBlocks.map((b) => ({
          id: b.id,
          type: b.type as BlockType,
          sort_order: b.sort_order,
          config: b.config as any,
        }))
      );
    }
  }, [dbBlocks]);

  // Close lead dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (leadSearchRef.current && !leadSearchRef.current.contains(e.target as Node)) {
        setShowLeadDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchLeads = (query: string) => {
    setLeadSearch(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) {
      setLeadResults([]);
      setShowLeadDropdown(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, company_name, contact_name, email, phone")
        .or(`company_name.ilike.%${query}%,contact_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(8);
      if (data) {
        setLeadResults(data);
        setShowLeadDropdown(true);
      }
    }, 300);
  };

  const selectLead = async (lead: LeadResult) => {
    setLinkedLead(lead);
    setShowLeadDropdown(false);
    setLeadSearch("");
    // Auto-fill recipient
    if (lead.company_name) setRecipientName(lead.company_name);
    if (lead.email) setRecipientEmail(lead.email);
    // Update doc with lead_id
    await fromTable("documents").update({ lead_id: lead.id }).eq("id", id!);
    setDirty(true);
    toast.success(t("templates.offerEditor.linkedTo", { name: lead.company_name || lead.contact_name || "" }));
  };

  const isLocked = doc?.status !== "draft";

  const handleReorder = (_activeId: string, _overId: string) => {};

  const handleUpdateBlock = (blockId: string, config: DocumentBlock["config"]) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, config } : b)));
    setDirty(true);
  };

  const noop = () => {};

  const saveMutation = useMutation({
    mutationFn: async () => {
      const totals = calculateDocumentTotals(blocks);

      await fromTable("documents")
        .update({
          title,
          recipient_name: recipientName || null,
          recipient_email: recipientEmail || null,
          subtotal: totals.subtotal,
          vat_total: totals.vat_total,
          total: totals.total,
        })
        .eq("id", id!);

      await fromTable("document_blocks").delete().eq("document_id", id!);

      if (blocks.length > 0) {
        const inserts = blocks.map((b, i) => ({
          id: b.id,
          document_id: id!,
          type: b.type,
          sort_order: i,
          config: b.config,
        }));
        const { error } = await fromTable("document_blocks").insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      queryClient.invalidateQueries({ queryKey: ["document_blocks", id] });
      setDirty(false);
      toast.success(t("templates.offerEditor.saved"));
    },
    onError: () => toast.error(t("templates.offerEditor.saveError")),
  });

  const totals = calculateDocumentTotals(blocks);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header row: back + actions. Wraps on narrow screens so the action
          buttons (incl. Send) never get pushed off-screen on mobile. */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/offers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t(statusLabelKeys[doc?.status || "draft"])}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="h-4 w-4 mr-1" /> {t("templates.offerEditor.preview")}
          </Button>
          {!isLocked && (
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" /> {t("templates.offerEditor.save")}
            </Button>
          )}
          {doc?.status === "draft" && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                if (dirty) {
                  toast.error(t("templates.offerEditor.saveBeforeSend"));
                  return;
                }
                setShowSendDialog(true);
              }}
            >
              <Send className="h-4 w-4 mr-1" /> {t("templates.offerEditor.send")}
            </Button>
          )}
        </div>
      </div>

      {/* Title on its own row */}
      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        className="text-xl font-bold border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 px-2 h-auto rounded hover:bg-muted/50 transition-colors mb-6 w-full"
        placeholder={t("templates.offerEditor.titlePlaceholder")}
        disabled={isLocked}
      />

      {/* Lead + Recipient section */}
      {!isLocked && (
        <div className="bg-muted/30 rounded-lg p-4 mb-6 space-y-4">
          {/* Lead search */}
          <div ref={leadSearchRef} className="relative">
            <Label className="text-xs font-medium mb-1 block">{t("templates.offerEditor.linkToLead")}</Label>
            {linkedLead ? (
              <div className="flex items-center gap-2 bg-background rounded-md border border-border px-3 py-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{linkedLead.company_name || linkedLead.contact_name}</span>
                {linkedLead.email && (
                  <span className="text-xs text-muted-foreground">({linkedLead.email})</span>
                )}
                {!isLocked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 text-xs"
                    onClick={() => setLinkedLead(null)}
                  >
                    {t("templates.offerEditor.change")}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={leadSearch}
                    onChange={(e) => searchLeads(e.target.value)}
                    placeholder={t("templates.offerEditor.leadSearchPlaceholder")}
                    className="pl-9"
                  />
                </div>
                {showLeadDropdown && leadResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {leadResults.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => selectLead(lead)}
                        className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                      >
                        <span className="font-medium">{lead.company_name || "–"}</span>
                        {lead.contact_name && (
                          <span className="text-muted-foreground ml-2">· {lead.contact_name}</span>
                        )}
                        {lead.email && (
                          <span className="text-muted-foreground ml-2">· {lead.email}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recipient fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">{t("templates.offerEditor.recipientName")}</Label>
              <Input
                value={recipientName}
                onChange={(e) => {
                  setRecipientName(e.target.value);
                  setDirty(true);
                }}
                placeholder={t("templates.offerEditor.recipientNamePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("templates.offerEditor.email")}</Label>
              <Input
                value={recipientEmail}
                onChange={(e) => {
                  setRecipientEmail(e.target.value);
                  setDirty(true);
                }}
                placeholder={t("offers.editor.emailPlaceholder")}
              />
            </div>
          </div>
        </div>
      )}

      {/* Blocks */}
      {blocks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{t("templates.offerEditor.emptyBlocks")}</p>
        </div>
      ) : (
        <SortableBlockList
          blocks={blocks}
          onReorder={handleReorder}
          onUpdateBlock={handleUpdateBlock}
          onDuplicateBlock={noop}
          onDeleteBlock={noop}
          readOnly={isLocked}
          structureLocked={!isLocked}
        />
      )}

      {blocks.some((b) => b.type === "article_table") && (
        <div className="mt-6 flex justify-end">
          <div className="text-sm space-y-1 bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">{t("templates.offerEditor.subtotal")}</span>
              <span className="font-medium">{totals.subtotal.toLocaleString("sv-SE")} kr</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">{t("templates.offerEditor.vat")}</span>
              <span className="font-medium">{totals.vat_total.toLocaleString("sv-SE")} kr</span>
            </div>
            <div className="flex justify-between gap-8 border-t border-border pt-1 mt-1">
              <span className="font-semibold">{t("templates.offerEditor.total")}</span>
              <span className="font-bold text-lg">{totals.total.toLocaleString("sv-SE")} kr</span>
            </div>
          </div>
        </div>
      )}

      {showSendDialog && doc && (
        <SendOfferDialog
          documentId={doc.id}
          recipientEmail={recipientEmail}
          recipientName={recipientName}
          viewToken={doc.view_token}
          onSent={() => {
            setShowSendDialog(false);
            queryClient.invalidateQueries({ queryKey: ["document", id] });
          }}
          onClose={() => setShowSendDialog(false)}
        />
      )}

      {showPreview && doc && (
        <OfferPreviewDialog
          open={showPreview}
          onClose={() => setShowPreview(false)}
          doc={doc}
          blocks={blocks}
        />
      )}
    </div>
  );
}
