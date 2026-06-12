import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";

interface DayAvailability {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, labelKey: "meetings.dayMonday" },
  { value: 2, labelKey: "meetings.dayTuesday" },
  { value: 3, labelKey: "meetings.dayWednesday" },
  { value: 4, labelKey: "meetings.dayThursday" },
  { value: 5, labelKey: "meetings.dayFriday" },
  { value: 6, labelKey: "meetings.daySaturday" },
  { value: 0, labelKey: "meetings.daySunday" },
];

const DEFAULT_AVAILABILITY: DayAvailability[] = DAYS_OF_WEEK.map(day => ({
  day_of_week: day.value,
  start_time: "09:00",
  end_time: "17:00",
  is_available: day.value >= 1 && day.value <= 5, // Mon-Fri
}));

export function AvailabilitySettings() {
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [availability, setAvailability] = useState<DayAvailability[]>(DEFAULT_AVAILABILITY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_availability')
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week');

      if (error) throw error;

      if (data && data.length > 0) {
        // Merge with defaults to ensure all days exist
        const merged = DAYS_OF_WEEK.map(day => {
          const existing = data.find(d => d.day_of_week === day.value);
          if (existing) {
            return {
              id: existing.id,
              day_of_week: existing.day_of_week,
              start_time: existing.start_time,
              end_time: existing.end_time,
              is_available: existing.is_available ?? true,
            };
          }
          return DEFAULT_AVAILABILITY.find(d => d.day_of_week === day.value)!;
        });
        setAvailability(merged);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('meetings.notLoggedIn'));

      // Upsert all availability records
      for (const day of availability) {
        if (day.id) {
          // Update existing
          const { error } = await supabase
            .from('user_availability')
            .update({
              start_time: day.start_time,
              end_time: day.end_time,
              is_available: day.is_available,
            })
            .eq('id', day.id);
          if (error) throw error;
        } else {
          // Insert new
          const { error } = await supabase
            .from('user_availability')
            .insert({
              user_id: user.id,
              organization_id: organizationId,
              day_of_week: day.day_of_week,
              start_time: day.start_time,
              end_time: day.end_time,
              is_available: day.is_available,
            });
          if (error) throw error;
        }
      }

      toast({
        title: t("meetings.availabilitySavedTitle"),
        description: t("meetings.availabilitySavedDesc"),
      });

      // Refresh to get IDs
      fetchAvailability();
    } catch (error) {
      console.error('Error saving availability:', error);
      toast({
        title: t("meetings.error"),
        description: t("meetings.availabilitySaveError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateDay = (dayOfWeek: number, field: keyof DayAvailability, value: string | boolean) => {
    setAvailability(prev => 
      prev.map(day => 
        day.day_of_week === dayOfWeek 
          ? { ...day, [field]: value }
          : day
      )
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t("meetings.availabilityTitle")}
        </CardTitle>
        <CardDescription>
          {t("meetings.availabilityDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {DAYS_OF_WEEK.map(day => {
          const dayData = availability.find(d => d.day_of_week === day.value);
          if (!dayData) return null;

          return (
            <div 
              key={day.value} 
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${
                dayData.is_available ? 'bg-card' : 'bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-[140px]">
                <Switch
                  checked={dayData.is_available}
                  onCheckedChange={(checked) => updateDay(day.value, 'is_available', checked)}
                />
                <Label className={`font-medium ${!dayData.is_available ? 'text-muted-foreground' : ''}`}>
                  {t(day.labelKey)}
                </Label>
              </div>
              
              {dayData.is_available && (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={dayData.start_time}
                    onChange={(e) => updateDay(day.value, 'start_time', e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="time"
                    value={dayData.end_time}
                    onChange={(e) => updateDay(day.value, 'end_time', e.target.value)}
                    className="w-28"
                  />
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-4">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {t("meetings.saveAvailability")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
