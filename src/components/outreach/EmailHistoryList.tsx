import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  Eye,
  Loader2,
  Inbox,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { EmailApprovalCard } from "./EmailApprovalCard";

interface EmailExecution {
  id: string;
  lead_sequence_id: string;
  step_id: string;
  status: string;
  scheduled_at: string | null;
  executed_at: string | null;
  generated_subject: string | null;
  generated_body: string | null;
  error_message: string | null;
  created_at: string;
  approved_at: string | null;
  step?: {
    step_order: number;
    step_type: string;
    email_prompt: string | null;
  };
  lead_sequence?: {
    sequence?: {
      name: string;
    };
    lead?: {
      company_name: string | null;
      email: string | null;
    };
  };
}

interface SentEmail {
  id: string;
  subject: string;
  body: string;
  recipient_email: string;
  recipient_name: string | null;
  created_at: string;
  source: string;
  opened_at: string | null;
  opened_count: number | null;
}

interface EmailHistoryListProps {
  leadId: string;
}

export function EmailHistoryList({ leadId }: EmailHistoryListProps) {
  const [executions, setExecutions] = useState<EmailExecution[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailExecution | null>(null);
  const [selectedSentEmail, setSelectedSentEmail] = useState<SentEmail | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchExecutions = async () => {
    setIsLoading(true);
    
    // Fetch sent emails directly for this lead
    const { data: sentEmailsData, error: sentEmailsError } = await supabase
      .from("sent_emails")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (sentEmailsError) {
      console.error("Error fetching sent emails:", sentEmailsError);
    } else {
      setSentEmails(sentEmailsData || []);
    }
    
    // Get lead sequences for this lead
    const { data: leadSequences } = await supabase
      .from("lead_sequences")
      .select("id")
      .eq("lead_id", leadId);

    if (!leadSequences || leadSequences.length === 0) {
      setExecutions([]);
      setIsLoading(false);
      return;
    }

    const sequenceIds = leadSequences.map(ls => ls.id);

    // Get all executions for these sequences
    const { data, error } = await supabase
      .from("sequence_step_executions")
      .select(`
        *,
        step:sequence_steps(
          step_order,
          step_type,
          email_prompt,
          sequence_id
        ),
        lead_sequence:lead_sequences(
          sequence:outreach_sequences(name),
          lead:leads(company_name, email)
        )
      `)
      .in("lead_sequence_id", sequenceIds)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching executions:", error);
    } else {
      // Filter to only email steps
      const emailExecutions = (data || []).filter(
        exec => exec.step?.step_type === "email"
      );
      setExecutions(emailExecutions as EmailExecution[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchExecutions();
  }, [leadId]);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "completed":
      case "sent":
        return {
          icon: CheckCircle,
          label: "Skickat",
          variant: "default" as const,
          className: "bg-green-100 text-green-800 border-green-300",
        };
      case "needs_approval":
        return {
          icon: Clock,
          label: "Väntar godkännande",
          variant: "outline" as const,
          className: "bg-yellow-100 text-yellow-800 border-yellow-300",
        };
      case "approved":
        return {
          icon: CheckCircle,
          label: "Godkänt",
          variant: "outline" as const,
          className: "bg-blue-100 text-blue-800 border-blue-300",
        };
      case "pending":
        return {
          icon: Clock,
          label: "Väntar",
          variant: "secondary" as const,
          className: "",
        };
      case "failed":
        return {
          icon: AlertCircle,
          label: "Misslyckades",
          variant: "destructive" as const,
          className: "",
        };
      case "skipped":
        return {
          icon: XCircle,
          label: "Överhoppad",
          variant: "outline" as const,
          className: "text-muted-foreground",
        };
      default:
        return {
          icon: Mail,
          label: status,
          variant: "secondary" as const,
          className: "",
        };
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const pendingApprovals = executions.filter(e => e.status === "needs_approval");
  const otherExecutions = executions.filter(e => e.status !== "needs_approval");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-hidden min-w-0 w-full">
      {/* Pending Approvals Section */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 shrink-0" />
            <span className="truncate">Väntar på godkännande ({pendingApprovals.length})</span>
          </h3>
          {pendingApprovals.map(execution => (
            <EmailApprovalCard
              key={execution.id}
              execution={execution}
              onApproved={fetchExecutions}
              onRejected={fetchExecutions}
            />
          ))}
        </div>
      )}

      {/* Sent Emails (Direct/Single emails) */}
      {sentEmails.length > 0 && (
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="h-5 w-5" />
              Skickade mail
            </CardTitle>
            <CardDescription>
              Enskilda mail skickade direkt till denna lead
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <div className="space-y-3">
              {sentEmails.map((email) => {
                const isExpanded = expandedIds.has(`sent-${email.id}`);

                return (
                  <Collapsible
                    key={`sent-${email.id}`}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(`sent-${email.id}`)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className="w-full min-w-0 p-3 sm:p-4 flex items-start sm:items-center gap-2 sm:gap-3 hover:bg-muted/50 transition-colors text-left overflow-hidden">
                          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 sm:mt-0 text-green-600" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm sm:text-base truncate pr-2">
                              {email.subject || "Inget ämne"}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              Till: {email.recipient_email} • {format(new Date(email.created_at), "d MMM, HH:mm", { locale: sv })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0 max-w-[40%] sm:max-w-none">
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-300 text-[10px] sm:text-xs px-1.5 sm:px-2">
                              <span className="hidden sm:inline">Skickat</span>
                              <CheckCircle className="h-3 w-3 sm:hidden" />
                            </Badge>
                            {email.opened_at && (
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] sm:text-xs px-1.5 sm:px-2">
                                <Eye className="h-3 w-3 mr-1" />
                                <span className="hidden sm:inline">{email.opened_count || 1}</span>
                              </Badge>
                            )}
                            <ChevronDown className={`h-4 w-4 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 border-t bg-muted/30">
                          <div className="pt-4 space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Innehåll</Label>
                              <div className="p-3 rounded-lg bg-background text-sm whitespace-pre-wrap break-words overflow-hidden">
                                {email.body}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedSentEmail(email)}
                              >
                                <Eye className="mr-2 h-3 w-3" />
                                Visa fullständigt
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sequence Email History */}
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Sekvensmail
          </CardTitle>
          <CardDescription>
            Mail som skickats via outreach-sekvenser
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          {otherExecutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <h3 className="text-base font-semibold text-foreground mb-1">
                Inga sekvensmail ännu
              </h3>
              <p className="text-sm text-muted-foreground">
                Mail kommer att visas här när de skickas från outreach-sekvenser
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {otherExecutions.map((execution) => {
                const statusInfo = getStatusInfo(execution.status);
                const StatusIcon = statusInfo.icon;
                const isExpanded = expandedIds.has(execution.id);

                return (
                  <Collapsible
                    key={execution.id}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(execution.id)}
                  >
                    <div className="border rounded-lg overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button className="w-full min-w-0 p-3 sm:p-4 flex items-start sm:items-center gap-2 sm:gap-3 hover:bg-muted/50 transition-colors text-left overflow-hidden">
                          <StatusIcon className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 sm:mt-0 ${
                            execution.status === "completed" || execution.status === "sent"
                              ? "text-green-600"
                              : execution.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm sm:text-base truncate pr-2">
                              {execution.generated_subject || "Inget ämne"}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              Steg {execution.step?.step_order} • {
                                execution.executed_at
                                  ? format(new Date(execution.executed_at), "d MMM, HH:mm", { locale: sv })
                                  : execution.scheduled_at
                                  ? format(new Date(execution.scheduled_at), "d MMM HH:mm", { locale: sv })
                                  : format(new Date(execution.created_at), "d MMM", { locale: sv })
                              }
                            </p>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0 max-w-[40%] sm:max-w-none">
                            <Badge variant={statusInfo.variant} className={`${statusInfo.className} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
                              <span className="hidden sm:inline">{statusInfo.label}</span>
                              <StatusIcon className="h-3 w-3 sm:hidden" />
                            </Badge>
                            <ChevronDown className={`h-4 w-4 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 border-t bg-muted/30">
                          <div className="pt-4 space-y-3">
                            {execution.generated_body && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Innehåll</Label>
                                <div className="p-3 rounded-lg bg-background text-sm whitespace-pre-wrap break-words overflow-hidden">
                                  {execution.generated_body}
                                </div>
                              </div>
                            )}
                            {execution.error_message && (
                              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                <strong>Fel:</strong> {execution.error_message}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedEmail(execution)}
                              >
                                <Eye className="mr-2 h-3 w-3" />
                                Visa fullständigt
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Email Dialog - Sequence */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Skickat mail
            </DialogTitle>
            <DialogDescription>
              {selectedEmail?.executed_at && (
                <>Skickades {format(new Date(selectedEmail.executed_at), "d MMMM yyyy, HH:mm", { locale: sv })}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Ämne</Label>
                <div className="p-3 rounded-lg bg-muted font-medium break-words overflow-hidden">
                  {selectedEmail.generated_subject || "Inget ämne"}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Meddelande</Label>
                <div className="p-4 rounded-lg bg-muted whitespace-pre-wrap break-words text-sm leading-relaxed max-h-[400px] overflow-y-auto overflow-x-hidden">
                  {selectedEmail.generated_body || "Inget innehåll"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Email Dialog - Sent Email */}
      <Dialog open={!!selectedSentEmail} onOpenChange={() => setSelectedSentEmail(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Skickat mail
            </DialogTitle>
            <DialogDescription>
              {selectedSentEmail?.created_at && (
                <>Skickades {format(new Date(selectedSentEmail.created_at), "d MMMM yyyy, HH:mm", { locale: sv })}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedSentEmail && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Till</Label>
                <div className="p-3 rounded-lg bg-muted break-words overflow-hidden">
                  {selectedSentEmail.recipient_name && (
                    <span className="font-medium">{selectedSentEmail.recipient_name} • </span>
                  )}
                  {selectedSentEmail.recipient_email}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Ämne</Label>
                <div className="p-3 rounded-lg bg-muted font-medium break-words overflow-hidden">
                  {selectedSentEmail.subject || "Inget ämne"}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Meddelande</Label>
                <div className="p-4 rounded-lg bg-muted whitespace-pre-wrap break-words text-sm leading-relaxed max-h-[400px] overflow-y-auto overflow-x-hidden">
                  {selectedSentEmail.body || "Inget innehåll"}
                </div>
              </div>
              {selectedSentEmail.opened_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span>
                    Öppnat {format(new Date(selectedSentEmail.opened_at), "d MMMM yyyy, HH:mm", { locale: sv })}
                    {selectedSentEmail.opened_count && selectedSentEmail.opened_count > 1 && (
                      <> ({selectedSentEmail.opened_count} gånger)</>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
