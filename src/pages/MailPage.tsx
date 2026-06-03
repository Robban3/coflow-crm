import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Send, Mail as MailIcon, RefreshCw } from "lucide-react";
import { MailInbox } from "@/components/mail/MailInbox";
import { MailSent } from "@/components/mail/MailSent";
import { MailOutreach } from "@/components/mail/MailOutreach";
import { MailFollowUp } from "@/components/mail/MailFollowUp";
import { NewMailDialog } from "@/components/mail/NewMailDialog";

export default function MailPage() {
  const [activeTab, setActiveTab] = useState("inbox");

  return (
    <AppLayout title="Mail">
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Mail</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Din inkorg, skickade mail och outreach
            </p>
          </div>
          <NewMailDialog onSent={() => setActiveTab("sent")} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              <span>Inkorg</span>
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span>Skickat</span>
            </TabsTrigger>
            <TabsTrigger value="outreach" className="flex items-center gap-2">
              <MailIcon className="h-4 w-4" />
              <span>Outreach</span>
            </TabsTrigger>
            <TabsTrigger value="followup" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>Uppföljning</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-6">
            <MailInbox />
          </TabsContent>

          <TabsContent value="sent" className="mt-6">
            <MailSent />
          </TabsContent>

          <TabsContent value="outreach" className="mt-6">
            <MailOutreach />
          </TabsContent>

          <TabsContent value="followup" className="mt-6">
            <MailFollowUp />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
