import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  Loader2,
  Link2,
  Trash2,
  ExternalLink
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  guest_name: string | null;
  guest_email: string | null;
  meeting_link: string | null;
  status: string;
  lead_id: string | null;
  host_user_id: string;
  booking_token: string | null;
  host_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface MeetingCalendarProps {
  isAdmin?: boolean;
}

export function MeetingCalendar({ isAdmin = false }: MeetingCalendarProps) {
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;

  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [filterUser, setFilterUser] = useState<string>("all");

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["meeting-team-members", organizationId],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('organization_id', organizationId);
      return data || [];
    },
    enabled: isAdmin && !!organizationId,
  });

  const weekEnd = addDays(currentWeekStart, 7);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings", currentWeekStart.toISOString(), filterUser, isAdmin, user?.id],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('meetings')
        .select(`
          *,
          host_profile:profiles!meetings_host_user_id_profiles_fkey(full_name, email)
        `)
        .gte('start_time', currentWeekStart.toISOString())
        .lt('start_time', weekEnd.toISOString())
        .order('start_time');

      if (!isAdmin) {
        query = query.eq('host_user_id', user.id);
      } else if (filterUser !== 'all') {
        query = query.eq('host_user_id', filterUser);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(m => ({
        ...m,
        host_profile: Array.isArray(m.host_profile) ? m.host_profile[0] : m.host_profile,
      })) as Meeting[];
    },
    enabled: !!user,
  });

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      toast({
        title: t("meetings.meetingCancelledTitle"),
        description: t("meetings.meetingCancelledDesc"),
      });

      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (error) {
      toast({
        title: t("meetings.error"),
        description: t("meetings.meetingDeleteError"),
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return t("meetings.statusScheduled");
      case 'completed': return t("meetings.statusCompleted");
      case 'cancelled': return t("meetings.statusCancelled");
      default: return status;
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const getMeetingsForDay = (date: Date) => {
    return meetings.filter(meeting => 
      isSameDay(parseISO(meeting.start_time), date)
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t("meetings.calendarTitle")}
            </CardTitle>
            <CardDescription>
              {isAdmin ? t("meetings.calendarDescAdmin") : t("meetings.calendarDescUser")}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("meetings.filterUser")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("meetings.allUsers")}</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <div className="flex items-center gap-1">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              >
                {t("meetings.today")}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {weekDays.map(day => {
              const dayMeetings = getMeetingsForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div 
                  key={day.toISOString()}
                  className={`border rounded-lg p-2 min-h-[120px] ${
                    isToday ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className={`text-sm font-medium mb-2 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    <span className="hidden sm:inline">{format(day, 'EEE', { locale: dateLocale })}</span>
                    <span className="sm:hidden">{format(day, 'EEEE', { locale: dateLocale })}</span>
                    <span className="ml-1">{format(day, 'd/M')}</span>
                  </div>
                  
                  <div className="space-y-1">
                    {dayMeetings.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("meetings.noMeetings")}</p>
                    ) : (
                      dayMeetings.map(meeting => (
                        <div 
                          key={meeting.id}
                          className="p-2 rounded bg-card border text-xs space-y-1 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-medium truncate">{meeting.title}</span>
                            <Badge variant="secondary" className={`text-[9px] px-1 py-0 text-white ${getStatusColor(meeting.status)}`}>
                              {getStatusLabel(meeting.status)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(meeting.start_time), 'HH:mm')} - {format(parseISO(meeting.end_time), 'HH:mm')}
                          </div>
                          
                          {meeting.guest_name && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span className="truncate">{meeting.guest_name}</span>
                            </div>
                          )}
                          
                          {isAdmin && meeting.host_profile && (
                            <div className="text-muted-foreground italic">
                              Värd: {meeting.host_profile.full_name || meeting.host_profile.email}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1 pt-1">
                            {meeting.meeting_link && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0"
                                onClick={() => window.open(meeting.meeting_link!, '_blank')}
                              >
                                <Link2 className="h-3 w-3" />
                              </Button>
                            )}
                            {meeting.lead_id && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 w-6 p-0"
                                onClick={() => navigate(`/leads/${meeting.lead_id}`)}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
