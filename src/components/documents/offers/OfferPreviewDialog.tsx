import { useTranslation } from "@/i18n/LanguageProvider";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, X, Loader2 } from "lucide-react";
import { type Document as DocType } from "../types";
import { type DocumentBlock } from "../blocks/types";
import { BlockRenderer } from "../blocks/BlockRenderer";
import { calculateDocumentTotals } from "../blocks/totals";
import { resolveDocumentContext, resolveBlockTokens } from "../context-resolver";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface OfferPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  doc: DocType;
  blocks: DocumentBlock[];
}

export function OfferPreviewDialog({ open, onClose, doc, blocks }: OfferPreviewDialogProps) {
  const { t } = useTranslation();
  const [resolvedBlocks, setResolvedBlocks] = useState<DocumentBlock[]>(blocks);
  const [orgName, setOrgName] = useState("");
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setResolving(true);

    const resolve = async () => {
      try {
        const context = await resolveDocumentContext(doc.id, blocks);
        setResolvedBlocks(resolveBlockTokens(blocks, context));
      } catch {
        setResolvedBlocks(blocks);
      }

      let logo: string | null = null;

      if (doc.organization_id) {
        const { data } = await supabase
          .from("organizations")
          .select("name, logo_url")
          .eq("id", doc.organization_id)
          .maybeSingle();
        if (data) {
          setOrgName(data.name || "");
          logo = data.logo_url;
        }
      }

      // If no org logo, try user's profile logo
      if (!logo && doc.created_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_logo_url")
          .eq("id", doc.created_by)
          .maybeSingle();
        if (profile?.company_logo_url) {
          logo = profile.company_logo_url;
        }
      }

      setOrgLogo(logo);
      setResolving(false);
    };

    resolve();
  }, [open, doc.id, doc.organization_id]);

  const totals = calculateDocumentTotals(resolvedBlocks);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${doc.title || t("templates.offerFallbackTitle")}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.5; }
          .header { margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #e5e5e5; }
          .logo { max-height: 48px; max-width: 200px; object-fit: contain; margin-bottom: 12px; }
          .org-name { font-size: 12px; color: #666; }
          .title { font-size: 22px; font-weight: 700; margin: 4px 0; }
          .doc-number { font-size: 12px; color: #888; }
          .meta { font-size: 13px; color: #555; margin-bottom: 24px; }
          .block { margin-bottom: 12px; }
          h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
          h2 { font-size: 17px; font-weight: 600; margin-bottom: 6px; }
          p { font-size: 14px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
          th { text-align: left; padding: 8px; background: #f5f5f5; border-bottom: 2px solid #ddd; font-weight: 600; }
          td { padding: 8px; border-bottom: 1px solid #eee; }
          .kv-row { display: flex; gap: 12px; font-size: 14px; margin-bottom: 2px; }
          .kv-label { font-weight: 600; min-width: 120px; color: #555; }
          hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
          .spacer { height: 24px; }
          .totals { margin-top: 16px; text-align: right; font-size: 14px; }
          .totals .row { display: flex; justify-content: flex-end; gap: 24px; margin-bottom: 4px; }
          .totals .label { color: #666; }
          .totals .grand { font-size: 18px; font-weight: 700; border-top: 2px solid #111; padding-top: 6px; margin-top: 6px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 bg-background border-b p-4 flex flex-row items-center justify-between">
          <DialogTitle className="text-base">Förhandsvisning</DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} disabled={resolving}>
              <Download className="h-4 w-4 mr-1" /> Spara som PDF
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {resolving ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div ref={printRef} className="p-8">
            {/* Header */}
            <div className="header mb-8 pb-4 border-b border-border">
              {orgLogo && (
                <img src={orgLogo} alt={orgName} className="logo max-h-12 max-w-[200px] object-contain mb-3" crossOrigin="anonymous" />
              )}
              <p className="org-name text-xs text-muted-foreground">{orgName}</p>
              <h1 className="title text-2xl font-bold">{doc.title}</h1>
              {doc.document_number && (
                <p className="doc-number text-xs text-muted-foreground">#{doc.document_number}</p>
              )}
            </div>

            {/* Meta */}
            <div className="meta text-sm text-muted-foreground mb-6 space-y-1">
              {doc.recipient_name && <p>Till: <span className="text-foreground">{doc.recipient_name}</span></p>}
              {doc.valid_until && (
                <p>Giltig t.o.m: <span className="text-foreground">{format(new Date(doc.valid_until), "d MMMM yyyy", { locale: sv })}</span></p>
              )}
            </div>

            {/* Blocks */}
            <div className="space-y-3">
              {resolvedBlocks.map((block) => (
                <div key={block.id} className="block">
                  <BlockRenderer block={block} readOnly />
                </div>
              ))}
            </div>

            {/* Totals */}
            {resolvedBlocks.some((b) => b.type === "article_table") && (
              <div className="totals mt-8 text-right">
                <div className="row flex justify-end gap-8 text-sm">
                  <span className="label text-muted-foreground">Netto</span>
                  <span>{totals.subtotal.toLocaleString("sv-SE")} kr</span>
                </div>
                <div className="row flex justify-end gap-8 text-sm">
                  <span className="label text-muted-foreground">Moms</span>
                  <span>{totals.vat_total.toLocaleString("sv-SE")} kr</span>
                </div>
                <Separator className="my-2 ml-auto w-48" />
                <div className="grand flex justify-end gap-8 text-lg font-bold">
                  <span>Totalt</span>
                  <span>{totals.total.toLocaleString("sv-SE")} {doc.currency || "SEK"}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}