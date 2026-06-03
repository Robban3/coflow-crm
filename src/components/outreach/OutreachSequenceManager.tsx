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
import { sv } from "date-fns/locale";
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
            title: "Redan registrerad",
            description: "Denna lead är redan registrerad i denna sekvens",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Sekvens startad!",
          description: "Leaden har registrerats i sekvensen",
        });
        setShowEnrollDialog(false);
        setSelectedSequence("");
        fetchData();
      }
    } catch (error) {
      console.error('Error enrolling in sequence:', error);
      toast({
        title: "Fel",
        description: "Kunde inte starta sekvensen",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSequence = async () => {
    if (!newSequence.name || newSequence.steps.length === 0) {
      toast({
        title: "Fyll i alla fält",
        description: "Sekvensen behöver ett namn och minst ett steg",
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
        title: "Sekvens skapad!",
        description: `${newSequence.name} har skapats med ${newSequence.steps.length} steg`,
      });

      setShowCreateDialog(false);
      setNewSequence({ name: "", description: "", steps: [] });
      fetchData();

    } catch (error) {
      console.error('Error creating sequence:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa sekvensen",
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
        title: "Fel",
        description: "Kunde inte uppdatera status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status uppdaterad",
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
      return "Första kontakten - presentera dig och referera till webbanalysens resultat";
    } else if (stepNumber === 2) {
      return "Uppföljning - referera till första mailet och ge mer värde";
    } else {
      return `Uppföljning #${stepNumber - 1}`;
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
        title: "Kunde inte generera förhandsvisning",
        description: error instanceof Error ? error.message : "Okänt fel",
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
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">Aktiv</Badge>;
      case 'paused':
        return <Badge variant="secondary">Pausad</Badge>;
      case 'completed':
        return <Badge variant="outline">Klar</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Avbruten</Badge>;
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
            <CardTitle className="text-lg">Aktiva sekvenser</CardTitle>
            <CardDescription>
              Outreach-sekvenser som denna lead är registrerad i
            </CardDescription>
          </div>
          <Button onClick={() => setShowEnrollDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Starta sekvens
          </Button>
        </CardHeader>
        <CardContent>
          {!leadEmail ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Leaden saknar e-postadress</p>
              <p className="text-sm">Lägg till en e-post för att kunna starta outreach</p>
            </div>
          ) : leadSequences.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Ingen aktiv outreach</p>
              <p className="text-sm">Starta en sekvens för att påbörja outreach</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leadSequences.map((ls) => (
                <div key={ls.id} className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Send className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{ls.sequence?.name || 'Okänd sekvens'}</p>
                        <p className="text-sm text-muted-foreground">
                          Steg {ls.current_step + 1} • Startad {format(new Date(ls.started_at), "d MMM", { locale: sv })}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(ls.status)}
                  </div>
                  
                  {ls.next_step_at && ls.status === 'active' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Clock className="h-4 w-4" />
                      Nästa steg: {format(new Date(ls.next_step_at), "d MMMM HH:mm", { locale: sv })}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {ls.status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleUpdateStatus(ls.id, 'paused')}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pausa
                      </Button>
                    )}
                    {ls.status === 'paused' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleUpdateStatus(ls.id, 'active')}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Återuppta
                      </Button>
                    )}
                    {(ls.status === 'active' || ls.status === 'paused') && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleUpdateStatus(ls.id, 'cancelled')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Avbryt
                      </Button>
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
            <DialogTitle>Starta outreach-sekvens</DialogTitle>
            <DialogDescription>
              Välj en sekvens att starta för {leadName || 'denna lead'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {sequences.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Inga sekvenser skapade ännu</p>
                <Button onClick={() => {
                  setShowEnrollDialog(false);
                  setShowCreateDialog(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Skapa sekvens
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Välj sekvens</Label>
                  <Select value={selectedSequence} onValueChange={setSelectedSequence}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj en sekvens..." />
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
                    <Plus className="mr-2 h-4 w-4" />
                    Skapa ny sekvens
                  </Button>
                </div>
              </>
            )}
          </div>

          {sequences.length > 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>
                Avbryt
              </Button>
              <Button onClick={handleEnrollInSequence} disabled={isSaving || !selectedSequence}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Startar...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Starta sekvens
                  </>
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
              <Sparkles className="h-5 w-5 text-primary" />
              Skapa AI-driven sekvens
            </DialogTitle>
            <DialogDescription>
              Mailen genereras automatiskt av AI baserat på leadens data och webbanalys
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Sequence Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="seq-name">Sekvensnamn *</Label>
                <Input
                  id="seq-name"
                  placeholder="t.ex. Första kontakt - Webbanalys"
                  value={newSequence.name}
                  onChange={(e) => setNewSequence(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seq-desc">Beskrivning</Label>
                <Input
                  id="seq-desc"
                  placeholder="Kort beskrivning..."
                  value={newSequence.description}
                  onChange={(e) => setNewSequence(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Steps Builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Sekvenssteg</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => addStep('email')}
                  >
                    <Mail className="h-4 w-4 mr-1" />
                    E-post
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => addStep('task')}
                  >
                    <ListTodo className="h-4 w-4 mr-1" />
                    Uppgift
                  </Button>
                </div>
              </div>

              {newSequence.steps.length === 0 ? (
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">Inga steg ännu</p>
                  <p className="text-sm">Lägg till e-post eller uppgifter ovan</p>
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
                              <><Sparkles className="h-3 w-3 mr-1" /> AI E-post</>
                            ) : (
                              <><ListTodo className="h-3 w-3 mr-1" /> Uppgift</>
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
                              <Eye className="h-4 w-4 mr-1" />
                              Förhandsgranska
                            </Button>
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
                            {index === 0 ? "Skickas" : "Vänta"}
                          </span>
                          <Select
                            value={step.delay_days.toString()}
                            onValueChange={(v) => updateStep(index, 'delay_days', parseInt(v))}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Direkt</SelectItem>
                              <SelectItem value="1">1 dag</SelectItem>
                              <SelectItem value="2">2 dagar</SelectItem>
                              <SelectItem value="3">3 dagar</SelectItem>
                              <SelectItem value="5">5 dagar</SelectItem>
                              <SelectItem value="7">1 vecka</SelectItem>
                              <SelectItem value="14">2 veckor</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-sm text-muted-foreground">
                            {index === 0 ? "efter start" : "sedan förra steget"}
                          </span>
                        </div>

                        {step.step_type === 'email' ? (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Instruktion till AI (valfritt)
                            </Label>
                            <Textarea
                              placeholder="T.ex. 'Fokusera på deras låga SEO-score' eller 'Nämn att vi erbjuder gratis konsultation'"
                              value={step.email_prompt}
                              onChange={(e) => updateStep(index, 'email_prompt', e.target.value)}
                              rows={2}
                              className="text-sm resize-none"
                            />
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Uppgiftstitel</Label>
                              <Input
                                placeholder="t.ex. Ring upp"
                                value={step.task_title}
                                onChange={(e) => updateStep(index, 'task_title', e.target.value)}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Beskrivning</Label>
                              <Input
                                placeholder="Detaljer..."
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
            }}>
              Avbryt
            </Button>
            <Button 
              onClick={handleCreateSequence} 
              disabled={isSaving || !newSequence.name || newSequence.steps.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sparar...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Skapa sekvens
                </>
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
              Förhandsgranska e-post (Steg {previewStepIndex + 1})
            </DialogTitle>
            <DialogDescription>
              AI-genererat mail baserat på leadens data
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isGeneratingPreview ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Genererar e-post med AI...</p>
              </div>
            ) : previewEmail ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Ämne</Label>
                  <div className="p-3 rounded-lg bg-muted font-medium">
                    {previewEmail.subject}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Meddelande</Label>
                  <div className="p-4 rounded-lg bg-muted whitespace-pre-wrap text-sm leading-relaxed">
                    {previewEmail.body}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Stäng
            </Button>
            {previewEmail && (
              <Button onClick={() => handlePreviewEmail(previewStepIndex)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generera nytt
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
