import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar, 
  Clock, 
  User, 
  Loader2, 
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { format, addDays, isBefore, parseISO, setHours, setMinutes, isAfter } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";

interface HostProfile {
  full_name: string | null;
  email: string;
  company_name: string | null;
  avatar_url: string | null;
  organization_id: string | null;
}

interface TimeSlot {
  start: Date;
  end: Date;
}

interface DayAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export default function PublicBookingPage() {
  const { userId } = useParams<{ userId: string }>();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;

  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [existingMeetings, setExistingMeetings] = useState<{ start_time: string; end_time: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [guestForm, setGuestForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const MEETING_DURATION_MINUTES = 30;

  useEffect(() => {
    if (userId) {
      fetchHostData();
    }
  }, [userId]);

  const fetchHostData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch host profile including organization_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email, company_name, avatar_url, organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (profileError || !profile) {
        setError(t('publicPages.booking.userNotFound'));
        setIsLoading(false);
        return;
      }

      setHostProfile(profile);

      // Fetch availability via secure RPC
      const { data: availData } = await (supabase as any).rpc('public_get_host_availability', {
        _host_id: userId,
      });

      setAvailability(availData || []);

      // Fetch busy slots for the next 14 days via secure RPC
      const now = new Date();
      const twoWeeksLater = addDays(now, 14);

      const { data: meetings } = await (supabase as any).rpc('public_get_host_busy_slots', {
        _host_id: userId,
        _from: now.toISOString(),
        _to: twoWeeksLater.toISOString(),
      });

      setExistingMeetings(meetings || []);
    } catch (err) {
      setError(t('publicPages.booking.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableDates = () => {
    const dates: Date[] = [];
    const now = new Date();
    
    for (let i = 1; i <= 14; i++) {
      const date = addDays(now, i);
      const dayOfWeek = date.getDay();
      
      const dayAvail = availability.find(a => a.day_of_week === dayOfWeek);
      if (dayAvail?.is_available) {
        dates.push(date);
      }
    }
    
    return dates;
  };

  const getTimeSlotsForDate = (date: Date): TimeSlot[] => {
    const dayOfWeek = date.getDay();
    const dayAvail = availability.find(a => a.day_of_week === dayOfWeek);
    
    if (!dayAvail?.is_available) return [];

    const slots: TimeSlot[] = [];
    const [startHour, startMin] = dayAvail.start_time.split(':').map(Number);
    const [endHour, endMin] = dayAvail.end_time.split(':').map(Number);

    let current = setMinutes(setHours(date, startHour), startMin);
    const dayEnd = setMinutes(setHours(date, endHour), endMin);
    const now = new Date();

    while (isBefore(current, dayEnd)) {
      const slotEnd = new Date(current.getTime() + MEETING_DURATION_MINUTES * 60 * 1000);
      
      if (isBefore(current, now)) {
        current = slotEnd;
        continue;
      }

      const hasConflict = existingMeetings.some(meeting => {
        const meetingStart = parseISO(meeting.start_time);
        const meetingEnd = parseISO(meeting.end_time);
        return (
          (isAfter(current, meetingStart) && isBefore(current, meetingEnd)) ||
          (isAfter(slotEnd, meetingStart) && isBefore(slotEnd, meetingEnd)) ||
          (isBefore(current, meetingStart) && isAfter(slotEnd, meetingEnd)) ||
          current.getTime() === meetingStart.getTime()
        );
      });

      if (!hasConflict && (isBefore(slotEnd, dayEnd) || slotEnd.getTime() === dayEnd.getTime())) {
        slots.push({ start: new Date(current), end: slotEnd });
      }

      current = slotEnd;
    }

    return slots;
  };

  const handleBookMeeting = async () => {
    if (!selectedSlot || !guestForm.name || !guestForm.email) return;

    setIsBooking(true);
    try {
      const { error } = await (supabase as any).rpc('public_book_meeting', {
        _host_id: userId,
        _start: selectedSlot.start.toISOString(),
        _end: selectedSlot.end.toISOString(),
        _guest_name: guestForm.name,
        _guest_email: guestForm.email,
        _message: guestForm.message || null,
      });

      if (error) throw error;

      setIsBooked(true);
    } catch (err) {
      console.error('Booking error:', err);
      setError(t('publicPages.booking.bookError'));
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !hostProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('publicPages.booking.somethingWrong')}</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isBooked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('publicPages.booking.meetingBooked')}</h2>
            <p className="text-muted-foreground mb-4">
              {t('publicPages.booking.confirmedWith', { name: hostProfile?.full_name || t('publicPages.booking.theHost') })}
            </p>
            <div className="bg-muted rounded-lg p-4 text-left space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{selectedSlot && format(selectedSlot.start, "EEEE d MMMM yyyy", { locale: dateLocale })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {selectedSlot && format(selectedSlot.start, "HH:mm")} - {selectedSlot && format(selectedSlot.end, "HH:mm")}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {t('publicPages.booking.confirmationSentTo', { email: guestForm.email })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableDates = getAvailableDates();
  const timeSlots = selectedDate ? getTimeSlotsForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Host Info */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {hostProfile?.avatar_url ? (
                <img 
                  src={hostProfile.avatar_url} 
                  alt={hostProfile.full_name || t('publicPages.booking.hostAlt')}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                  {hostProfile?.full_name?.[0] || 'U'}
                </div>
              )}
            </div>
            <CardTitle>{hostProfile?.full_name || t('publicPages.booking.bookMeeting')}</CardTitle>
            {hostProfile?.company_name && (
              <CardDescription>{hostProfile.company_name}</CardDescription>
            )}
          </CardHeader>
        </Card>

        {/* Date Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('publicPages.booking.selectDate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {availableDates.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {t('publicPages.booking.noTimesAvailable')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableDates.map(date => (
                  <Button
                    key={date.toISOString()}
                    variant={selectedDate?.toDateString() === date.toDateString() ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedSlot(null);
                    }}
                    className="flex-col h-auto py-2"
                  >
                    <span className="text-xs">{format(date, 'EEE', { locale: dateLocale })}</span>
                    <span className="font-bold">{format(date, 'd')}</span>
                    <span className="text-xs">{format(date, 'MMM', { locale: dateLocale })}</span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time Selection */}
        {selectedDate && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('publicPages.booking.selectTime')} - {format(selectedDate, 'EEEE d MMMM', { locale: dateLocale })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeSlots.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {t('publicPages.booking.noTimesThisDate')}
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {timeSlots.map(slot => (
                    <Button
                      key={slot.start.toISOString()}
                      variant={selectedSlot?.start.getTime() === slot.start.getTime() ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {format(slot.start, 'HH:mm')}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Guest Info Form */}
        {selectedSlot && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                {t('publicPages.booking.yourDetails')}
              </CardTitle>
              <CardDescription>
                {t('publicPages.booking.meetingDuration', { start: format(selectedSlot.start, 'HH:mm'), end: format(selectedSlot.end, 'HH:mm'), minutes: MEETING_DURATION_MINUTES })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('publicPages.booking.nameLabel')}</Label>
                <Input
                  id="name"
                  placeholder={t('publicPages.booking.namePlaceholder')}
                  value={guestForm.name}
                  onChange={(e) => setGuestForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('publicPages.booking.emailLabel')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('publicPages.booking.emailPlaceholder')}
                  value={guestForm.email}
                  onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">{t('publicPages.booking.messageLabel')}</Label>
                <Textarea
                  id="message"
                  placeholder={t('publicPages.booking.messagePlaceholder')}
                  value={guestForm.message}
                  onChange={(e) => setGuestForm(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button 
                onClick={handleBookMeeting} 
                disabled={isBooking || !guestForm.name || !guestForm.email}
                className="w-full"
              >
                {isBooking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="mr-2 h-4 w-4" />
                )}
                {t('publicPages.booking.confirmBooking')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
