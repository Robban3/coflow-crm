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
  const features = analyzeRestaurantFeatures(url, rawData);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Store className="h-4 w-4" />
          Analys: Restaurang & Hotell
        </CardTitle>
        <CardDescription className="text-xs">
          Viktiga funktioner för restauranger och hotell
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feature checklist */}
        <div className="space-y-2">
          <FeatureItem 
            label="Online-meny"
            present={features.hasMenu}
            description={features.menuType === 'pdf' ? "PDF-meny (online vore bättre)" : features.menuType === 'online' ? "Interaktiv meny på hemsidan" : "Ingen meny synlig"}
            importance="high"
            warning={features.menuType === 'pdf'}
          />
          <FeatureItem 
            label="Bordsbokning"
            present={features.hasOnlineBooking}
            description="Möjlighet att boka bord online"
            importance="high"
          />
          <FeatureItem 
            label="Google-omdömen"
            present={features.hasGoogleReviews}
            description={features.reviewScore ? `${features.reviewScore}/5 (${features.reviewCount} omdömen)` : "Koppling till Google Reviews"}
            importance="high"
          />
          <FeatureItem 
            label="Öppettider"
            present={features.hasOpeningHours}
            description="Tydligt angivna öppettider"
            importance="medium"
          />
          <FeatureItem 
            label="Karta/Adress"
            present={features.hasLocationInfo}
            description="Adress och vägbeskrivning"
            importance="medium"
          />
          <FeatureItem 
            label="Bildgalleri"
            present={features.hasImageGallery}
            description="Foton på mat, lokalen eller rummen"
            importance="medium"
          />
        </div>

        {/* Score summary */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Branschoptimering</span>
            <Badge variant={features.score >= 80 ? "default" : features.score >= 50 ? "secondary" : "destructive"}>
              {features.score}/100
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {features.score >= 80 
              ? "Webbplatsen är väl optimerad för restaurang/hotellbranschen"
              : features.score >= 50
              ? "Grundläggande information finns, men det finns förbättringspotential"
              : "Flera viktiga funktioner saknas för att attrahera gäster"
            }
          </p>
        </div>

        {/* Recommendations */}
        {features.recommendations.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-sm font-medium mb-2">Rekommendationer</p>
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
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Viktigt</Badge>
          )}
          {warning && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Kan förbättras</Badge>
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
    features.recommendations.push("Lägg till en interaktiv meny direkt på hemsidan (undvik PDF)");
  } else if (features.menuType === 'pdf') {
    features.recommendations.push("Byt ut PDF-menyn mot en interaktiv webbmeny för bättre SEO");
  }
  if (!features.hasOnlineBooking) {
    features.recommendations.push("Lägg till online-bordsbokning (BokaDirekt, TheFork, OpenTable)");
  }
  if (!features.hasGoogleReviews) {
    features.recommendations.push("Integrera Google-omdömen på hemsidan för att bygga förtroende");
  }
  if (!features.hasImageGallery) {
    features.recommendations.push("Lägg till ett professionellt bildgalleri med mat och lokal");
  }
  features.recommendations.push("Säkerställ att schema.org-data finns för LocalBusiness/Restaurant");

  return features;
}
