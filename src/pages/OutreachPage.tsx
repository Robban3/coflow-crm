import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Settings } from "lucide-react";
import { SentEmailsList } from "@/components/outreach/SentEmailsList";
import { SequencesList } from "@/components/outreach/SequencesList";

export default function OutreachPage() {
  return (
    <AppLayout title="Outreach">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">Outreach</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Överblick över skickade mail och sekvenser
          </p>
        </div>

        <Tabs defaultValue="sent" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="sent" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Skickade mail</span>
            </TabsTrigger>
            <TabsTrigger value="sequences" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Sekvenser</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sent" className="mt-6">
            <SentEmailsList />
          </TabsContent>

          <TabsContent value="sequences" className="mt-6">
            <SequencesList />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
