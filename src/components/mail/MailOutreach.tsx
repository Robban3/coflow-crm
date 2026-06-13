import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Settings } from "lucide-react";
import { SentEmailsList } from "@/components/outreach/SentEmailsList";
import { SequencesList } from "@/components/outreach/SequencesList";
import { useTranslation } from "@/i18n/LanguageProvider";

export function MailOutreach() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Tabs defaultValue="sent" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>{t("mail.outreachSent")}</span>
          </TabsTrigger>
          <TabsTrigger value="sequences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>{t("mail.outreachSequences")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="mt-4">
          <SentEmailsList currentUserOnly />
        </TabsContent>

        <TabsContent value="sequences" className="mt-4">
          <SequencesList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
