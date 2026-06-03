import { AppLayout } from "@/components/layout/AppLayout";
import MarketSelector from "@/components/prospecting/MarketSelector";
import ProspectingModule from "@/components/prospecting/ProspectingModule";

export default function ProspectingPage() {
  return (
    <AppLayout>
      <div className="container max-w-7xl py-8 space-y-6">
        <div className="flex justify-end">
          <MarketSelector />
        </div>
        <ProspectingModule />
      </div>
    </AppLayout>
  );
}
