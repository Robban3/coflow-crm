import { useTranslation } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Wallet, 
  Star, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Phone,
  MessageSquare
} from "lucide-react";
import { PageSpeedResult } from "@/lib/api/webAnalysis";

export interface ServiceBusinessPluginProps {
  url: string;
  rawData: PageSpeedResult | null;
}

export interface ServiceBusinessPluginProps {
  url: string;
  rawData: PageSpeedResult | null;
}

export function ServiceBusinessPlugin({ url, rawData }: ServiceBusinessPluginProps) {
  const { t } = useTranslation();
  // Analyze based on URL patterns and available data
  const features = analyzeServiceBusinessFeatures(url, rawData);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />{t("webAnalysis.serviceBusinessTitle")}</CardTitle>
        <CardDescription className="text-xs">{t("webAnalysis.serviceBusinessDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feature checklist */}
        <div className="space-y-2">
          <FeatureItem 
            label={t("webAnalysis.featOnlineBooking")}
            present={features.hasBookingSystem}
            description={features.bookingPlatform || t("webAnalysis.featOnlineBookingDesc")}
            importance="high"
          />
          <FeatureItem 
            label={t("webAnalysis.featPricing")}
            present={features.hasPricing}
            description="Priser eller prisintervall synliga"
            importance="high"
          />
          <FeatureItem 
            label={t("webAnalysis.featReviews")}
            present={features.hasReviews}
            description=t("webAnalysis.featReviewsDesc")
            importance="medium"
          />
          <FeatureItem 
            label={t("webAnalysis.featContactForm")}
            present={features.hasContactForm}
            description=t("webAnalysis.featContactFormDesc")
            importance="medium"
          />
          <FeatureItem 
            label={t("webAnalysis.featPhoneVisible")}
            present={features.hasPhoneNumber}
            description=t("webAnalysis.featPhoneVisibleDesc")
            importance="medium"
          />
          <FeatureItem 
            label={t("webAnalysis.featServiceDescriptions")}
            present={features.servicesListed > 0}
            description={features.servicesListed > 0 ? t("webAnalysis.featServicesListed", { count: features.servicesListed }) : t("webAnalysis.featServiceDescriptionsDesc")}
            importance="high"
          />
        </div>

        {/* Score summary */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("webAnalysis.industryOptimization")}</span>
            <Badge variant={features.score >= 80 ? "default" : features.score >= 50 ? "secondary" : "destructive"}>
              {features.score}/100
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {features.score >= 80 
              ? t("webAnalysis.serviceScoreHigh")
              : features.score >= 50
              ? t("webAnalysis.serviceScoreMedium")
              : t("webAnalysis.serviceScoreLow")
            }
          </p>
        </div>

        {/* Recommendations */}
        {features.recommendations.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-sm font-medium mb-2">{t("webAnalysis.recommendations")}</p>
            <ul className="space-y-1">
              {features.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface FeatureItemProps {
  label: string;
  present: boolean;
  description: string;
  importance: 'high' | 'medium' | 'low';
}

function FeatureItem({ label, present, description, importance }: FeatureItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 ${present ? 'text-green-600' : importance === 'high' ? 'text-red-500' : 'text-yellow-500'}`}>
        {present ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {importance === 'high' && !present && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{t("webAnalysis.important")}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function analyzeServiceBusinessFeatures(url: string, rawData: PageSpeedResult | null) {
  const features = {
    hasBookingSystem: false,
    hasPricing: false,
    hasReviews: false,
    hasContactForm: false,
    hasPhoneNumber: false,
    servicesListed: 0,
    bookingPlatform: undefined as string | undefined,
    score: 0,
    recommendations: [] as string[],
  };

  // Analyze URL for common booking/service platforms
  const lowerUrl = url.toLowerCase();
  
  // Check for booking system indicators in URL
  if (lowerUrl.includes('calendly') || lowerUrl.includes('bokadirekt') || lowerUrl.includes('timify')) {
    features.hasBookingSystem = true;
    if (lowerUrl.includes('calendly')) features.bookingPlatform = 'Calendly';
    if (lowerUrl.includes('bokadirekt')) features.bookingPlatform = 'BokaDirekt';
    if (lowerUrl.includes('timify')) features.bookingPlatform = 'Timify';
  }

  // We can infer some things from the PageSpeed data
  if (rawData) {
    // Check SEO audits for good structure
    const hasTitleAudit = rawData.seoAudits?.find(a => a.id === 'document-title');
    const hasMetaDescAudit = rawData.seoAudits?.find(a => a.id === 'meta-description');
    
    const hasGoodSEO = (hasTitleAudit?.score === 1) && (hasMetaDescAudit?.score === 1);
    
    // Infer contact form likely exists if there's good structure
    if (hasGoodSEO) {
      features.hasContactForm = true;
    }
  }

  // For demo purposes, show recommendations based on common issues
  // In a real implementation, this would use Firecrawl content

  // Calculate score
  let score = 0;
  if (features.hasBookingSystem) score += 25;
  if (features.hasPricing) score += 20;
  if (features.hasReviews) score += 15;
  if (features.hasContactForm) score += 15;
  if (features.hasPhoneNumber) score += 10;
  if (features.servicesListed > 0) score += 15;
  features.score = score;

  // Generate recommendations - always show helpful tips for service businesses
  if (!features.hasBookingSystem) {
    features.recommendations.push(t("webAnalysis.recServiceBooking"));
  }
  if (!features.hasPricing) {
    features.recommendations.push(t("webAnalysis.recServicePricing"));
  }
  if (!features.hasReviews) {
    features.recommendations.push(t("webAnalysis.recServiceReviews"));
  }
  if (!features.hasContactForm) {
    features.recommendations.push(t("webAnalysis.recServiceContactForm"));
  }
  features.recommendations.push(t("webAnalysis.recServicePhone"));

  return features;
}
