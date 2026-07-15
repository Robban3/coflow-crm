import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AI_MODELS } from "../_shared/ai.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateAnalysisOutreachRequest } from "../_shared/validation.ts";
import {
  buildOutreachSystemPrompt,
  buildOutreachUserPrompt,
  parseOutreachResponse,
  appendSignature,
  type OutreachContext,
} from "../_shared/outreach-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    const validation = validateAnalysisOutreachRequest(rawBody);

    if (!validation.success || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error || "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      url,
      performanceScore,
      seoScore,
      accessibilityScore,
      bestPracticesScore,
      companyName,
      contactName,
      customPrompt,
      tone = "standard",
      seoVisibilityScore,
      seoSummary,
      seoOpportunities,
    } = validation.data;

    const marketRaw = (rawBody as { market?: string })?.market;
    const market: "SE" | "US" | "DE" | "ES" | "UK" | "KR" | "CA" | "AU" | "IE" | "MX" | "AR" =
      marketRaw === "US" || marketRaw === "DE" || marketRaw === "ES" || marketRaw === "UK" || marketRaw === "KR" || marketRaw === "CA" || marketRaw === "AU" || marketRaw === "IE" || marketRaw === "MX" || marketRaw === "AR" ? marketRaw : "SE";

    console.log("Analysis outreach request:", { url, performanceScore, seoScore, tone, seoVisibilityScore });

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

    // Fetch user profile (sender context, NOT for signature in prompt)
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    const effectiveTone = tone || profile?.outreach_tone || "standard";

    // Build outreach context
    const hasWebsite = url && url.trim().length > 0 && url !== "no-website";
    const hasAnalysisData = performanceScore > 0 || seoScore > 0 || accessibilityScore > 0 || bestPracticesScore > 0;

    const ctx: OutreachContext = {
      companyName,
      contactName,
      customPrompt,
      tone: effectiveTone,
      market,
      senderName: profile?.full_name || undefined,
      senderCompany: profile?.company_name || undefined,
    };

    if (hasWebsite && hasAnalysisData) {
      ctx.webAnalysis = {
        performanceScore,
        seoScore,
        accessibilityScore,
        bestPracticesScore,
      };
    }

    if (seoVisibilityScore !== undefined) {
      ctx.seoIntelligence = {
        visibilityScore: seoVisibilityScore,
        summary: seoSummary,
        opportunities: seoOpportunities,
      };
    }

    const systemPrompt = buildOutreachSystemPrompt(ctx);
    const userPrompt = buildOutreachUserPrompt(ctx);


    console.log("Calling AI gateway with tone:", effectiveTone);

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
