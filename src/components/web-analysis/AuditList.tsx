import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { AuditDetail } from "@/lib/api/webAnalysis";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/LanguageProvider";

interface AuditListProps {
  audits: AuditDetail[];
  title: string;
  emptyMessage?: string;
  showScore?: boolean;
  defaultOpen?: boolean;
}

export function AuditList({ audits, title, emptyMessage, showScore = true, defaultOpen = false }: AuditListProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const resolvedEmptyMessage = emptyMessage ?? t("webAnalysis.auditNoProblems");

  const getScoreIcon = (score: number | null) => {
    if (score === null) return null;
    if (score >= 0.9) return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    if (score >= 0.5) return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
    return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return "bg-muted/50";
    if (score >= 0.9) return "bg-green-50 dark:bg-green-900/20";
    if (score >= 0.5) return "bg-yellow-50 dark:bg-yellow-900/20";
    return "bg-red-50 dark:bg-red-900/20";
  };

  if (!audits || audits.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-muted/30 text-center">
        <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{resolvedEmptyMessage}</p>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span className="font-medium text-sm">{title}</span>
        </div>
        <Badge variant="secondary">{audits.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {audits.map((audit) => (
          <div 
            key={audit.id} 
            className={cn("p-3 rounded-lg border transition-colors", getScoreBg(audit.score))}
          >
            <div className="flex items-start gap-2">
              {showScore && getScoreIcon(audit.score)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{audit.title}</p>
                  {audit.savings && (
                    <Badge variant="outline" className="text-xs">
                      {t("webAnalysis.auditSave", { value: audit.savings })}
                    </Badge>
                  )}
                  {audit.displayValue && !audit.savings && (
                    <Badge variant="secondary" className="text-xs">
                      {audit.displayValue}
                    </Badge>
                  )}
                </div>
                {audit.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {audit.description.replace(/\[.*?\]\(.*?\)/g, '').substring(0, 150)}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
