import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, List, User } from "lucide-react";
import { TicketKanban } from "@/components/tickets/TicketKanban";
import { TicketList } from "@/components/tickets/TicketList";
import { TicketStats } from "@/components/tickets/TicketStats";
import { CreateTicketDialog } from "@/components/tickets/CreateTicketDialog";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function TicketsPage() {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("tickets.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tickets.subtitle")}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t("tickets.new")}
          </Button>
        </div>

        <TicketStats key={`stats-${refreshKey}`} />

        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban" className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> Kanban</TabsTrigger>
            <TabsTrigger value="list" className="flex items-center gap-1"><List className="h-3.5 w-3.5" /> Lista</TabsTrigger>
            <TabsTrigger value="mine" className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Mina ärenden</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban">
            <TicketKanban key={`kanban-${refreshKey}`} />
          </TabsContent>
          <TabsContent value="list">
            <TicketList key={`list-${refreshKey}`} />
          </TabsContent>
          <TabsContent value="mine">
            <TicketList key={`mine-${refreshKey}`} myOnly />
          </TabsContent>
        </Tabs>
      </div>

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => setRefreshKey(k => k + 1)} />
    </AppLayout>
  );
}
