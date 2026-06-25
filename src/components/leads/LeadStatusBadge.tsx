import { Badge } from "@/components/ui/badge";
import { XCircle, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n/LanguageProvider";

interface LeadStatusBadgeProps {
  leadStatus?: string;
  notInterestedReason?: string | null;
}

export function LeadStatusBadge({ leadStatus, notInterestedReason }: LeadStatusBadgeProps) {
  const { t } = useTranslation();
  if (!leadStatus || leadStatus === "active") return null;

  if (leadStatus === "not_interested") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <XCircle className="h-3 w-3" />
              {t("leadDetail.lsb_notInterested")}
            </Badge>
          </TooltipTrigger>
          {notInterestedReason && (
            <TooltipContent>
              <p className="max-w-[200px]">{notInterestedReason}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (leadStatus === "invalid_phone") {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px] text-muted-foreground">
        <AlertTriangle className="h-3 w-3" />
        {t("leadDetail.lsb_invalidNumber")}
      </Badge>
    );
  }

  return null;
}
