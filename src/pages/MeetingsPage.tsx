import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MeetingCalendar } from "@/components/meetings/MeetingCalendar";
import { AvailabilitySettings } from "@/components/meetings/AvailabilitySettings";
import { CreateMeetingDialog } from "@/components/meetings/CreateMeetingDialog";
import { Calendar, Clock, Plus, Link2, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

export default function MeetingsPage() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const bookingUrl = user ? `${window.location.origin}/book/${user.id}` : "";

  const copyBookingUrl = () => {
    navigator.clipboard.writeText(bookingUrl);
    toast({
      title: "Länk kopierad",
      description: "Bokningslänken har kopierats till urklipp",
    });
  };

  return (
    <AppLayout title="Möten">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Möten</h2>
            <p className="text-muted-foreground">Hantera din kalender och bokningar</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Skapa möte
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Din bokningslänk
            </CardTitle>
            <CardDescription>Dela denna länk så att leads kan boka möten med dig</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={bookingUrl} readOnly className="font-mono text-sm" />
              <Button variant="outline" onClick={copyBookingUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Kalender</span>
            </TabsTrigger>
            <TabsTrigger value="availability" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Tillgänglighet</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-6">
            <MeetingCalendar isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="availability" className="mt-6">
            <AvailabilitySettings />
          </TabsContent>
        </Tabs>

        <CreateMeetingDialog 
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </div>
    </AppLayout>
  );
}
