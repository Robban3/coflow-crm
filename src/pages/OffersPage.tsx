import { AppLayout } from "@/components/layout/AppLayout";
import { OffersList } from "@/components/documents/offers/OffersList";
import { OfferEditor } from "@/components/documents/offers/OfferEditor";
import { Routes, Route } from "react-router-dom";

export default function OffersPage() {
  return (
    <AppLayout>
      <Routes>
        <Route index element={<OffersList />} />
        <Route path=":id" element={<OfferEditor />} />
      </Routes>
    </AppLayout>
  );
}
