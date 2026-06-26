import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Document as DocType, type DocumentBlockRow } from "@/components/documents/types";
import { type DocumentBlock, type BlockType } from "@/components/documents/blocks/types";
import { BlockRenderer } from "@/components/documents/blocks/BlockRenderer";
import { calculateDocumentTotals } from "@/components/documents/blocks/totals";
import { resolveDocumentContext, resolveBlockTokens } from "@/components/documents/context-resolver";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, FileText, Clock } from "lucide-react";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import { SignatureCanvas } from "@/components/quotes/SignatureCanvas";

interface OrgInfo {
  name: string;
  logo_url: string | null;
}

export default function PublicOfferPage() {
  const { token } = useParams<{ token: string }>();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const [doc, setDoc] = useState<DocType | null>(null);
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [signingMode, setSigningMode] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadDocument();
    trackView();
  }, [token]);

  const loadDocument = async () => {
    try {
      const { data: docs, error } = await (supabase as any).rpc("public_get_document_by_token", {
        p_token: token,
      });
      const d = docs?.[0];

      if (error || !d) {
        setNotFound(true);
        return;
      }
      setDoc(d as DocType);

      // Load blocks
      const { data: bData } = await (supabase as any).rpc("public_get_document_blocks_by_token", {
        p_token: token,
      });

      if (bData) {
        const rawBlocks = (bData as DocumentBlockRow[]).map((b) => ({
          id: b.id,
          type: b.type as BlockType,
          sort_order: b.sort_order,
          config: b.config as any,
        }));

        // Resolve CRM tokens for public rendering
        try {
          const context = await resolveDocumentContext(d.id, rawBlocks);
          setBlocks(resolveBlockTokens(rawBlocks, context));
        } catch {
          setBlocks(rawBlocks);
        }
      }

      // Load org info
      if (d.organization_id) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name, logo_url")
          .eq("id", d.organization_id)
          .maybeSingle();
        if (orgData) setOrg(orgData);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const trackView = async () => {
    if (!token) return;
    try {
      // View tracking + first-view notification are handled server-side in the RPC
      await (supabase as any).rpc("public_track_document_view", { p_token: token });
    } catch {
      // silent
    }
  };

  const handleAcceptWithSignature = async (signatureData: string) => {
    if (!doc) return;
    // Accept + creator notification handled server-side in the RPC (token-scoped, secure)
    const { error } = await (supabase as any).rpc("public_respond_document", {
      p_token: token,
      p_action: "accepted",
      p_signature_data: signatureData,
    });
    if (!error) {
      toast.success(t("publicPages.offer.acceptedSigned"));
      setDoc({
        ...doc,
        status: "accepted",
        signature_status: "signed",
        recipient_signature_data: signatureData,
        recipient_signed_at: new Date().toISOString(),
      });
      setSigningMode(false);
    }
  };

  const handleReject = async () => {
    if (!doc) return;
    // Reject + creator notification handled server-side in the RPC (token-scoped, secure)
    const { error } = await (supabase as any).rpc("public_respond_document", {
      p_token: token,
      p_action: "rejected",
    });
    if (!error) {
      toast.info(t("publicPages.offer.rejected"));
      setDoc({ ...doc, status: "rejected" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("publicPages.offer.loading")}</div>
      </div>
    );
  }

  if (notFound || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("publicPages.offer.notFoundTitle")}</h2>
            <p className="text-muted-foreground">{t("publicPages.offer.notFoundBody")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = doc.valid_until && new Date(doc.valid_until) < new Date();
  const canRespond = ["sent", "viewed"].includes(doc.status) && !isExpired;

  const totals = calculateDocumentTotals(blocks);

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: t("publicPages.offer.statusDraft"), variant: "secondary" },
    sent: { label: t("publicPages.offer.statusSent"), variant: "default" },
    viewed: { label: t("publicPages.offer.statusViewed"), variant: "outline" },
    accepted: { label: t("publicPages.offer.statusAccepted"), variant: "default" },
    rejected: { label: t("publicPages.offer.statusRejected"), variant: "destructive" },
    expired: { label: t("publicPages.offer.statusExpired"), variant: "secondary" },
  };

  const statusInfo = statusConfig[doc.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="pb-4">
            {org?.logo_url && (
              <div className="flex justify-center mb-4 pb-4 border-b">
                <img
                  src={org.logo_url}
                  alt={org.name || t("publicPages.offer.company")}
                  className="max-h-16 max-w-[240px] object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            )}
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{org?.name || t("publicPages.offer.company")}</p>
                <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
                {doc.document_number && (
                  <p className="text-sm text-muted-foreground">#{doc.document_number}</p>
                )}
              </div>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {doc.recipient_name && (
              <p><span className="text-muted-foreground">{t("publicPages.offer.to")}</span> {doc.recipient_name}</p>
            )}
            {doc.valid_until && (
              <p className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t("publicPages.offer.validUntil")}</span>{" "}
                <span className={isExpired ? "text-destructive font-medium" : ""}>
                  {format(new Date(doc.valid_until), "d MMMM yyyy", { locale: dateLocale })}
                  {isExpired && t("publicPages.offer.expiredSuffix")}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Block content */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {blocks.map((block) => (
              <BlockRenderer key={block.id} block={block} readOnly />
            ))}
          </CardContent>
        </Card>

        {/* Totals */}
        {blocks.some((b) => b.type === "article_table") && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("publicPages.offer.net")}</span>
                  <span>{totals.subtotal.toLocaleString("sv-SE")} kr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("publicPages.offer.vat")}</span>
                  <span>{totals.vat_total.toLocaleString("sv-SE")} kr</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("publicPages.offer.total")}</span>
                  <span>{totals.total.toLocaleString("sv-SE")} {doc.currency || "SEK"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes & Terms */}
        {(doc.notes || doc.terms) && (
          <Card>
            <CardContent className="pt-6 space-y-4 text-sm">
              {doc.notes && (
                <div>
                  <h3 className="font-medium mb-1">{t("publicPages.offer.message")}</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{doc.notes}</p>
                </div>
              )}
              {doc.terms && (
                <div>
                  <h3 className="font-medium mb-1">{t("publicPages.offer.terms")}</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{doc.terms}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Signatures */}
        {doc.status === "accepted" && doc.recipient_signature_data && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-3">{t("publicPages.offer.signature")}</h3>
              <div className="border rounded-lg p-4 bg-background">
                <img src={doc.recipient_signature_data} alt={t("publicPages.offer.signatureAlt")} className="max-h-24" />
                {doc.recipient_signed_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("publicPages.offer.signedAt", { date: format(new Date(doc.recipient_signed_at), "d MMMM yyyy, HH:mm", { locale: dateLocale }) })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {canRespond && !signingMode && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                {t("publicPages.offer.reviewPrompt")}
              </p>
              <div className="flex gap-3">
                <Button onClick={() => setSigningMode(true)} className="flex-1">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t("publicPages.offer.acceptAndSign")}
                </Button>
                <Button variant="destructive" onClick={handleReject} className="flex-1">
                  <XCircle className="h-4 w-4 mr-2" />
                  {t("publicPages.offer.reject")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {signingMode && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-3">{t("publicPages.offer.signTitle")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("publicPages.offer.signPrompt")}
              </p>
              <SignatureCanvas onSave={handleAcceptWithSignature} />
              <Button variant="outline" className="mt-3" onClick={() => setSigningMode(false)}>
                {t("publicPages.offer.cancel")}
              </Button>
            </CardContent>
          </Card>
        )}

        {doc.status === "rejected" && (
          <Card>
            <CardContent className="pt-6 text-center">
              <XCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
              <p className="font-medium">{t("publicPages.offer.rejectedTitle")}</p>
              {doc.rejected_at && (
                <p className="text-sm text-muted-foreground">
                  {format(new Date(doc.rejected_at), "d MMMM yyyy", { locale: dateLocale })}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
