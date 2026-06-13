import { useTranslation } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

interface Props {
  meetings: number;
  calls: number;
  emails: number;
  meetingsGoal?: number;
  callsGoal?: number;
  emailsGoal?: number;
}

export function PersonalProgress({
  meetings,
  calls,
  emails,
  meetingsGoal = 5,
  callsGoal = 20,
  emailsGoal = 30,
}: Props) {
  const { t } = useTranslation();
  const metrics = [
    { label: t("statistics.meetingsThisWeek"), value: meetings, goal: meetingsGoal },
    { label: t("statistics.callsThisWeek"), value: calls, goal: callsGoal },
    { label: t("statistics.emailsThisWeek"), value: emails, goal: emailsGoal },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Min prestation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map(({ label, value, goal }) => {
          const pct = Math.min(100, Math.round((value / goal) * 100));
          return (
            <div key={label} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium tabular-nums">
                  {value} / {goal}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
