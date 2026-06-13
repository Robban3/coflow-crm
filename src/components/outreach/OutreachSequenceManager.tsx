import { useTranslation } from "@/i18n/LanguageProvider";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Clock,
  Plus,
  Play,
  Pause,
  X,
  Loader2,
  Send,
  ListTodo,
  Trash2,
  Sparkles,
  GripVertical,
  ChevronDown,
  Eye,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMarket } from "@/hooks/useMarket";
import { format, addDays } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Sequence {
  id: string;
  name: string;
  description: string | null;
}

interface SequenceStep {
  id: string;
  step_order: number;
  step_type: 'email' | 'task' | 'wait';
  template_id: string | null;
  task_title: string | null;
  task_description: string | null;
  delay_days: number;
  email_prompt: string | null;
  email_subject: string | null;
}

interface LeadSequence {
  id: string;
  sequence_id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  current_step: number;
  started_at: string;
  next_step_at: string | null;
  sequence?: Sequence;
}

interface OutreachSequenceManagerProps {
  leadId: string;
  leadEmail: string | null;
  leadName: string | null;
}

export function OutreachSequenceManager({ leadId, leadEmail, leadName }: OutreachSequenceManagerProps) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [leadSequences, setLeadSequences] = useState<LeadSequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<{ subject: string; body: string } | null>(null);
  const [previewStepIndex, setPreviewStepIndex] = useState<number>(0);
  
  // New sequence form
  const [newSequence, setNewSequence] = useState({
    name: "",
    description: "",
    steps: [] as Array<{
      step_type: 'email' | 'task';
      email_prompt: string;
      task_title: string;
      task_description: string;
      delay_days: number;
    }>
  });

  const { toast } = useToast();
  const { market } = useMarket();

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [sequencesRes, leadSequencesRes] = await Promise.all([
      supabase.from('outreach_sequences').select('*').order('name'),
      supabase
        .from('lead_sequences')
        .select('*, sequence:outreach_sequences(*)')
        .eq('lead_id', leadId),
    ]);

    if (!sequencesRes.error && sequencesRes.data) {
      setSequences(sequencesRes.data);
    }
    
    if (!leadSequencesRes.error && leadSequencesRes.data) {
      setLeadSequences(leadSequencesRes.data as LeadSequence[]);
    }
    
    setIsLoading(false);
  };

  const handleEnrollInSequence = async () => {
    if (!selectedSequence) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: steps } = await supabase
        .from('sequence_steps')
        .select('*')
        .eq('sequence_id', selectedSequence)
        .order('step_order')
        .limit(1);

      const firstStepDelay = steps?.[0]?.delay_days || 0;
      const nextStepAt = addDays(new Date(), firstStepDelay);

      const { error } = await supabase.from('lead_sequences').insert({
        lead_id: leadId,
        sequence_id: selectedSequence,
        status: 'active',
        current_step: 0,
        next_step_at: nextStepAt.toISOString(),
        created_by: user?.id,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: t("outreach.mgr.alreadyEnrolledTitle"),
            description: t("outreach.mgr.alreadyEnrolledDesc"),
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: t("outreach.mgr.sequenceStartedTitle"),
          description: t("outreach.mgr.sequenceStartedDesc"),
        });
        setShowEnrollDialog(false);
        setSelectedSequence("");
        fetchData();
      }
    } catch (error) {
      console.error('Error enrolling in sequence:', error);
      toast({
        title: t("outreach.common.error"),
        description: t("outreach.mgr.enrollError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSequence = async () => {
    if (!newSequence.name || newSequence.steps.length === 0) {
      toast({
        title: t("outreach.seq.fillAllFields"),
        description: t("outreach.seq.fillAllFieldsDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: sequence, error: seqError } = await supabase
        .from('outreach_sequences')
        .insert({
          name: newSequence.name,
          description: newSequence.description || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (seqError) throw seqError;

      const stepsToInsert = newSequence.steps.map((step, index) => ({
        sequence_id: sequence.id,
        step_order: index + 1,
        step_type: step.step_type,
        email_prompt: step.step_type === 'email' ? step.email_prompt || null : null,
        task_title: step.step_type === 'task' ? step.task_title : null,
        task_description: step.step_type === 'task' ? step.task_description : null,
        delay_days: step.delay_days,
        ai_generated: step.step_type === 'email',
      }));

      const { error: stepsError } = await supabase
        .from('sequence_steps')
        .insert(stepsToInsert);

      if (stepsError) throw stepsError;

      toast({
        title: t("outreach.seq.createdTitle"),
        description: `${newSequence.name} har skapats med ${newSequence.steps.length} steg`,
      });

      setShowCreateDialog(false);
      setNewSequence({ name: "", description: "", steps: [] });
      fetchData();

    } catch (error) {
      console.error('Error creating sequence:', error);
      toast({
        title: t("outreach.common.error"),
        description: t("outreach.seq.createError"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (leadSequenceId: string, newStatus: 'paused' | 'active' | 'cancelled') => {
    const { error } = await supabase
      .from('lead_sequences')
      .update({ 
        status: newStatus,
        completed_at: newStatus === 'cancelled' ? new Date().toISOString() : null 
      })
      .eq('id', leadSequenceId);

    if (error) {
      toast({
        title: t("outreach.common.error"),
        description: t("outreach.mgr.statusUpdateError"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("outreach.mgr.statusUpdated"),
      });
      fetchData();
    }
  };

  const addStep = (type: 'email' | 'task') => {
    setNewSequence(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          step_type: type,
          email_prompt: type === 'email' ? getDefaultPrompt(prev.steps.length + 1) : "",
          task_title: "",
          task_description: "",
          delay_days: prev.steps.length === 0 ? 0 : 3,
        }
      ]
    }));
  };

  const getDefaultPrompt = (stepNumber: number) => {
    if (stepNumber === 1) {
      return t("outreach.seq.defaultPromptStep1");
    } else if (stepNumber === 2) {
      return t("outreach.seq.defaultPromptStep2");
    } else {
      return t("outreach.seq.defaultPromptStepN", { number: stepNumber - 1 });
    }
  };

  const updateStep = (index: number, field: string, value: string | number) => {
    setNewSequence(prev => ({
      ...prev,
      steps: prev.steps.map((step, i) => 
        i === index ? { ...step, [field]: value } : step
      )
    }));
  };

  const removeStep = (index: number) => {
    setNewSequence(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const handlePreviewEmail = async (stepIndex: number) => {
    setPreviewStepIndex(stepIndex);
    setIsGeneratingPreview(true);
    setShowPreviewDialog(true);
    setPreviewEmail(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await supabase.functions.invoke('generate-outreach-email', {
        body: {
          leadId,
          stepNumber: stepIndex + 1,
          totalSteps: newSequence.steps.length,
          emailPrompt: newSequence.steps[stepIndex].email_prompt,
          userId: user?.id,
          market,
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setPreviewEmail({
        subject: response.data.subject,
        body: response.data.body,
      });
    } catch (error) {
      console.error('Error generating preview:', error);
      toast({
        title: t("outreach.mgr.previewError"),
        description: error instanceof Error ? error.message : t("outreach.mgr.unknownError"),
        variant: "destructive",
      });
      setShowPreviewDialog(false);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">{t("outreach.mgr.statusActive")}</Badge>;
      case 'paused':
        return <Badge variant="secondary">{t("outreach.mgr.statusPaused")}</Badge>;
      case 'completed':
        return <Badge variant="outline">{t("outreach.mgr.statusCompleted")}</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">{t("outreach.mgr.statusCancelled")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Sequences */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">{t("outreach.mgr.activeSequencesTitle")}</CardTitle>
            <CardDescription>{t("outreach.mgr.activeSequencesDesc")}</CardDescription>
          </div>
          <Button onClick={() => setShowEnrollDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />{t("outreach.mgr.startSequence")}</Button>
        </CardHeader>
        <CardContent>
          {!leadEmail ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>{t("outreach.mgr.noEmailTitle")}</p>
              <p className="text-sm">{t("outreach.mgr.noEmailDesc")}</p>
            </div>
          ) : leadSequences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>{t("outreach.mgr.noActiveTitle")}</p>
              <p className="text-sm">{t("outreach.mgr.noActiveDesc")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leadSequences.map((ls) => (
                <div key={ls.id} className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Send className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{ls.sequence?.name || t("outreach.approval.unknownSequence")}</p>
                        <p className="text-sm text-muted-foreground">
                          {t("outreach.mgr.stepStarted", { step: ls.current_step + 1, date: format(new Date(ls.started_at), "d MMM", { locale: dateLocale }) })}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(ls.status)}
                  </div>
                  
                  {ls.next_step_at && ls.status === 'active' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Clock className="h-4 w-4" />
                      {t("outreach.mgr.nextStep", { date: format(new Date(ls.next_step_at), "d MMMM HH:mm", { locale: dateLocale }) })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {ls.status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleUpdateStatus(ls.id, 'paused')}
                      >
                        <Pause className="h-4 w-4 mr-1" />{t("outreach.mgr.pause")}</Button>
                    )}
                    {ls.status === 'paused' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleUpdateStatus(ls.id, 'active')}
                      >
                        <Play className="h-4 w-4 mr-1" />{t("outreach.mgr.resume")}</Button>
                    )}
                    {(ls.status === 'active' || ls.status === 'paused') && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleUpdateStatus(ls.id, 'cancelled')}
                      >
                        <X className="h-4 w-4 mr-1" />{t("outreach.common.cancel")}</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enroll Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t("outreach.mgr.enrollDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("outreach.mgr.enrollDialogDesc", { name: leadName || t("outreach.mgr.thisLead") })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {sequences.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">{t("outreach.mgr.noSequencesYet")}</p>
                <Button onClick={() => {
                  setShowEnrollDialog(false);
                  setShowCreateDialog(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />{t("outreach.seq.createSequence")}</Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("outreach.mgr.selectSequence")}</Label>
                  <Select value={selectedSequence} onValueChange={setSelectedSequence}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("outreach.mgr.selectSequencePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {sequences.map((seq) => (
                        <SelectItem key={seq.id} value={seq.id}>
                          {seq.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" onClick={() => {
                    setShowEnrollDialog(false);
                    setShowCreateDialog(true);
                  }}>
                    <Plus className="mr-2 h-4 w-4" />{t("outreach.seq.createDialogTitle")}</Button>
                </div>
              </>
            )}
          </div>

          {sequences.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>{t("outreach.common.cancel")}</Button>
              <Button onClick={handleEnrollInSequence} disabled={isSaving || !selectedSequence}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("outreach.mgr.starting")}</>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />{t("outreach.mgr.startSequence")}</>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Sequence Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />{t("outreach.mgr.createDialogTitle")}</DialogTitle>
            <DialogDescription>{t("outreach.mgr.createDialogDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sequence Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="seq-name">{t("outreach.mgr.seqNameLabel")}</Label>
                <Input
                  id="seq-name"
                  placeholder={t("outreach.mgr.seqNamePlaceholder")}
                  value={newSequence.name}
                  onChange={(e) => setNewSequence(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seq-desc">{t("outreach.seq.colDescription")}</Label>
                <Input
                  id="seq-desc"
                  placeholder={t("outreach.mgr.seqDescPlaceholder")}
                  value={newSequence.description}
                  onChange={(e) => setNewSequence(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Steps Builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">{t("outreach.mgr.sequenceSteps")}</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => addStep('email')}
                  >
                    <Mail className="h-4 w-4 mr-1" />{t("outreach.mgr.email")}</Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => addStep('task')}
                  >
                    <ListTodo className="h-4 w-4 mr-1" />{t("outreach.seq.typeTask")}</Button>
                </div>
              </div>

              {newSequence.steps.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">{t("outreach.mgr.noStepsTitle")}</p>
                  <p className="text-sm">{t("outreach.mgr.noStepsDesc")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {newSequence.steps.map((step, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        "rounded-lg border p-4 relative",
                        step.step_type === 'email' 
                          ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900" 
                          : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                      )}
                    >
                      {/* Step header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                            step.step_type === 'email' 
                              ? "bg-blue-500 text-white" 
                              : "bg-amber-500 text-white"
                          )}>
                            {index + 1}
                          </div>
                          <Badge variant={step.step_type === 'email' ? 'default' : 'secondary'}>
                            {step.step_type === 'email' ? (
                              <><Sparkles className="h-3 w-3 mr-1" />{t("outreach.mgr.aiEmail")}</>
                            ) : (
                              <><ListTodo className="h-3 w-3 mr-1" />{t("outreach.seq.typeTask")}</>
                            )}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {step.step_type === 'email' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreviewEmail(index)}
                              className="h-8 px-2"
                            >
                              <Eye className="h-4 w-4 mr-1" />{t("outreach.mgr.preview")}</Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeStep(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Step content */}
                      <div className="space-y-3">
                        {/* Delay */}
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {index === 0 ? "Skickas" : t("outreach.seq.wait")}
                          </span>
                          <Select
                            value={step.delay_days.toString()}
                            onValueChange={(v) => updateStep(index, 'delay_days', parseInt(v))}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">{t("outreach.seq.immediate")}</SelectItem>
                              <SelectItem value="1">1 dag</SelectItem>
                              <SelectItem value="2">2 dagar</SelectItem>
                              <SelectItem value="3">3 dagar</SelectItem>
                              <SelectItem value="5">5 dagar</SelectItem>
                              <SelectItem value="7">1 vecka</SelectItem>
                              <SelectItem value="14">2 veckor</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">
                            {index === 0 ? "efter start" : t("outreach.mgr.sinceLastStep")}
                          </span>
                        </div>

                        {step.step_type === 'email' ? (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">{t("outreach.mgr.aiInstruction")}</Label>
                            <Textarea
                              placeholder={t("outreach.mgr.aiInstructionPlaceholder")}
                              value={step.email_prompt}
                              onChange={(e) => updateStep(index, 'email_prompt', e.target.value)}
                              rows={2}
                              className="text-sm resize-none"
                            />
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{t("outreach.seq.taskTitle")}</Label>
                              <Input
                                placeholder={t("outreach.mgr.taskTitlePlaceholder")}
                                value={step.task_title}
                                onChange={(e) => updateStep(index, 'task_title', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{t("outreach.seq.colDescription")}</Label>
                              <Input
                                placeholder={t("outreach.mgr.taskDescPlaceholder")}
                                value={step.task_description}
                                onChange={(e) => updateStep(index, 'task_description', e.target.value)}
                                className="h-9"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Arrow connector */}
                      {index < newSequence.steps.length - 1 && (
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10">
                          <ChevronDown className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setNewSequence({ name: "", description: "", steps: [] });
            }}>{t("outreach.common.cancel")}</Button>
            <Button 
              onClick={handleCreateSequence} 
              disabled={isSaving || !newSequence.name || newSequence.steps.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("outreach.common.saving")}</>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />{t("outreach.seq.createSequence")}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Email Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t("outreach.mgr.previewDialogTitle", { step: previewStepIndex + 1 })}
            </DialogTitle>
            <DialogDescription>{t("outreach.mgr.previewDialogDesc")}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isGeneratingPreview ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">{t("outreach.mgr.generatingEmail")}</p>
              </div>
            ) : previewEmail ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t("outreach.common.subject")}</Label>
                  <div className="p-3 rounded-lg bg-muted font-medium">
                    {previewEmail.subject}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t("outreach.common.message")}</Label>
                  <div className="p-4 rounded-lg bg-muted whitespace-pre-wrap text-sm leading-relaxed">
                    {previewEmail.body}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>{t("outreach.mgr.close")}</Button>
            {previewEmail && (
              <Button onClick={() => handlePreviewEmail(previewStepIndex)}>
                <Sparkles className="mr-2 h-4 w-4" />{t("outreach.approval.generateNew")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
