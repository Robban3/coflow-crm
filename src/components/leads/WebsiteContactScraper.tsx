import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Globe,
  Loader2,
  Mail,
  Phone,
  User,
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { firecrawlApi, ExtractedCompanyData } from "@/lib/api/firecrawl";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/LanguageProvider";

interface WebsiteContactScraperProps {
  leadId: string;
  website: string | null;
  companyName: string | null;
  onDataExtracted: () => void;
}

export function WebsiteContactScraper({
  leadId,
  website,
  companyName,
  onDataExtracted,
}: WebsiteContactScraperProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCompanyData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleExtract = async () => {
    if (!website) {
      toast({
        title: t("leadDetail.ws_noWebsiteTitle"),
        description: t("leadDetail.ws_noWebsiteDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    setExtractedData(null);

    try {
      const result = await firecrawlApi.extractCompanyData(website);

      if (!result.success) {
        toast({
          title: t("leadDetail.ws_fetchFailedTitle"),
          description: result.error || t("leadDetail.ws_fetchFailedDescription"),
          variant: "destructive",
        });
        return;
      }

      if (result.data) {
        setExtractedData(result.data);
        setShowDialog(true);

        // Check if we found useful contact info
        const hasContact = result.data.email || result.data.phone || result.data.contactName;
        
        if (hasContact) {
          toast({
            title: t("leadDetail.ws_contactFoundTitle"),
            description: t("leadDetail.ws_contactFoundDescription"),
          });
        } else {
          toast({
            title: t("leadDetail.ws_limitedDataTitle"),
            description: t("leadDetail.ws_limitedDataDescription"),
          });
        }
      }
    } catch (error) {
      console.error("Firecrawl extract error:", error);
      toast({
        title: t("leadDetail.ws_errorTitle"),
        description: t("leadDetail.ws_extractErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveAll = async () => {
    if (!extractedData) return;

    setIsSaving(true);

    try {
      // Build update object with only non-empty values
      const updates: Record<string, string | null> = {};
      
      if (extractedData.email) updates.email = extractedData.email;
      if (extractedData.phone) updates.phone = extractedData.phone;
      if (extractedData.contactName) updates.contact_name = extractedData.contactName;
      // Don't override company name if already set
      if (extractedData.companyName && !companyName) {
        updates.company_name = extractedData.companyName;
      }

      if (Object.keys(updates).length === 0) {
        toast({
          title: t("leadDetail.ws_noDataToSaveTitle"),
          description: t("leadDetail.ws_noDataToSaveDescription"),
        });
        setShowDialog(false);
        return;
      }

      const { error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", leadId);

      if (error) throw error;

      onDataExtracted();
      setShowDialog(false);

      toast({
        title: t("leadDetail.ws_dataSavedTitle"),
        description: t("leadDetail.ws_dataSavedDescription"),
      });
    } catch (error) {
      toast({
        title: t("leadDetail.ws_saveFailedTitle"),
        description: t("leadDetail.ws_saveAllErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveField = async (field: 'email' | 'phone' | 'contact_name', value: string) => {
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("leads")
        .update({ [field]: value })
        .eq("id", leadId);

      if (error) throw error;

      onDataExtracted();

      toast({
        title: t("leadDetail.ws_savedTitle"),
        description: t("leadDetail.ws_fieldUpdated", {
          field:
            field === 'email'
              ? t("leadDetail.ws_fieldEmail")
              : field === 'phone'
              ? t("leadDetail.ws_fieldPhone")
              : t("leadDetail.ws_fieldContactPerson"),
        }),
      });
    } catch (error) {
      toast({
        title: t("leadDetail.ws_saveFailedTitle"),
        description: t("leadDetail.ws_genericErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!website) {
    return null;
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleExtract}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("leadDetail.ws_tooltipExtract")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t("leadDetail.ws_dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("leadDetail.ws_dialogFetchedFrom")}{" "}
              <a 
                href={website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            </DialogDescription>
          </DialogHeader>

          {extractedData ? (
            <div className="space-y-4">
              {/* Company Info */}
              {(extractedData.companyName || extractedData.description || extractedData.industry) && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  {extractedData.companyName && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{extractedData.companyName}</span>
                    </div>
                  )}
                  {extractedData.industry && (
                    <Badge variant="secondary">{extractedData.industry}</Badge>
                  )}
                  {extractedData.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {extractedData.description}
                    </p>
                  )}
                </div>
              )}

              {/* Contact Fields */}
              <div className="space-y-2">
                {/* Email */}
                {extractedData.email && (
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">E-post</p>
                        <p className="font-medium">{extractedData.email}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveField('email', extractedData.email!)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Spara
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Phone */}
                {extractedData.phone && (
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Telefon</p>
                        <p className="font-medium">{extractedData.phone}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveField('phone', extractedData.phone!)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Spara
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Contact Name */}
                {extractedData.contactName && (
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Kontaktperson</p>
                        <p className="font-medium">{extractedData.contactName}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSaveField('contact_name', extractedData.contactName!)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Spara
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Address */}
                {extractedData.address && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Adress</p>
                      <p className="text-sm">{extractedData.address}</p>
                    </div>
                  </div>
                )}

                {/* Org Number */}
                {extractedData.orgNumber && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Org.nummer</p>
                      <p className="text-sm font-mono">{extractedData.orgNumber}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Social Links */}
              {extractedData.socialLinks && Object.values(extractedData.socialLinks).some(v => v) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Sociala medier</p>
                    <div className="flex flex-wrap gap-2">
                      {extractedData.socialLinks.linkedin && (
                        <a
                          href={extractedData.socialLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                        >
                          <Linkedin className="h-4 w-4" />
                          LinkedIn
                        </a>
                      )}
                      {extractedData.socialLinks.facebook && (
                        <a
                          href={extractedData.socialLinks.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                        >
                          <Facebook className="h-4 w-4" />
                          Facebook
                        </a>
                      )}
                      {extractedData.socialLinks.twitter && (
                        <a
                          href={extractedData.socialLinks.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                        >
                          <Twitter className="h-4 w-4" />
                          Twitter
                        </a>
                      )}
                      {extractedData.socialLinks.instagram && (
                        <a
                          href={extractedData.socialLinks.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                        >
                          <Instagram className="h-4 w-4" />
                          Instagram
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* No contact info found */}
              {!extractedData.email && !extractedData.phone && !extractedData.contactName && (
                <div className="text-center py-4 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Inga direkta kontaktuppgifter hittades</p>
                  <p className="text-xs mt-1">Prova att berika via kontaktsida igen</p>
                </div>
              )}

              {/* Save All Button */}
              {(extractedData.email || extractedData.phone || extractedData.contactName) && (
                <>
                  <Separator />
                  <Button onClick={handleSaveAll} disabled={isSaving} className="w-full">
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Spara all kontaktinfo
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
              <p>Hämtar data...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
