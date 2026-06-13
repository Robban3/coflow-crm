import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI, AI_MODELS } from "../_shared/ai.ts";
import { validateGenerateOutreachRequest } from "../_shared/validation.ts";
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawBody = await req.json();
    const validation = validateGenerateOutreachRequest(rawBody);

    if (!validation.success || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error || "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { leadId, stepNumber, totalSteps, emailPrompt, userId, market: marketRaw } = validation.data;
    const context = rawBody.context || "initial";
    const market: "SE" | "US" | "DE" =
      marketRaw === "US" || marketRaw === "DE" ? marketRaw : "SE";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await authClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userId && userId !== caller.id) {
      return new Response(
        JSON.stringify({ error: "userId mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile?.organization_id || callerProfile.organization_id !== lead.organization_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch web analyses for the lead
    const { data: analyses } = await supabase
      .from("web_analyses")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1);

    const analysis = analyses?.[0];

    // Fetch user profile for signature and sender identity
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", caller.id)
      .single();

    // Build outreach context
    const ctx: OutreachContext = {
      companyName: lead.company_name || undefined,
      contactName: lead.contact_name || undefined,
      customPrompt: emailPrompt || undefined,
      tone: profile?.outreach_tone || "standard",
      context,
      market,
      stepNumber,
      totalSteps,
      senderName: profile?.full_name || undefined,
      senderCompany: profile?.company_name || undefined,
      businessSummary: lead.business_summary || undefined,
      detectedProblems: lead.detected_problems || undefined,
    };

    // Add service profile if available
    if (profile?.service_industry && profile?.service_description) {
      ctx.serviceProfile = {
        industry: profile.service_industry,
        description: profile.service_description,
      };
    }

    // Add web analysis if available
    if (analysis) {
      ctx.webAnalysis = {
        performanceScore: analysis.performance_score ?? 0,
        seoScore: analysis.seo_score ?? 0,
        accessibilityScore: analysis.accessibility_score ?? 0,
        bestPracticesScore: analysis.best_practices_score ?? 0,
      };
    }

    const systemPrompt = buildOutreachSystemPrompt(ctx);
    const userPrompt = buildOutreachUserPrompt(ctx);

    const aiData = await callAI({
      model: AI_MODELS.claude,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const content = aiData.choices?.[0]?.message?.content;

    const parsed = parseOutreachResponse(content, lead.company_name || undefined);

    // Append signature from profile
    const finalBody = appendSignature(parsed.body_without_signature, profile, market);

    return new Response(
      JSON.stringify({
        subject: parsed.subject,
        body_without_signature: parsed.body_without_signature,
        body: finalBody,
        leadName: lead.contact_name || lead.company_name,
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
