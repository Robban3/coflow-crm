import { CheckCircle, AlertTriangle, XCircle, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScoreCardProps {
  label: string;
  score: number;
  icon: LucideIcon;
  description?: string;
}

export function ScoreCard({ label, score, icon: Icon, description }: ScoreCardProps) {
  const getScoreIcon = () => {
    if (score >= 90) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (score >= 50) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getScoreColor = () => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = () => {
    if (score >= 90) return "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800";
    if (score >= 50) return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800";
    return "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800";
  };

  return (
    <Card className={cn("border-2 transition-all hover:shadow-md", getScoreBgColor())}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{label}</span>
          </div>
          {getScoreIcon()}
        </div>
        <div className={cn("text-4xl font-bold", getScoreColor())}>
          {score}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
