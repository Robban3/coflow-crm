import { Globe, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/i18n/LanguageProvider";
import { LANGUAGES } from "@/i18n/translations";

/**
 * Language picker. By default a compact flag-only icon button (used in headers).
 * Pass `showLabel` for a wider, clearly-labelled control (flag + name + chevron)
 * for surfaces where discoverability matters, e.g. the login/register screens.
 */
export function LanguageSwitcher({ showLabel = false }: { showLabel?: boolean }) {
  const { language, setLanguage, t } = useTranslation();
  const current = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {showLabel ? (
          <Button variant="outline" size="sm" className="h-9 gap-2 px-3" title={t("language.label")}>
            <span className="text-base leading-none" aria-hidden>
              {current.flag}
            </span>
            <span className="text-sm font-medium">{current.label}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
            <span className="sr-only">{t("language.label")}</span>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-9 w-9" title={t("language.label")}>
            <span className="text-base leading-none" aria-hidden>
              {current.flag}
            </span>
            <Globe className="absolute h-4 w-4 opacity-0" />
            <span className="sr-only">{t("language.label")}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="gap-2"
          >
            <span className="text-base leading-none" aria-hidden>
              {lang.flag}
            </span>
            <span className="flex-1">{lang.label}</span>
            {language === lang.code && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
