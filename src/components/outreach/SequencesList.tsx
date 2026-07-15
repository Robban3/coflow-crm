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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Plus,
  Loader2,
  Send,
  ListTodo,
  Trash2,
  Sparkles,
  Edit,
  Eye,
  Inbox,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useMarket, MARKET_FLAG, type Market } from "@/hooks/useMarket";
import { useTranslation } from "@/i18n/LanguageProvider";

// Suggested defaults for delay_days per market and step number (1-indexed)
const MARKET_STEP_DELAYS: Record<Market, number[]> = {
  SE: [0, 4, 9],
  US: [0, 3, 7],
  DE: [0, 5, 12],
  ES: [0, 4, 9],
  UK: [0, 3, 7],
  KR: [0, 4, 9],
  CA: [0, 3, 7],
  AU: [0, 3, 7],
  IE: [0, 3, 7],
  MX: [0, 4, 9],
  AR: [0, 4, 9],
};

function suggestedDelay(market: Market, stepNumber: number): number {
  const delays = MARKET_STEP_DELAYS[market];
  if (stepNumber <= delays.length) return delays[stepNumber - 1];
  // Beyond predefined steps, repeat the last interval
  const lastDelta = delays[delays.length - 1] - (delays[delays.length - 2] ?? 0);
  return delays[delays.length - 1] + lastDelta * (stepNumber - delays.length);
}

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  market?: Market;
  steps?: SequenceStep[];
}

interface SequenceStep {
  id: string;
  step_order: number;
  step_type: string;
  delay_days: number;
  email_prompt: string | null;
  task_title: string | null;
}

export function SequencesList() {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const { market: defaultMarket } = useMarket();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newSequence, setNewSequence] = useState({
    name: "",
    description: "",
    market: defaultMarket as Market,
    steps: [] as Array<{
      step_type: 'email' | 'task';
      email_prompt: string;
      task_title: string;
      task_description: string;
      delay_days: number;
    }>
  });

  const { toast } = useToast();

  // Sync default market into the form whenever the active market changes (only when dialog closed)
  useEffect(() => {
    if (!showCreateDialog) {
      setNewSequence((prev) => ({ ...prev, market: defaultMarket }));
    }
  }, [defaultMarket, showCreateDialog]);

  useEffect(() => {
    fetchSequences();
  }, []);

  const fetchSequences = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('outreach_sequences')
      .select(`
        *,
        steps:sequence_steps(id, step_order, step_type, delay_days, email_prompt, task_title)
      `)
      .order('name');

    if (!error && data) {
      setSequences(data as Sequence[]);
    }
    
    setIsLoading(false);
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
          market: newSequence.market,
          created_by: user?.id,
        } as any)
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
        description: t("outreach.seq.createdDesc", { name: newSequence.name, count: newSequence.steps.length }),
      });

      setShowCreateDialog(false);
      setNewSequence({ name: "", description: "", market: defaultMarket, steps: [] });
      fetchSequences();

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

  const addStep = (type: 'email' | 'task') => {
    setNewSequence(prev => {
      const stepNumber = prev.steps.length + 1;
      return {
        ...prev,
        steps: [
          ...prev.steps,
          {
            step_type: type,
            email_prompt: type === 'email' ? getDefaultPrompt(stepNumber) : "",
            task_title: "",
            task_description: "",
            delay_days: suggestedDelay(prev.market, stepNumber),
          }
        ]
      };
    });
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

  const handleViewDetails = (sequence: Sequence) => {
    setSelectedSequence(sequence);
    setShowDetailsDialog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg">{t("outreach.seq.listTitle")}</CardTitle>
            <CardDescription>{t("outreach.seq.listDesc")}</CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />{t("outreach.seq.newSequence")}</Button>
        </CardHeader>
        <CardContent>
          {sequences.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-1">{t("outreach.seq.emptyTitle")}</h3>
              <p className="text-muted-foreground mb-4">{t("outreach.seq.emptyDesc")}</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />{t("outreach.seq.createSequence")}</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("outreach.seq.colName")}</TableHead>
                  <TableHead>{t("outreach.seq.colDescription")}</TableHead>
                  <TableHead className="w-[100px]">{t("outreach.seq.colSteps")}</TableHead>
                  <TableHead className="w-[120px]">{t("outreach.seq.colCreated")}</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sequences.map((sequence) => (
                  <TableRow key={sequence.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span aria-label={t(`market.${(sequence.market ?? "SE")}`)} title={t(`market.${(sequence.market ?? "SE")}`)}>
                          {MARKET_FLAG[(sequence.market ?? "SE") as Market]}
                        </span>
                        {sequence.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sequence.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {t("outreach.seq.stepsBadge", { count: sequence.steps?.length || 0 })}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(sequence.created_at), "d MMM yyyy", { locale: dateLocale })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(sequence)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Sequence Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("outreach.seq.createDialogTitle")}</DialogTitle>
            <DialogDescription>{t("outreach.seq.createDialogDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("outreach.seq.nameLabel")}</Label>
                <Input
                  id="name"
                  placeholder={t("outreach.seq.namePlaceholder")}
                  value={newSequence.name}
                  onChange={(e) => setNewSequence(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("outreach.seq.colDescription")}</Label>
                <Input
                  id="description"
                  placeholder={t("outreach.seq.descriptionPlaceholder")}
                  value={newSequence.description}
                  onChange={(e) => setNewSequence(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2 max-w-xs">
              <Label htmlFor="market">{t("outreach.seq.marketLabel")}</Label>
              <Select
                value={newSequence.market}
                onValueChange={(value: Market) =>
                  setNewSequence(prev => ({
                    ...prev,
                    market: value,
                    // Re-suggest delays for any existing steps based on the new market
                    steps: prev.steps.map((s, i) => ({
                      ...s,
                      delay_days: suggestedDelay(value, i + 1),
                    })),
                  }))
                }
              >
                <SelectTrigger id="market">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SE">{MARKET_FLAG.SE} {t("market.SE")}</SelectItem>
                  <SelectItem value="US">{MARKET_FLAG.US} {t("market.US")}</SelectItem>
                  <SelectItem value="DE">{MARKET_FLAG.DE} {t("market.DE")}</SelectItem>
                  <SelectItem value="ES">{MARKET_FLAG.ES} {t("market.ES")}</SelectItem>
                  <SelectItem value="UK">{MARKET_FLAG.UK} {t("market.UK")}</SelectItem>
                  <SelectItem value="KR">{MARKET_FLAG.KR} {t("market.KR")}</SelectItem>
                  <SelectItem value="CA">{MARKET_FLAG.CA} {t("market.CA")}</SelectItem>
                  <SelectItem value="AU">{MARKET_FLAG.AU} {t("market.AU")}</SelectItem>
                  <SelectItem value="IE">{MARKET_FLAG.IE} {t("market.IE")}</SelectItem>
                  <SelectItem value="MX">{MARKET_FLAG.MX} {t("market.MX")}</SelectItem>
                  <SelectItem value="AR">{MARKET_FLAG.AR} {t("market.AR")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("outreach.seq.marketHint")}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t("outreach.seq.stepsInSequence")}</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => addStep('email')}>
                    <Mail className="mr-1 h-4 w-4" />{t("outreach.seq.addMail")}</Button>
                  <Button variant="outline" size="sm" onClick={() => addStep('task')}>
                    <ListTodo className="mr-1 h-4 w-4" />{t("outreach.seq.addTask")}</Button>
                </div>
              </div>

              {newSequence.steps.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">{t("outreach.seq.addStepsAbove")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {newSequence.steps.map((step, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {index + 1}
                          </div>
                          {step.step_type === 'email' ? (
                            <Mail className="h-4 w-4 text-primary" />
                          ) : (
                            <ListTodo className="h-4 w-4 text-orange-500" />
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-4">
                            <Badge variant={step.step_type === 'email' ? 'default' : 'secondary'}>
                              {step.step_type === 'email' ? t("outreach.seq.typeAiMail") : t("outreach.seq.typeTask")}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`delay-${index}`} className="text-xs">{t("outreach.seq.wait")}</Label>
                              <Input
                                id={`delay-${index}`}
                                type="number"
                                min="0"
                                className="w-16 h-8"
                                value={step.delay_days}
                                onChange={(e) => updateStep(index, 'delay_days', parseInt(e.target.value) || 0)}
                              />
                              <span className="text-xs text-muted-foreground">{t("outreach.seq.days")}</span>
                            </div>
                          </div>

                          {step.step_type === 'email' ? (
                            <div className="space-y-2">
                              <Label htmlFor={`prompt-${index}`} className="text-xs flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />{t("outreach.seq.aiPrompt")}</Label>
                              <Textarea
                                id={`prompt-${index}`}
                                placeholder={t("outreach.seq.aiPromptPlaceholder")}
                                value={step.email_prompt}
                                onChange={(e) => updateStep(index, 'email_prompt', e.target.value)}
                                rows={2}
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor={`task-title-${index}`} className="text-xs">{t("outreach.seq.taskTitle")}</Label>
                                <Input
                                  id={`task-title-${index}`}
                                  placeholder={t("outreach.seq.taskTitlePlaceholder")}
                                  value={step.task_title}
                                  onChange={(e) => updateStep(index, 'task_title', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`task-desc-${index}`} className="text-xs">{t("outreach.seq.colDescription")}</Label>
                                <Input
                                  id={`task-desc-${index}`}
                                  placeholder={t("outreach.seq.descriptionPlaceholder")}
                                  value={step.task_description}
                                  onChange={(e) => updateStep(index, 'task_description', e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t("outreach.common.cancel")}</Button>
            <Button onClick={handleCreateSequence} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("outreach.common.saving")}</>
              ) : (
                t("outreach.seq.createSequence")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedSequence?.name}</DialogTitle>
            <DialogDescription>
              {selectedSequence?.description || "Ingen beskrivning"}
            </DialogDescription>
          </DialogHeader>

          {selectedSequence?.steps && (
            <div className="space-y-3 py-4">
              <Label>{t("outreach.seq.stepsInSequence")}</Label>
              {selectedSequence.steps.length === 0 ? (
                <p className="text-muted-foreground">{t("outreach.seq.noStepsConfigured")}</p>
              ) : (
                <div className="space-y-2">
                  {selectedSequence.steps
                    .sort((a, b) => a.step_order - b.step_order)
                    .map((step) => (
                      <div
                        key={step.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                          {step.step_order}
                        </div>
                        {step.step_type === 'email' ? (
                          <Mail className="h-4 w-4 text-primary" />
                        ) : (
                          <ListTodo className="h-4 w-4 text-orange-500" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {step.step_type === 'email' 
                              ? (step.email_prompt?.substring(0, 50) + '...' || t("outreach.seq.aiGeneratedMail"))
                              : (step.task_title || t("outreach.seq.typeTask"))
                            }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {step.delay_days === 0 ? t("outreach.seq.immediate") : t("outreach.seq.afterDays", { count: step.delay_days })}
                          </p>
                        </div>
                        <Badge variant={step.step_type === 'email' ? 'default' : 'secondary'}>
                          {step.step_type === 'email' ? t("outreach.seq.typeMail") : t("outreach.seq.typeTask")}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
