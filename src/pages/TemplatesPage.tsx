import { AppLayout } from "@/components/layout/AppLayout";
import { TemplatesList } from "@/components/documents/templates/TemplatesList";
import { TemplateEditor } from "@/components/documents/templates/TemplateEditor";
import { Routes, Route } from "react-router-dom";

export default function TemplatesPage() {
  return (
    <AppLayout>
      <Routes>
        <Route index element={<TemplatesList />} />
        <Route path=":id" element={<TemplateEditor />} />
      </Routes>
    </AppLayout>
  );
}
