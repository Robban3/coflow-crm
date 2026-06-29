import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Search, Filter, Calendar, CheckSquare, Loader2, Building2, UserPlus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { notifyTaskAssigned } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { useTranslation } from "@/i18n/LanguageProvider";

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const priorityKeys: Record<string, string> = {
  low: "tasks.priorityLow", medium: "tasks.priorityMedium", high: "tasks.priorityHigh", urgent: "tasks.priorityUrgent",
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  lead_id: string | null;
  lead?: { id: string; company_name: string | null; contact_name: string | null } | null;
}

export default function TasksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { members: teamMembers, getMember } = useTeamMembers();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, lead:leads(id, company_name, contact_name)")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as any);
      } else {
        // Completed tasks drop out of the default list (still reachable via the
        // "Klar"-filter).
        query = query.neq("status", "completed" as any);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === "completed" ? "todo" : "completed";
    const { error } = await supabase.from("tasks").update({
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    }).eq("id", task.id);

    if (error) {
      toast({ title: t("tasks.toastError"), description: t("tasks.toastUpdateFail"), variant: "destructive" });
    } else {
      invalidate();
    }
  };

  const handleDeleteTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t("tasks.deleteConfirm"))) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast({ title: t("tasks.toastError"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("tasks.taskDeleted") });
      invalidate();
    }
  };

  const handleAssignTask = async (taskId: string, newAssigneeId: string, task: Task) => {
    const { error } = await supabase.from("tasks").update({ assigned_to: newAssigneeId }).eq("id", taskId);
    if (error) {
      toast({ title: t("tasks.toastError"), description: t("tasks.toastAssignFail"), variant: "destructive" });
    } else {
      if (newAssigneeId !== user?.id) {
        await notifyTaskAssigned(newAssigneeId, task.title, taskId, task.lead_id);
      }
      toast({ title: t("tasks.toastAssignedTitle"), description: t("tasks.toastAssignedDesc", { name: getMember(newAssigneeId)?.full_name || t("tasks.theUser") }) });
      invalidate();
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return task.title.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q) || task.lead?.company_name?.toLowerCase().includes(q) || task.lead?.contact_name?.toLowerCase().includes(q);
  });

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <AppLayout title={t("tasks.pageTitle")}>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">{t("tasks.heading")}</h2>
            <p className="text-sm md:text-base text-muted-foreground">{t("tasks.subtitle")}</p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("tasks.newTask")}
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("tasks.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("tasks.statusFilter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("tasks.statusAll")}</SelectItem>
                  <SelectItem value="todo">{t("tasks.statusTodo")}</SelectItem>
                  <SelectItem value="in_progress">{t("tasks.statusInProgress")}</SelectItem>
                  <SelectItem value="completed">{t("tasks.statusCompleted")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {tasks.length === 0 ? t("tasks.emptyNoTasks") : t("tasks.emptyNoMatch")}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {tasks.length === 0 ? t("tasks.emptyNoTasksDesc") : t("tasks.emptyNoMatchDesc")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn("flex items-start sm:items-center gap-3 sm:gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer", task.status === "completed" && "opacity-60")}
                    onClick={() => task.lead_id && navigate(`/leads/${task.lead_id}`)}
                  >
                    <Checkbox
                      checked={task.status === "completed"}
                      className="h-5 w-5 mt-0.5 sm:mt-0"
                      onClick={(e) => { e.stopPropagation(); handleToggleComplete(task); }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium text-foreground", task.status === "completed" && "line-through")}>{task.title}</p>
                      {task.description && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>}
                      {task.lead && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                          <Building2 className="h-3 w-3" />
                          {task.lead.company_name || task.lead.contact_name}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      {isAdmin ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1.5 hover:bg-muted rounded p-1 transition-colors" onClick={(e) => e.stopPropagation()}>
                              {task.assigned_to ? <UserAvatar userId={task.assigned_to} size="sm" /> : (
                                <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                                  <UserPlus className="h-3 w-3 text-muted-foreground/50" />
                                </div>
                              )}
                              <span className="text-xs text-muted-foreground max-w-[120px] truncate hidden sm:inline">
                                {task.assigned_to ? (getMember(task.assigned_to)?.full_name || getMember(task.assigned_to)?.email || "") : t("tasks.assignTo")}
                              </span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2" align="end" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs font-medium text-muted-foreground mb-2 px-2">{t("tasks.assignTo")}</p>
                            <div className="space-y-1">
                              {teamMembers.map((member) => (
                                <button
                                  key={member.id}
                                  className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm", task.assigned_to === member.id && "bg-muted")}
                                  onClick={() => handleAssignTask(task.id, member.id, task)}
                                >
                                  <UserAvatar userId={member.id} size="sm" />
                                  <span className="truncate">{member.full_name || member.email}</span>
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : task.assigned_to ? (
                        <div className="flex items-center gap-1.5">
                          <UserAvatar userId={task.assigned_to} size="sm" />
                          <span className="text-xs text-muted-foreground max-w-[120px] truncate hidden sm:inline">
                            {getMember(task.assigned_to)?.full_name || getMember(task.assigned_to)?.email || ""}
                          </span>
                        </div>
                      ) : null}
                      <Badge variant="secondary" className={cn("text-xs", priorityColors[task.priority])}>{t(priorityKeys[task.priority])}</Badge>
                      {task.due_date && (
                        <div className={cn("flex items-center text-xs", isOverdue(task.due_date) && task.status !== "completed" ? "text-destructive" : "text-muted-foreground")}>
                          <Calendar className="mr-1 h-3 w-3" />
                          {format(new Date(task.due_date), "d MMM", { locale: dateLocale })}
                        </div>
                      )}
                      {(task.created_by === user?.id || task.assigned_to === user?.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title={t("tasks.delete")}
                          onClick={(e) => handleDeleteTask(task, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateTaskDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onCreated={invalidate} />
    </AppLayout>
  );
}
