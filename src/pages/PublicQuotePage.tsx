import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, FileText, Clock, Download } from "lucide-react";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/quotes/SignatureCanvas";
import { useTranslation } from "@/i18n/LanguageProvider";

interface QuoteData {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  currency: string;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  vat_total: number;
  total: number;
  discount_percent: number;
  recipient_name: string | null;
  recipient_email: string | null;
  sender_signature_data: string | null;
  sender_signed_at: string | null;
  recipient_signature_data: string | null;
  recipient_signed_at: string | null;
  organization_id: string | null;
  created_by: string | null;
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  line_total: number;
  sort_order: number;
  billing_type: string;
}

interface OrgInfo {
  name: string;
  logo_url: string | null;
  website: string | null;
}

interface SenderInfo {
  full_name: string | null;
  sender_display_name: string | null;
  company_name: string | null;
  company_logo_url: string | null;
}

export default function PublicQuotePage() {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [senderInfo, setSenderInfo] = useState<SenderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [signingMode, setSigningMode] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadQuote();
    trackView();
  }, [token]);

  const loadQuote = async () => {
    try {
      const { data: quotes, error } = await (supabase as any).rpc("public_get_quote_by_token", {
        p_token: token,
      });
      const q = quotes?.[0];

      if (error || !q) {
        setNotFound(true);
        return;
      }
      setQuote(q as QuoteData);

      const { data: qItems } = await (supabase as any).rpc("public_get_quote_items_by_token", {
        p_token: token,
      });
      setItems((qItems || []) as QuoteItem[]);

      if (q.organization_id) {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name, logo_url, website")
          .eq("id", q.organization_id)
          .maybeSingle();
        if (orgData) setOrg(orgData);
      }

      // Fetch sender profile
      if (q.created_by) {
        const { data: senderData } = await supabase
          .from("profiles")
          .select("full_name, sender_display_name, company_name, company_logo_url")
          .eq("id", q.created_by)
          .maybeSingle();
        if (senderData) setSenderInfo(senderData as SenderInfo);
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
      await (supabase as any).rpc("public_track_quote_view", { p_token: token });
    } catch {
      // silent
    }
  };

  const handleAcceptWithSignature = async (signatureData: string) => {
    if (!quote) return;
    // Accept + creator notification handled server-side in the RPC (token-scoped, secure)
    const { error } = await (supabase as any).rpc("public_respond_quote", {
      p_token: token,
      p_action: "accepted",
      p_signature_data: signatureData,
    });
    if (!error) {
      toast.success((quote as any).document_label === "avtal" ? t("publicPages.quote.agreementAcceptedSigned") : t("publicPages.quote.offerAcceptedSigned"));
      setQuote({
        ...quote,
        status: "accepted",
        recipient_signature_data: signatureData,
        recipient_signed_at: new Date().toISOString(),
      });
      setSigningMode(false);

      // Convert linked lead to customer via edge function (uses service role)
      try {
        await supabase.functions.invoke("convert-lead-on-accept", {
          body: { quoteId: quote.id },
        });
      } catch {
        // Silent - conversion is best-effort from public page
      }
    }
  };

  const handleReject = async () => {
    if (!quote) return;
    // Reject + creator notification handled server-side in the RPC (token-scoped, secure)
    const { error } = await (supabase as any).rpc("public_respond_quote", {
      p_token: token,
      p_action: "rejected",
    });
    if (!error) {
      toast.info((quote as any).document_label === "avtal" ? t("publicPages.quote.agreementRejected") : t("publicPages.quote.offerRejected"));
      setQuote({ ...quote, status: "rejected" });
    }
  };

  const downloadPdf = async () => {
    if (!quote) return;
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quote-pdf", {
        body: { viewToken: token },
      });
      if (error) throw error;

      // Open in new window for print/save as PDF
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        // Wait for images to load before printing
        printWindow.onload = () => {
          setTimeout(() => printWindow.print(), 300);
        };
        // Fallback if onload doesn't fire
        setTimeout(() => printWindow.print(), 2000);
      }
    } catch (err: any) {
      toast.error(t("publicPages.quote.pdfError"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">{t("publicPages.quote.loading")}</div>
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("publicPages.quote.notFoundTitle")}</h2>
            <p className="text-muted-foreground">{t("publicPages.quote.notFoundBody")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const canRespond = ["sent", "viewed"].includes(quote.status) && !isExpired;

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: t("publicPages.quote.statusDraft"), variant: "secondary" },
    sent: { label: t("publicPages.quote.statusSent"), variant: "default" },
    viewed: { label: t("publicPages.quote.statusViewed"), variant: "outline" },
    accepted: { label: t("publicPages.quote.statusAccepted"), variant: "default" },
    won: { label: t("publicPages.quote.statusWon"), variant: "default" },
    rejected: { label: t("publicPages.quote.statusRejected"), variant: "destructive" },
    expired: { label: t("publicPages.quote.statusExpired"), variant: "secondary" },
  };

  const statusInfo = statusConfig[quote.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header with prominent logo */}
        <Card>
          <CardHeader className="pb-4">
            {(senderInfo?.company_logo_url || org?.logo_url) && (
              <div className="flex justify-center mb-4 pb-4 border-b">
                <img
                  src={senderInfo?.company_logo_url || org?.logo_url || ""}
                  alt={org?.name || t("publicPages.quote.company")}
                  className="max-h-16 max-w-[240px] object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            )}
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{org?.name || t("publicPages.quote.company")}</p>
                <h1 className="text-2xl font-bold tracking-tight">{quote.title}</h1>
                <p className="text-sm text-muted-foreground">{(quote as any).document_label === "avtal" ? t("publicPages.quote.agreement") : t("publicPages.quote.offer")} #{quote.quote_number}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloadingPdf}>
                  <Download className="h-4 w-4 mr-1" />
                  {downloadingPdf ? "..." : "PDF"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {quote.recipient_name && (
              <p><span className="text-muted-foreground">{t("publicPages.quote.to")}</span> {quote.recipient_name}</p>
            )}
            {quote.valid_until && (
              <p className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t("publicPages.quote.validUntil")}</span>{" "}
                <span className={isExpired ? "text-destructive font-medium" : ""}>
                  {format(new Date(quote.valid_until), "d MMMM yyyy", { locale: dateLocale })}
                  {isExpired && t("publicPages.quote.expiredSuffix")}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {(() => {
              const oneTimeItems = items.filter((i) => i.billing_type !== "monthly");
              const monthlyItems = items.filter((i) => i.billing_type === "monthly");
              const hasOneTime = oneTimeItems.length > 0;
              const hasMonthly = monthlyItems.length > 0;
              const oneTimeTotal = oneTimeItems.reduce((s, i) => s + Number(i.line_total), 0);
              const monthlyTotal = monthlyItems.reduce((s, i) => s + Number(i.line_total), 0);
              const lineDiscountTotal = items.reduce((s, i) => {
                const gross = Number(i.quantity) * Number(i.unit_price);
                const net = Number(i.line_total);
                return s + Math.max(0, gross - net);
              }, 0);
              const hasAnyLineDiscount = items.some((i) => Number(i.discount_percent) > 0);

              return (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 font-medium">{t("publicPages.quote.colDescription")}</th>
                        <th className="pb-3 font-medium text-right">{t("publicPages.quote.colQuantity")}</th>
                        <th className="pb-3 font-medium text-right">Á-pris</th>
                        <th className="pb-3 font-medium text-right">{t("publicPages.quote.colDiscount")}</th>
                        <th className="pb-3 font-medium text-right">{t("publicPages.quote.colSum")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const lineDiscount = Number(item.discount_percent) || 0;
                        const grossAmount = Number(item.quantity) * Number(item.unit_price);
                        const isMonthly = item.billing_type === "monthly";
                        return (
                          <tr key={item.id} className="border-b last:border-0 align-top">
                            <td className="py-3">
                              <div>{item.description}</div>
                              {isMonthly && (
                                <div className="text-xs text-muted-foreground mt-0.5">{t("publicPages.quote.recurringMonthly")}</div>
                              )}
                            </td>
                            <td className="py-3 text-right whitespace-nowrap">{item.quantity} {item.unit}</td>
                            <td className="py-3 text-right whitespace-nowrap">{Number(item.unit_price).toLocaleString("sv-SE")} kr</td>
                            <td className="py-3 text-right whitespace-nowrap">
                              {lineDiscount > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-destructive font-semibold">-{lineDiscount}%</span>
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    {grossAmount.toLocaleString("sv-SE")} kr
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-3 text-right font-medium whitespace-nowrap">
                              {Number(item.line_total).toLocaleString("sv-SE")} kr
                              {isMonthly && <span className="text-xs text-muted-foreground font-normal">/mån</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <Separator className="my-4" />

                  <div className="space-y-1 text-sm">
                    {hasOneTime && hasMonthly && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("publicPages.quote.oneTimeCosts")}</span>
                          <span>{oneTimeTotal.toLocaleString("sv-SE")} kr</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("publicPages.quote.monthlyCosts")}</span>
                          <span>{monthlyTotal.toLocaleString("sv-SE")} kr/mån</span>
                        </div>
                        <Separator className="my-2" />
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("publicPages.offer.net")}</span>
                      <span>{Number(quote.subtotal).toLocaleString("sv-SE")} kr</span>
                    </div>
                    {hasAnyLineDiscount && lineDiscountTotal > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span>{t("publicPages.quote.lineDiscountsTotal")}</span>
                        <span>-{lineDiscountTotal.toLocaleString("sv-SE")} kr</span>
                      </div>
                    )}
                    {Number(quote.discount_percent) > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span>Rabatt på hela offerten ({quote.discount_percent}%)</span>
                        <span>-{(Number(quote.subtotal) * Number(quote.discount_percent) / 100).toLocaleString("sv-SE")} kr</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("publicPages.offer.vat")}</span>
                      <span>{Number(quote.vat_total).toLocaleString("sv-SE")} kr</span>
                    </div>
                    <Separator className="my-2" />
                    {hasOneTime && hasMonthly ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-base font-bold">
                          <span>{t("publicPages.quote.oneTimeAmount")}</span>
                          <span>{(oneTimeTotal * (1 - Number(quote.discount_percent) / 100)).toLocaleString("sv-SE")} {quote.currency}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold">
                          <span>{t("publicPages.quote.monthlyAmount")}</span>
                          <span>{(monthlyTotal * (1 - Number(quote.discount_percent) / 100)).toLocaleString("sv-SE")} {quote.currency}/mån</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between text-lg font-bold">
                        <span>{t("publicPages.offer.total")}</span>
                        <span>
                          {Number(quote.total).toLocaleString("sv-SE")} {quote.currency}
                          {hasMonthly && !hasOneTime && t("publicPages.perMonth")}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>

        {/* Notes & Terms */}
        {(quote.notes || quote.terms) && (
          <Card>
            <CardContent className="pt-6 space-y-4 text-sm">
              {quote.notes && (
                <div>
                  <h3 className="font-medium mb-1">{t("publicPages.offer.message")}</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}
              {quote.terms && (
                <div>
                  <h3 className="font-medium mb-1">{t("publicPages.offer.terms")}</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{quote.terms}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Signatures display */}
        {(quote.sender_signature_data || quote.recipient_signature_data) && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4 text-sm">{t("publicPages.quote.signatures")}</h3>
              <div className="flex flex-col sm:flex-row gap-6">
                {quote.sender_signature_data && (
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">{t("publicPages.quote.sender")}</p>
                    <p className="text-sm font-medium mb-1">
                      {senderInfo?.sender_display_name || senderInfo?.full_name || org?.name || t("publicPages.quote.sender")}
                    </p>
                    <div className="border rounded-lg p-3 bg-white">
                      <img src={quote.sender_signature_data} alt=t("publicPages.quote.senderSignatureAlt") className="max-h-16" />
                    </div>
                    {quote.sender_signed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Signerad {format(new Date(quote.sender_signed_at), "d MMM yyyy", { locale: sv })}
                      </p>
                    )}
                  </div>
                )}
                {quote.recipient_signature_data && (
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">{t("publicPages.quote.recipient")}</p>
                    <p className="text-sm font-medium mb-1">
                      {quote.recipient_name || "Mottagare"}
                    </p>
                    <div className="border rounded-lg p-3 bg-white">
                      <img src={quote.recipient_signature_data} alt="Mottagarens signatur" className="max-h-16" />
                    </div>
                    {quote.recipient_signed_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Signerad {format(new Date(quote.recipient_signed_at), "d MMM yyyy", { locale: sv })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Accept / Reject with signature */}
        {canRespond && !signingMode && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="flex-1" size="lg" onClick={() => setSigningMode(true)}>
                  <CheckCircle className="h-5 w-5 mr-2" />{t("publicPages.quote.acceptAndSign")}</Button>
                <Button variant="outline" className="flex-1" size="lg" onClick={handleReject}>
                  <XCircle className="h-5 w-5 mr-2" />{t("publicPages.quote.rejectOffer")}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {canRespond && signingMode && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-medium">{t("publicPages.quote.signToAccept")}</h3>
              <p className="text-sm text-muted-foreground">{t("publicPages.quote.signInstructions")}</p>
              {quote.recipient_name && (
                <p className="text-sm font-medium">{quote.recipient_name}</p>
              )}
              <SignatureCanvas
                label={t("publicPages.quote.yourSignature")}
                onSave={handleAcceptWithSignature}
              />
              <Button variant="ghost" size="sm" onClick={() => setSigningMode(false)}>{t("publicPages.offer.cancel")}</Button>
            </CardContent>
          </Card>
        )}

        {quote.status === "accepted" && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="font-medium">{t("publicPages.quote.offerAccepted")}</p>
              {quote.recipient_signed_at && (
                <p className="text-sm text-muted-foreground">
                  Signerad {format(new Date(quote.recipient_signed_at), "d MMMM yyyy", { locale: sv })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Powered by {org?.name || "CoFlow"}
        </p>
      </div>
    </div>
  );
}
