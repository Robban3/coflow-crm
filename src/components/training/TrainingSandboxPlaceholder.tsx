import { FlaskConical } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

/** Placeholder for the future interactive "click-around" sandbox area. */
export function TrainingSandboxPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-xl border border-dashed border-border bg-muted/30">
      <FlaskConical className="h-10 w-10 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">{t("training.sandbox.title")}</h3>
      <p className="text-sm text-muted-foreground max-w-md mt-1">
        {t("training.sandbox.comingSoon")}
      </p>
    </div>
  );
}
