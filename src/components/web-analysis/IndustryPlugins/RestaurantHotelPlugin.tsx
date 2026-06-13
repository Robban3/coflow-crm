import { useTranslation } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Store, 
  Calendar, 
  Star, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Images,
  FileText
} from "lucide-react";
import { PageSpeedResult } from "@/lib/api/webAnalysis";

export interface RestaurantHotelPluginProps {
  url: string;
  rawData: PageSpeedResult | null;
}

export function RestaurantHotelPlugin({ url, rawData }: RestaurantHotelPluginProps) {
  const { t } = useTranslation();
  const features = analyzeRestaurantFeatures(url, rawData);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Store className="h-4 w-4" />{t("webAnalysis.restaurantHotelTitle")}</CardTitle>
        <CardDescription className="text-xs">{t("webAnalysis.restaurantHotelDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feature checklist */}
        <div className="space-y-2">
          <FeatureItem 
            label={t("webAnalysis.featOnlineMenu")}
            present={features.hasMenu}
            description={features.menuType === 'pdf' ? t("webAnalysis.featMenuPdf") : features.menuType === 'online' ? t("webAnalysis.featMenuOnline") : "Ingen meny synlig"}
            importance="high"
            warning={features.menuType === 'pdf'}
          />
          <FeatureItem 
            label={t("webAnalysis.featTableBooking")}
            present={features.hasOnlineBooking}
            description=t("webAnalysis.featTableBookingDesc")
            importance="high"
          />
          <FeatureItem 
            label={t("webAnalysis.featGoogleReviews")}
            present={features.hasGoogleReviews}
            description={features.reviewScore ? t("webAnalysis.reviewsScore", { score: features.reviewScore, count: features.reviewCount }) : t("webAnalysis.featGoogleReviewsDesc")}
            importance="high"
          />
          <FeatureItem 
            label={t("webAnalysis.featOpeningHours")}
            present={features.hasOpeningHours}
            description=t("webAnalysis.featOpeningHoursDesc")
            importance="medium"
          />
          <FeatureItem 
            label={t("webAnalysis.featMapAddress")}
            present={features.hasLocationInfo}
            description=t("webAnalysis.featMapAddressDesc")
            importance="medium"
          />
          <FeatureItem 
            label={t("webAnalysis.featImageGallery")}
            present={features.hasImageGallery}
            description=t("webAnalysis.featImageGalleryDesc")
            importance="medium"
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
              ? t("webAnalysis.restaurantScoreHigh")
              : features.score >= 50
              ? t("webAnalysis.restaurantScoreMedium")
              : t("webAnalysis.restaurantScoreLow")
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
  warning?: boolean;
}

function FeatureItem({ label, present, description, importance, warning }: FeatureItemProps) {
  const getColor = () => {
    if (present && warning) return 'text-yellow-500';
    if (present) return 'text-green-600';
    if (importance === 'high') return 'text-red-500';
    return 'text-yellow-500';
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 ${getColor()}`}>
        {present ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {importance === 'high' && !present && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{t("webAnalysis.important")}</Badge>
          )}
          {warning && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{t("webAnalysis.canBeImproved")}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function analyzeRestaurantFeatures(url: string, rawData: PageSpeedResult | null) {
  const features = {
    hasMenu: false,
    hasOnlineBooking: false,
    hasGoogleReviews: false,
    hasOpeningHours: false,
    hasLocationInfo: false,
    hasImageGallery: false,
    menuType: 'none' as 'pdf' | 'online' | 'none',
    reviewScore: undefined as number | undefined,
    reviewCount: undefined as number | undefined,
    score: 0,
    recommendations: [] as string[],
  };

  // Analyze URL for common restaurant/hotel indicators
  const lowerUrl = url.toLowerCase();
  
  // Check for booking platform indicators
  if (lowerUrl.includes('bokadirekt') || lowerUrl.includes('thefork') || lowerUrl.includes('opentable')) {
    features.hasOnlineBooking = true;
  }

  // We can infer from PageSpeed data
  if (rawData) {
    // Check if there are image optimization opportunities (suggests many images = gallery)
    const imageAudit = rawData.opportunities?.find(a => a.id === 'uses-optimized-images');
    if (imageAudit || (rawData.passedAudits?.some(a => a.id.includes('image')))) {
      features.hasImageGallery = true;
    }

    // Good structured data suggests location info
    const structuredDataAudit = rawData.seoAudits?.find(a => a.id === 'structured-data-item');
    if (structuredDataAudit?.score === 1) {
      features.hasLocationInfo = true;
      features.hasOpeningHours = true;
    }
  }

  // Calculate score
  let score = 0;
  if (features.hasMenu) score += features.menuType === 'online' ? 20 : 10;
  if (features.hasOnlineBooking) score += 25;
  if (features.hasGoogleReviews) score += 20;
  if (features.hasOpeningHours) score += 15;
  if (features.hasLocationInfo) score += 10;
  if (features.hasImageGallery) score += 10;
  features.score = score;

  // Generate recommendations - always show helpful tips for restaurants/hotels
  if (!features.hasMenu) {
    features.recommendations.push(t("webAnalysis.recRestaurantMenu"));
  } else if (features.menuType === 'pdf') {
    features.recommendations.push(t("webAnalysis.recRestaurantMenuPdf"));
  }
  if (!features.hasOnlineBooking) {
    features.recommendations.push(t("webAnalysis.recRestaurantBooking"));
  }
  if (!features.hasGoogleReviews) {
    features.recommendations.push(t("webAnalysis.recRestaurantReviews"));
  }
  if (!features.hasImageGallery) {
    features.recommendations.push(t("webAnalysis.recRestaurantGallery"));
  }
  features.recommendations.push(t("webAnalysis.recRestaurantSchema"));

  return features;
}
