import { useTranslation } from "@/i18n/LanguageProvider";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  Eye,
  EyeOff,
  Search,
  Loader2,
  Inbox,
  Building2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { DesktopTable, MobileCardList } from "@/components/ui/responsive-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useAuth } from "@/hooks/useAuth";

interface SentEmail {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  sent_by: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  source: string;
  opened_at: string | null;
  opened_count: number;
  created_at: string;
  lead?: {
    id: string;
    company_name: string | null;
    contact_name: string | null;
  } | null;
}

interface SentEmailsListProps {
  currentUserOnly?: boolean;
}

export function SentEmailsList({ currentUserOnly = false }: SentEmailsListProps) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [senderFilter, setSenderFilter] = useState<string>("all");
  const [openedFilter, setOpenedFilter] = useState<string>("all");
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
  
  const { members } = useTeamMembers();
  const { user, isAdmin } = useAuth();

  const fetchEmails = async () => {
    setIsLoading(true);
    
    // Build query - admins can see all in Outreach page, but MAIL module is always per-user
    // Limit to 200 most recent for performance
    let query = supabase
      .from("sent_emails")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    
    if (user?.id && (currentUserOnly || !isAdmin)) {
      query = query.eq("sent_by", user.id);
    }

    const { data: emailsData, error } = await query;

    if (error) {
      console.error("Error fetching sent emails:", error);
      setEmails([]);
      setIsLoading(false);
      return;
    }

    if (!emailsData || emailsData.length === 0) {
      setEmails([]);
      setIsLoading(false);
      return;
    }

    // Fetch related leads
    const leadIds = [...new Set(emailsData.filter(e => e.lead_id).map(e => e.lead_id))];
    let leadsMap = new Map();
    
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, company_name, contact_name")
        .in("id", leadIds);
      
      if (leads) {
        leadsMap = new Map(leads.map(l => [l.id, l]));
      }
    }

    // Combine data
    const emailsWithRelations = emailsData.map(email => ({
      ...email,
      lead: email.lead_id ? leadsMap.get(email.lead_id) || null : null,
    }));

    setEmails(emailsWithRelations as SentEmail[]);
    setIsLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchEmails();
    }
  }, [user, isAdmin, currentUserOnly]);

  const filteredEmails = useMemo(() => {
    let result = emails;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(email =>
        email.recipient_email?.toLowerCase().includes(query) ||
        email.recipient_name?.toLowerCase().includes(query) ||
        email.subject?.toLowerCase().includes(query) ||
        email.lead?.company_name?.toLowerCase().includes(query) ||
        email.lead?.contact_name?.toLowerCase().includes(query)
      );
    }

    // Sender filter
    if (!currentUserOnly && senderFilter !== "all") {
      result = result.filter(email => email.sent_by === senderFilter);
    }

    // Opened filter
    if (openedFilter === "opened") {
      result = result.filter(email => email.opened_at !== null);
    } else if (openedFilter === "not_opened") {
      result = result.filter(email => email.opened_at === null);
    }

    return result;
  }, [emails, searchQuery, senderFilter, openedFilter, currentUserOnly]);

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "sequence":
        return "Sekvens";
      case "quick_outreach":
        return "Snabbmail";
      case "single_email":
        return "Enskilt mail";
      default:
        return "Manuellt";
    }
  };

  const getDaysAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { locale: dateLocale, addSuffix: true });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderMobileCard = (email: SentEmail, index: number) => (
    <Card key={email.id} className="overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{email.subject}</p>
            <p className="text-sm text-muted-foreground truncate">
              Till: {email.recipient_name || email.recipient_email}
            </p>
          </div>
          <Badge variant={email.opened_at ? "default" : "secondary"} className="shrink-0">
            {email.opened_at ? (
              <><Eye className="h-3 w-3 mr-1" />{t("outreach.sent.openedBadge")}</>
            ) : (
              <><EyeOff className="h-3 w-3 mr-1" />{t("outreach.sent.notOpenedBadge")}</>
            )}
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <UserAvatar userId={email.sent_by} size="sm" />
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getDaysAgo(email.created_at)}
          </div>
        </div>

        {email.lead && (
          <Link 
            to={`/leads/${email.lead.id}`}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Building2 className="h-3 w-3" />
            {email.lead.company_name || t("outreach.common.unknownCompany")}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <Badge variant="outline" className="text-xs">
            {getSourceLabel(email.source)}
          </Badge>
          <Button size="sm" variant="ghost" onClick={() => setSelectedEmail(email)}>
            <Eye className="h-4 w-4 mr-1" />{t("outreach.sent.view")}</Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("outreach.sent.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {!currentUserOnly && (
              <Select value={senderFilter} onValueChange={setSenderFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("outreach.sent.allSenders")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("outreach.sent.allSenders")}</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={openedFilter} onValueChange={setOpenedFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder={t("outreach.sent.allMail")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("outreach.sent.allMail")}</SelectItem>
                <SelectItem value="opened">{t("outreach.sent.opened")}</SelectItem>
                <SelectItem value="not_opened">{t("outreach.sent.notOpened")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredEmails.length} mail totalt</span>
        <span>{t("outreach.sent.openedCount", { count: filteredEmails.filter(e => e.opened_at).length })}</span>
      </div>

      {/* Email List */}
      {filteredEmails.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">{t("outreach.sent.emptyTitle")}</h3>
            <p className="text-muted-foreground">
              {searchQuery || (!currentUserOnly && senderFilter !== "all") || openedFilter !== "all"
                ? "Inga mail matchar dina filter"
                : t("outreach.sent.emptyDefault")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Cards */}
          <MobileCardList
            items={filteredEmails}
            renderCard={renderMobileCard}
          />

          {/* Desktop Table */}
          <DesktopTable>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">{t("outreach.sent.colRecipient")}</TableHead>
                    <TableHead>{t("outreach.common.subject")}</TableHead>
                    <TableHead className="w-[150px]">{t("outreach.common.sender")}</TableHead>
                    <TableHead className="w-[120px]">{t("outreach.sent.colSource")}</TableHead>
                    <TableHead className="w-[100px]">{t("outreach.sent.colStatus")}</TableHead>
                    <TableHead className="w-[120px]">{t("outreach.history.statusSent")}</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmails.map((email) => (
                    <TableRow key={email.id} className="group">
                      <TableCell>
                        <div className="space-y-1">
                          {email.lead ? (
                            <Link 
                              to={`/leads/${email.lead.id}`}
                              className="font-medium text-primary hover:underline flex items-center gap-1"
                            >
                              <Building2 className="h-3.5 w-3.5" />
                              {email.lead.company_name || t("outreach.common.unknownCompany")}
                            </Link>
                          ) : (
                            <span className="font-medium">{email.recipient_name || "—"}</span>
                          )}
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {email.recipient_email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="truncate max-w-[300px]">{email.subject}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar userId={email.sent_by} size="sm" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {getSourceLabel(email.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {email.opened_at ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                            <Eye className="h-3 w-3 mr-1" />
                            {email.opened_count > 1 ? t("outreach.sent.openedCountBadge", { count: email.opened_count }) : t("outreach.sent.openedBadge")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <EyeOff className="h-3 w-3 mr-1" />{t("outreach.sent.notOpenedBadge")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {getDaysAgo(email.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </DesktopTable>
        </>
      )}

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />{t("outreach.common.sentMail")}</DialogTitle>
            <DialogDescription>
              {selectedEmail?.created_at && (
                <>{t("outreach.common.sentAt", { date: format(new Date(selectedEmail.created_at), "d MMMM yyyy, HH:mm", { locale: dateLocale }) })}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">{t("outreach.common.to")}</Label>
                  <p className="font-medium">{selectedEmail.recipient_email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t("outreach.common.sender")}</Label>
                  <div className="flex items-center gap-2">
                    <UserAvatar userId={selectedEmail.sent_by} size="sm" />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedEmail.opened_at ? (
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                    <Eye className="h-3 w-3 mr-1" />
                    {selectedEmail.opened_count > 1 ? t("outreach.sent.openedTimesBadge", { count: selectedEmail.opened_count }) : t("outreach.sent.openedBadge")}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <EyeOff className="h-3 w-3 mr-1" />{t("outreach.sent.notOpenedYet")}</Badge>
                )}
                <Badge variant="outline">
                  {getSourceLabel(selectedEmail.source)}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("outreach.common.subject")}</Label>
                <div className="p-3 rounded-lg bg-muted font-medium break-words">
                  {selectedEmail.subject}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">{t("outreach.common.message")}</Label>
                <div className="p-4 rounded-lg bg-muted whitespace-pre-wrap break-words text-sm leading-relaxed max-h-[400px] overflow-y-auto">
                  {selectedEmail.body}
                </div>
              </div>

              {selectedEmail.lead && (
                <Button variant="outline" asChild className="w-full">
                  <Link to={`/leads/${selectedEmail.lead.id}`}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Visa lead: {selectedEmail.lead.company_name}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
