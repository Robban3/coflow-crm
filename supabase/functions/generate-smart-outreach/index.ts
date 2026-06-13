import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AI_MODELS } from "../_shared/ai.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildOutreachSystemPrompt,
  buildOutreachUserPrompt,
  parseOutreachResponse,
  appendSignature,
  type OutreachContext,
} from "../_shared/outreach-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  url?: string;
  performanceScore?: number;
  seoScore?: number;
  accessibilityScore?: number;
  bestPracticesScore?: number;
  pwaScore?: number;
  companyName?: string;
  contactName?: string;
  customPrompt?: string;
  tone?: string;
  scrapeWebsite?: boolean;
  useServiceProfile?: boolean;
  fleetData?: {
    vehicleCount?: number;
    leasingCompany?: string;
    vehicles?: any[];
  };
  telephonyData?: {
    subscriptionCount?: number;
    operator?: string;
    phoneNumbers?: any[];
  };
  geoAnalysis?: {
    geoScore?: number;
    summary?: string;
    domain?: string;
  };
  seoIntelligence?: {
    visibilityScore?: number;
    summary?: string;
    opportunities?: string;
    keywords?: Array<{ keyword: string; position: number; volume: number }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody: RequestBody = await req.json();

    const {
      url,
      performanceScore = 0,
      seoScore = 0,
      accessibilityScore = 0,
      bestPracticesScore = 0,
      companyName,
      contactName,
      customPrompt,
      tone = "standard",
      scrapeWebsite = true,
      useServiceProfile = true,
      fleetData,
      telephonyData,
      geoAnalysis,
      seoIntelligence,
      market: marketRaw,
    } = rawBody as RequestBody & { market?: string };

    const market: "SE" | "US" | "DE" =
      marketRaw === "US" || marketRaw === "DE" ? marketRaw : "SE";

    console.log("Smart outreach request:", { url, companyName, tone, scrapeWebsite, useServiceProfile });

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    const effectiveTone = tone || profile?.outreach_tone || "standard";

    // Get service profile if enabled
    const serviceProfile = useServiceProfile && profile?.service_description ? {
      industry: profile.service_industry || "custom",
      description: profile.service_description,
    } : undefined;

    const hasWebsite = url && url.trim().length > 0 && url !== "no-website";
    const hasAnalysisData = performanceScore > 0 || seoScore > 0 || accessibilityScore > 0 || bestPracticesScore > 0;

    // STEP 1: Scrape website content if available
    let websiteContent = "";
    let websiteInsights: string[] = [];

    if (hasWebsite && scrapeWebsite) {
      const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");

      if (firecrawlApiKey) {
        try {
          let formattedUrl = url!.trim();
          if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
            formattedUrl = `https://${formattedUrl}`;
          }

          console.log("Scraping website content:", formattedUrl);

          const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${firecrawlApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: formattedUrl,
              formats: ["markdown"],
              onlyMainContent: true,
            }),
          });

          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
            const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

            websiteContent = markdown.substring(0, 3000);
            websiteInsights = analyzeWebsiteContent(markdown, metadata);

            console.log("Website scraped successfully, insights:", websiteInsights.length);
          } else {
            console.log("Failed to scrape website:", scrapeResponse.status);
          }
        } catch (scrapeError) {
          console.error("Scrape error:", scrapeError);
        }
      }
    }

    // STEP 2: Build outreach context using shared module
    const ctx: OutreachContext = {
      companyName,
      contactName,
      customPrompt,
      tone: effectiveTone,
      market,
      serviceProfile,
      senderName: profile?.full_name || undefined,
      senderCompany: profile?.company_name || undefined,
      websiteContent: websiteContent || undefined,
      websiteInsights: websiteInsights.length > 0 ? websiteInsights : undefined,
    };

    if (hasWebsite && hasAnalysisData) {
      ctx.webAnalysis = {
        performanceScore,
        seoScore,
        accessibilityScore,
        bestPracticesScore,
      };
    }

    if (geoAnalysis && geoAnalysis.geoScore !== undefined) {
      ctx.geoAnalysis = geoAnalysis;
    }

    if (seoIntelligence && seoIntelligence.visibilityScore !== undefined) {
      ctx.seoIntelligence = seoIntelligence;
    }

    if (fleetData && fleetData.vehicleCount && fleetData.vehicleCount > 0) {
      ctx.fleetData = fleetData;
    }

    if (telephonyData && telephonyData.subscriptionCount && telephonyData.subscriptionCount > 0) {
      ctx.telephonyData = telephonyData;
    }

    const systemPrompt = buildOutreachSystemPrompt(ctx);
    const userPrompt = buildOutreachUserPrompt(ctx);


    console.log("Calling AI with shared outreach prompt");

    const aiData = await callAI({
      model: AI_MODELS.claude,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    const parsed = parseOutreachResponse(content, companyName || url);

    // Append signature from profile (localized for the target market)
    const finalBody = appendSignature(parsed.body_without_signature, profile, market);

    return new Response(
      JSON.stringify({
        subject: parsed.subject,
        body: finalBody,
        logoUrl: profile?.company_logo_url || null,
        pitchType: hasWebsite ? "smart-analysis" : "no-website",
        websiteInsights,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ── Website content analyzer (kept from original) ────────────────────

function analyzeWebsiteContent(markdown: string, metadata: any): string[] {
  const insights: string[] = [];
  const lowerContent = markdown.toLowerCase();

  if (lowerContent.includes("köp") || lowerContent.includes("varukorg") ||
    lowerContent.includes("checkout") || lowerContent.includes("priser")) {
    insights.push("E-handel/webshop identifierad");
  }

  if (lowerContent.includes("tjänster") || lowerContent.includes("konsult") ||
    lowerContent.includes("boka tid") || lowerContent.includes("offert")) {
    insights.push("Tjänsteföretag");
  }

  if (lowerContent.includes("besöksadress") || lowerContent.includes("öppettider") ||
    lowerContent.includes("hitta hit")) {
    insights.push("Lokalt företag med fysisk närvaro");
  }

  if (lowerContent.includes("blogg") || lowerContent.includes("nyheter") ||
    lowerContent.includes("artiklar")) {
    insights.push("Har blogg/content-strategi");
  }

  if (!lowerContent.includes("google") && !lowerContent.includes("analytics") &&
    !lowerContent.includes("pixel")) {
    insights.push("Möjlig avsaknad av spårning/analytics");
  }

  if (metadata.description) {
    if (metadata.description.length < 50) {
      insights.push("Kort meta-beskrivning (SEO-möjlighet)");
    } else if (metadata.description.length > 160) {
      insights.push("För lång meta-beskrivning (SEO-möjlighet)");
    }
  } else {
    insights.push("Saknar meta-beskrivning (stor SEO-möjlighet)");
  }

  if (!lowerContent.includes("omdöme") && !lowerContent.includes("recension") &&
    !lowerContent.includes("kunder säger") && !lowerContent.includes("testimonial")) {
    insights.push("Saknar synliga kundrecensioner");
  }

  const ctaCount = (lowerContent.match(/kontakta|boka|köp|läs mer|ring/g) || []).length;
  if (ctaCount < 3) {
    insights.push("Få tydliga call-to-actions");
  }

  return insights;
}
