import { AppLayout } from "@/components/layout/AppLayout";
import { QuotesList } from "@/components/quotes/QuotesList";
import { QuoteEditor } from "@/components/quotes/QuoteEditor";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function QuotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [prefillLeadId, setPrefillLeadId] = useState<string | null>(null);

  useEffect(() => {
    const leadId = searchParams.get("newFromLead");
    if (leadId) {
      setPrefillLeadId(leadId);
      setIsCreating(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  if (editingQuoteId || isCreating) {
    return (
      <AppLayout>
        <QuoteEditor
          quoteId={editingQuoteId}
          prefillLeadId={prefillLeadId}
          onClose={() => {
            setEditingQuoteId(null);
            setIsCreating(false);
            setPrefillLeadId(null);
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <QuotesList
        onCreateNew={() => setIsCreating(true)}
        onEdit={(id) => setEditingQuoteId(id)}
      />
    </AppLayout>
  );
}
