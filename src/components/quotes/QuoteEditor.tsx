import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Send, Copy, ExternalLink, GripVertical, Download, Edit, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ProductPicker } from "./ProductPicker";
import { SendQuoteDialog } from "./SendQuoteDialog";
import { SignatureCanvas } from "./SignatureCanvas";
import { useTranslation } from "@/i18n/LanguageProvider";

interface QuoteItem {
  id?: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  vat_rate: number;
  sort_order: number;
  line_total?: number;
  billing_type: "one_time" | "monthly";
}

interface QuoteEditorProps {
  quoteId: string | null;
  prefillLeadId?: string | null;
  onClose: () => void;
}

export function QuoteEditor({ quoteId, prefillLeadId, onClose }: QuoteEditorProps) {
  const { t, language } = useTranslation();
  const numberLocale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "sv-SE";
  const { user } = useAuth();
  const organizationId = useOrganizationId();
  const [loading, setLoading] = useState(!!quoteId);
  const [saving, setSaving] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [senderSignature, setSenderSignature] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [recipientSignature, setRecipientSignature] = useState<string | null>(null);
  const [recipientSignedAt, setRecipientSignedAt] = useState<string | null>(null);
  const [senderSignedAt, setSenderSignedAt] = useState<string | null>(null);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(quoteId);

  // Lead search state
  const [leadSearchResults, setLeadSearchResults] = useState<Array<{ id: string; company_name: string | null; contact_name: string | null; email: string | null }>>([]);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [leadSearchTimeout, setLeadSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Quote fields
  const [title, setTitle] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [status, setStatus] = useState("draft");
  const [currency, setCurrency] = useState("SEK");
  const [validUntil, setValidUntil] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [viewToken, setViewToken] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [documentLabel, setDocumentLabel] = useState<"offert" | "avtal">("offert");

  // Items
  const [items, setItems] = useState<QuoteItem[]>([]);

  useEffect(() => {
    if (currentQuoteId) loadQuote();
    else generateQuoteNumber();
  }, [currentQuoteId]);

  // Prefill from lead
  useEffect(() => {
    if (prefillLeadId && !quoteId) {
      (async () => {
        const { data: leadData } = await supabase
          .from("leads")
          .select("id, company_name, contact_name, email")
          .eq("id", prefillLeadId)
          .maybeSingle();
        if (leadData) {
          setTitle(leadData.company_name || "");
          setRecipientName(leadData.contact_name || leadData.company_name || "");
          setRecipientEmail(leadData.email || "");
          setLeadId(leadData.id);
        }
      })();
    }
  }, [prefillLeadId]);

  const searchLeads = async (query: string) => {
    if (query.length < 2) {
      setLeadSearchResults([]);
      setShowLeadDropdown(false);
      return;
    }
    const { data } = await supabase
      .from("leads")
      .select("id, company_name, contact_name, email")
      .ilike("company_name", `%${query}%`)
      .limit(8);
    if (data && data.length > 0) {
      setLeadSearchResults(data);
      setShowLeadDropdown(true);
    } else {
      setLeadSearchResults([]);
      setShowLeadDropdown(false);
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    // Clear lead association if title changed manually
    if (leadId && value !== title) {
      // Don't clear immediately, only on explicit new selection or save
    }
    if (leadSearchTimeout) clearTimeout(leadSearchTimeout);
    const timeout = setTimeout(() => searchLeads(value), 300);
    setLeadSearchTimeout(timeout);
  };

  const selectLead = (lead: { id: string; company_name: string | null; contact_name: string | null; email: string | null }) => {
    setTitle(lead.company_name || "");
    setRecipientName(lead.contact_name || lead.company_name || "");
    setRecipientEmail(lead.email || "");
    setLeadId(lead.id);
    setShowLeadDropdown(false);
  };

  const generateQuoteNumber = async () => {
    if (!organizationId) return;
    const { data, error } = await supabase.rpc("generate_quote_number", {
      org_id: organizationId,
    });
    if (!error && data) setQuoteNumber(data);
  };

  const loadQuote = async () => {
    if (!currentQuoteId) return;
    setLoading(true);
    const { data: q, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", currentQuoteId)
      .single();

    if (error || !q) {
      toast.error(t("quotes.couldNotLoadQuote"));
      onClose();
      return;
    }

    setTitle(q.title);
    setQuoteNumber(q.quote_number);
    setStatus(q.status);
    setCurrency(q.currency || "SEK");
    setValidUntil(q.valid_until || "");
    setRecipientName(q.recipient_name || "");
    setRecipientEmail(q.recipient_email || "");
    setNotes(q.notes || "");
    setTerms(q.terms || "");
    setDiscountPercent(Number(q.discount_percent) || 0);
    setViewToken(q.view_token);
    setLeadId(q.lead_id);
    setViewCount(q.view_count || 0);
    setDocumentLabel((q as any).document_label === "avtal" ? "avtal" : "offert");
    setSenderSignature(q.sender_signature_data || null);
    setSenderSignedAt(q.sender_signed_at || null);
    setRecipientSignature(q.recipient_signature_data || null);
    setRecipientSignedAt(q.recipient_signed_at || null);

    const { data: qItems } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", currentQuoteId)
      .order("sort_order");

    if (qItems) {
      setItems(
        qItems.map((i: any) => ({
          id: i.id,
          product_id: i.product_id,
          description: i.description,
          quantity: Number(i.quantity),
          unit: i.unit || "st",
          unit_price: Number(i.unit_price),
          discount_percent: Number(i.discount_percent) || 0,
          vat_rate: Number(i.vat_rate) || 25,
          sort_order: i.sort_order,
          line_total: Number(i.line_total) || 0,
          billing_type: i.billing_type || "one_time",
        }))
      );
    }

    setLoading(false);
  };

  const addItem = (item?: Partial<QuoteItem>) => {
    setItems((prev) => [
      ...prev,
      {
        description: item?.description || "",
        quantity: item?.quantity || 1,
        unit: item?.unit || "st",
        unit_price: item?.unit_price || 0,
        discount_percent: item?.discount_percent || 0,
        vat_rate: item?.vat_rate || 25,
        sort_order: prev.length,
        product_id: item?.product_id || null,
        billing_type: item?.billing_type || "one_time",
      },
    ]);
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calcLineTotal = (item: QuoteItem) =>
    item.quantity * item.unit_price * (1 - item.discount_percent / 100);

  const oneTimeItems = items.filter((i) => i.billing_type === "one_time");
  const monthlyItems = items.filter((i) => i.billing_type === "monthly");

  const oneTimeSubtotal = oneTimeItems.reduce((sum, item) => sum + calcLineTotal(item), 0);
  const monthlySubtotal = monthlyItems.reduce((sum, item) => sum + calcLineTotal(item), 0);

  const subtotal = items.reduce((sum, item) => sum + calcLineTotal(item), 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const afterDiscount = subtotal - discountAmount;
  const vatTotal = items.reduce((sum, item) => {
    const lt = calcLineTotal(item);
    const share = subtotal > 0 ? lt / subtotal : 0;
    return sum + share * afterDiscount * (item.vat_rate / 100);
  }, 0);
  const total = afterDiscount + vatTotal;

  const hasMonthly = monthlyItems.length > 0;
  const hasOneTime = oneTimeItems.length > 0;
  const isReadOnly = ["accepted", "rejected", "won"].includes(status);
  const isWon = status === "won";
  const canConvertToDeal = currentQuoteId && !isWon && status !== "rejected";
  const [convertingToDeal, setConvertingToDeal] = useState(false);

  const convertToDeal = async () => {
    if (!currentQuoteId || !organizationId || !user) return;
    if (!confirm(t("quotes.confirmConvert"))) return;
    setConvertingToDeal(true);
    try {
      // Look up or create a customer for this quote
      let customerId: string | null = null;

      // 1) If quote already has a customer_id, reuse it
      const { data: existingQuote } = await supabase
        .from("quotes")
        .select("customer_id")
        .eq("id", currentQuoteId)
        .maybeSingle();

      if (existingQuote?.customer_id) {
        customerId = existingQuote.customer_id;
      } else if (leadId) {
        // 2) Try to find a customer linked to the same lead (already converted)
        const { data: leadData } = await supabase
          .from("leads")
          .select("converted_to_customer_id, company_name, contact_name, email, phone, website")
          .eq("id", leadId)
          .maybeSingle();

        if (leadData?.converted_to_customer_id) {
          customerId = leadData.converted_to_customer_id;
        } else {
          // 3) Create a new customer from lead data + recipient info
          const { data: newCustomer, error: custErr } = await supabase
            .from("customers")
            .insert({
              organization_id: organizationId,
              created_by: user.id,
              company_name: leadData?.company_name || recipientName || title,
              contact_name: leadData?.contact_name || recipientName || null,
              email: leadData?.email || recipientEmail || null,
              phone: leadData?.phone || null,
              website: leadData?.website || null,
              status: "active" as any,
              assigned_to: user.id,
            })
            .select("id")
            .single();
          if (custErr) throw custErr;
          customerId = newCustomer.id;

          // Link lead to the new customer
          await supabase
            .from("leads")
            .update({ converted_to_customer_id: customerId })
            .eq("id", leadId);
        }
      } else {
        // 4) No lead — create a customer purely from recipient info
        const { data: newCustomer, error: custErr } = await supabase
          .from("customers")
          .insert({
            organization_id: organizationId,
            created_by: user.id,
            company_name: recipientName || title,
            contact_name: recipientName || null,
            email: recipientEmail || null,
            status: "active" as any,
            assigned_to: user.id,
          })
          .select("id")
          .single();
        if (custErr) throw custErr;
        customerId = newCustomer.id;
      }

      // Update quote: status=won, link customer, stamp accepted_at if missing
      const { error: updErr } = await supabase
        .from("quotes")
        .update({
          status: "won",
          customer_id: customerId,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", currentQuoteId);
      if (updErr) throw updErr;

      setStatus("won");
      toast.success(t("quotes.quoteMarkedAsDeal"));
    } catch (err: any) {
      toast.error(t("quotes.couldNotConvert", { error: err.message || t("quotes.unknownError") }));
    } finally {
      setConvertingToDeal(false);
    }
  };

  const saveQuote = async () => {
    if (!user || !organizationId) return;
    if (!title.trim()) {
      toast.error(t("quotes.enterQuoteTitle"));
      return;
    }
    setSaving(true);

    try {
      const quoteData: Record<string, any> = {
        title,
        quote_number: quoteNumber,
        status,
        currency,
        document_label: documentLabel,
        valid_until: validUntil || null,
        recipient_name: recipientName || null,
        recipient_email: recipientEmail || null,
        notes: notes || null,
        terms: terms || null,
        subtotal: Math.round(subtotal * 100) / 100,
        vat_total: Math.round(vatTotal * 100) / 100,
        total: Math.round(total * 100) / 100,
        discount_percent: discountPercent,
        organization_id: organizationId,
        created_by: user.id,
        lead_id: leadId,
        sender_signature_data: senderSignature || null,
        sender_signed_at: senderSignature ? new Date().toISOString() : null,
      };

      let savedQuoteId = currentQuoteId;

      if (currentQuoteId) {
        const { error } = await supabase
          .from("quotes")
          .update(quoteData)
          .eq("id", currentQuoteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("quotes")
          .insert(quoteData as any)
          .select("id, view_token")
          .single();
        if (error) throw error;
        savedQuoteId = data.id;
        setViewToken(data.view_token);
        setCurrentQuoteId(data.id);
      }

      // Delete existing items and re-insert
      if (currentQuoteId) {
        await supabase.from("quote_items").delete().eq("quote_id", currentQuoteId);
      }

      if (items.length > 0 && savedQuoteId) {
        const itemsToInsert = items.map((item, idx) => ({
          quote_id: savedQuoteId!,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          vat_rate: item.vat_rate,
          sort_order: idx,
          billing_type: item.billing_type,
        }));

        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      toast.success(documentLabel === "avtal" ? t("quotes.agreementSaved") : t("quotes.quoteSaved"));
    } catch (err: any) {
      toast.error(t("quotes.couldNotSave", { error: err.message || t("quotes.unknownError") }));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!viewToken) return;
    const url = `${window.location.origin}/quote/${viewToken}`;
    navigator.clipboard.writeText(url);
    toast.success(t("quotes.linkCopied"));
  };

  const downloadPdf = async () => {
    if (!currentQuoteId) {
      toast.error(t("quotes.saveQuoteFirst"));
      return;
    }
    setDownloadingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quote-pdf", {
        body: { quoteId: currentQuoteId },
      });
      if (error) throw error;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.onload = () => {
          setTimeout(() => printWindow.print(), 300);
        };
        setTimeout(() => printWindow.print(), 2000);
      }
    } catch {
      toast.error(t("quotes.couldNotGeneratePdf"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">{t("quotes.loadingQuote")}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isWon
                ? `Vunnen affär`
                : isReadOnly
                ? (status === "accepted" ? `Accepterad ${documentLabel}` : `Avböjd ${documentLabel}`)
                : currentQuoteId ? `Redigera ${documentLabel}` : `Ny ${documentLabel}`}
            </h1>
            {quoteNumber && (
              <p className="text-sm text-muted-foreground">#{quoteNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewToken && (
            <>
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4 mr-1" />{t("quotes.copyLink")}</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/quote/${viewToken}`, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />{t("quotes.preview")}</Button>
            </>
          )}
          {viewCount > 0 && (
            <Badge variant="outline" className="text-xs">
              Visad {viewCount}x
            </Badge>
          )}
          {currentQuoteId && (
            <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloadingPdf}>
              <Download className="h-4 w-4 mr-1" />
              {downloadingPdf ? "..." : "PDF"}
            </Button>
          )}
          {!isReadOnly && (
            <>
              <Button variant="outline" onClick={saveQuote} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Sparar..." : "Spara"}
              </Button>
              {currentQuoteId && ["draft", "sent", "viewed"].includes(status) && (
                <Button onClick={() => setShowSendDialog(true)}>
                  <Send className="h-4 w-4 mr-1" />
                  {status === "draft" ? t("quotes.send") : t("quotes.sendAgain")}
                </Button>
              )}
            </>
          )}
          {canConvertToDeal && (
            <Button
              variant="default"
              onClick={convertToDeal}
              disabled={convertingToDeal}
              title={t("quotes.markAsDealTitle")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {convertingToDeal ? "Konverterar..." : t("quotes.markAsDeal")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{documentLabel === "avtal" ? "Avtalsinformation" : "Offertinformation"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 relative">
                  <Label>{t("quotes.titleSearchLead")}</Label>
                  <Input
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder={t("quotes.searchLeadPlaceholder")}
                    disabled={isReadOnly}
                    onFocus={() => { if (leadSearchResults.length > 0) setShowLeadDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowLeadDropdown(false), 200)}
                  />
                  {showLeadDropdown && leadSearchResults.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {leadSearchResults.map((lead) => (
                        <button
                          key={lead.id}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex flex-col"
                          onMouseDown={(e) => { e.preventDefault(); selectLead(lead); }}
                        >
                          <span className="font-medium">{lead.company_name}</span>
                          {(lead.contact_name || lead.email) && (
                            <span className="text-xs text-muted-foreground">
                              {[lead.contact_name, lead.email].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {leadId && (
                    <p className="text-xs text-muted-foreground mt-1">{t("quotes.linkedToLead")}</p>
                  )}
                </div>
                <div>
                  <Label>{t("quotes.recipientName")}</Label>
                  <Input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={t("quotes.recipientNamePlaceholder")}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label>{t("quotes.recipientEmail")}</Label>
                  <Input
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder={t("quotes.emailPlaceholder")}
                    type="email"
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label>{t("quotes.validUntil")}</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label>{t("quotes.documentType")}</Label>
                  <Select value={documentLabel} onValueChange={(v) => setDocumentLabel(v as "offert" | "avtal")} disabled={isReadOnly}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offert">{t("quotes.offert")}</SelectItem>
                      <SelectItem value="avtal">{t("quotes.avtal")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("quotes.currency")}</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEK">SEK</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("quotes.rows")}</CardTitle>
              {!isReadOnly && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowProductPicker(true)}>{t("quotes.fromCatalog")}</Button>
                  <Button variant="outline" size="sm" onClick={() => addItem()}>
                    <Plus className="h-4 w-4 mr-1" />{t("quotes.freeRow")}</Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">{t("quotes.addProductsServices")}</div>
              ) : (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                    <div className="col-span-3">{t("quotes.description")}</div>
                    <div className="col-span-1 text-right">{t("quotes.colQuantity")}</div>
                    <div className="col-span-1">{t("quotes.unit")}</div>
                    <div className="col-span-2 text-right">Á-pris</div>
                    <div className="col-span-1 text-right">{t("quotes.colDiscount")}</div>
                    <div className="col-span-1 text-center">{t("quotes.colType")}</div>
                    <div className="col-span-2 text-right">{t("quotes.colTotal")}</div>
                    <div className="col-span-1" />
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3">
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          placeholder={t("quotes.description")}
                          className="text-sm"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                          className="text-sm text-right"
                          min={0}
                          step={0.5}
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          className="text-sm"
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))}
                          className="text-sm text-right"
                          min={0}
                          disabled={isReadOnly}
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          value={item.discount_percent}
                          onChange={(e) => updateItem(idx, "discount_percent", Math.max(0, Math.min(100, Number(e.target.value))))}
                          className="text-sm text-right"
                          min={0}
                          max={100}
                          step={1}
                          placeholder="0"
                          disabled={isReadOnly}
                          title={t("quotes.rowDiscountTitle")}
                        />
                      </div>
                      <div className="col-span-1">
                        <Select
                          value={item.billing_type}
                          onValueChange={(v) => updateItem(idx, "billing_type", v)}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one_time">{t("quotes.billingOneTime")}</SelectItem>
                            <SelectItem value="monthly">{t("quotes.billingMonthly")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 text-right text-sm font-medium pr-1">
                        {calcLineTotal(item).toLocaleString("sv-SE")} kr
                        {item.discount_percent > 0 && (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {(item.quantity * item.unit_price).toLocaleString("sv-SE")} kr
                          </div>
                        )}
                        {item.billing_type === "monthly" && <span className="text-xs text-muted-foreground">/mån</span>}
                      </div>
                      {!isReadOnly && (
                        <div className="col-span-1 flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeItem(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>{t("quotes.messageToRecipient")}</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("quotes.messageToRecipientPlaceholder")}
                  rows={3}
                  disabled={isReadOnly}
                />
              </div>
              <div>
                <Label>{t("quotes.terms")}</Label>
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder={t("quotes.termsPlaceholder")}
                  rows={3}
                  disabled={isReadOnly}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("quotes.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {hasOneTime && hasMonthly ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("quotes.oneTimeCosts")}</span>
                    <span>{oneTimeSubtotal.toLocaleString("sv-SE")} kr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("quotes.monthlyCosts")}</span>
                    <span>{monthlySubtotal.toLocaleString("sv-SE")} kr/mån</span>
                  </div>
                  <Separator />
                </>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Netto ({items.length} rader)</span>
                <span>{subtotal.toLocaleString("sv-SE")} kr</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t("quotes.discount")}</span>
                <Input
                  type="number"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-20 h-8 text-sm text-right"
                  min={0}
                  max={100}
                  disabled={isReadOnly}
                />
                <span className="text-muted-foreground">%</span>
                <span className="ml-auto">
                  -{discountAmount.toLocaleString("sv-SE")} kr
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("quotes.vatLabel")}</span>
                <span>{vatTotal.toLocaleString("sv-SE")} kr</span>
              </div>
              <Separator />
              {hasOneTime && hasMonthly ? (
                <div className="space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>{t("quotes.oneTimeAmount")}</span>
                    <span>{(oneTimeSubtotal * (1 - discountPercent / 100)).toLocaleString("sv-SE")} {currency}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>{t("quotes.monthlyAmount")}</span>
                    <span>{(monthlySubtotal * (1 - discountPercent / 100)).toLocaleString("sv-SE")} {currency}/mån</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("quotes.total")}</span>
                  <span>
                    {total.toLocaleString("sv-SE")} {currency}
                    {hasMonthly && !hasOneTime && t("quotes.perMonth")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("quotes.status")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant={
                  status === "won"
                    ? "default"
                    : status === "accepted"
                    ? "default"
                    : status === "rejected"
                    ? "destructive"
                    : "secondary"
                }
              >
                {status === "draft"
                  ? "Utkast"
                  : status === "sent"
                  ? "Skickad"
                  : status === "viewed"
                  ? t("quotes.statusViewed")
                  : status === "accepted"
                  ? t("quotes.statusAccepted")
                  : status === "won"
                  ? t("quotes.statusWonFull")
                  : status === "rejected"
                  ? t("quotes.statusRejected")
                  : status}
              </Badge>
              {isWon && (
                <p className="text-xs text-muted-foreground mt-2">{t("quotes.quoteLockedNote")}</p>
              )}
            </CardContent>
          </Card>

          {/* Sender signature */}
          {!isReadOnly && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t("quotes.senderSignature")}</CardTitle>
                {!showSignature && !senderSignature && (
                  <Button variant="outline" size="sm" onClick={() => setShowSignature(true)}>
                    <Edit className="h-3.5 w-3.5 mr-1" />{t("quotes.sign")}</Button>
                )}
              </CardHeader>
              <CardContent>
                {senderSignature ? (
                  <div className="space-y-2">
                    <div className="border rounded-lg p-3 bg-white">
                      <img src={senderSignature} alt="Din signatur" className="max-h-16" />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setSenderSignature(null); setShowSignature(true); }}>{t("quotes.changeSignature")}</Button>
                  </div>
                ) : showSignature ? (
                  <SignatureCanvas
                    label={t("quotes.drawYourSignature")}
                    onSave={(data) => {
                      setSenderSignature(data);
                      setShowSignature(false);
                      toast.success(t("quotes.signatureSavedNote"));
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{t("quotes.noSignatureAdded")}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Signatures display for accepted/rejected quotes */}
          {isReadOnly && (senderSignature || recipientSignature) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("quotes.signatures")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {senderSignature && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t("quotes.sender")}</p>
                    <div className="border rounded-lg p-3 bg-white">
                      <img src={senderSignature} alt={t("quotes.senderSignatureAlt")} className="max-h-16" />
                    </div>
                    {senderSignedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Signerad {new Date(senderSignedAt).toLocaleDateString("sv-SE")}
                      </p>
                    )}
                  </div>
                )}
                {recipientSignature && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mottagare – {recipientName || "Mottagare"}</p>
                    <div className="border rounded-lg p-3 bg-white">
                      <img src={recipientSignature} alt="Mottagarens signatur" className="max-h-16" />
                    </div>
                    {recipientSignedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Signerad {new Date(recipientSignedAt).toLocaleDateString("sv-SE")}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showProductPicker && (
        <ProductPicker
          onSelect={(product) => {
            addItem({
              product_id: product.id,
              description: product.name + (product.description ? ` – ${product.description}` : ""),
              unit_price: product.unit_price,
              unit: product.unit,
              vat_rate: product.vat_rate,
            });
            setShowProductPicker(false);
          }}
          onClose={() => setShowProductPicker(false)}
        />
      )}

      {showSendDialog && currentQuoteId && (
        <SendQuoteDialog
          quoteId={currentQuoteId}
          recipientEmail={recipientEmail}
          recipientName={recipientName}
          viewToken={viewToken}
          documentLabel={documentLabel}
          onSent={() => {
            setShowSendDialog(false);
            setStatus("sent");
            toast.success(documentLabel === "avtal" ? "Avtalet har skickats!" : "Offerten har skickats!");
          }}
          onClose={() => setShowSendDialog(false)}
        />
      )}
    </div>
  );
}
