import { supabase } from "@/integrations/supabase/client";
import type { GrowthReportData, GeoFinding, GeoAction } from "./types";

interface LeadRow {
  id: string;
  company_name: string | null;
  website: string | null;
  organization_id: string | null;
}

/**
 * Assembles a complete growth report snapshot from existing data.
 * Does NOT trigger any new analysis — read-only.
 */
export interface ModuleSelection {
  web: boolean;
  geo: boolean;
  seo: boolean;
}

type GLang = "sv" | "en" | "es";
const gPick = (l?: string): GLang => (l === "en" ? "en" : l === "es" ? "es" : "sv");
const GROWTH_L: Record<GLang, {
  unknownCompany: string; perMonth: string;
  webTitle: string; webDesc: (s: number) => string;
  geoTitle: string; geoDesc: (s: number) => string;
  seoTitle: string; seoDesc: (s: number) => string;
  genTitle: string; genDesc: string;
}> = {
  sv: {
    unknownCompany: "Okänt företag", perMonth: "/ mån",
    webTitle: "Webbprestanda",
    webDesc: (s) => `Er webbplats presterar på ${s}/100 vilket påverkar användarupplevelsen och er synlighet i sökmotorer.`,
    geoTitle: "AI-synlighet (GEO)",
    geoDesc: (s) => `Er GEO-poäng är ${s}/100. Det innebär att AI-drivna sökmotorer har svårt att rekommendera er.`,
    seoTitle: "Sökmotoroptimering",
    seoDesc: (s) => `Er SEO-poäng är ${s}/100 vilket begränsar er organiska synlighet.`,
    genTitle: "Digital närvaro",
    genDesc: "Vi saknar tillräckligt med analysdata för att identifiera huvudhindret. Vi rekommenderar en fullständig genomgång.",
  },
  en: {
    unknownCompany: "Unknown company", perMonth: "/ mo",
    webTitle: "Web performance",
    webDesc: (s) => `Your website scores ${s}/100, which affects the user experience and your visibility in search engines.`,
    geoTitle: "AI visibility (GEO)",
    geoDesc: (s) => `Your GEO score is ${s}/100. That means AI-driven search engines struggle to recommend you.`,
    seoTitle: "Search engine optimisation",
    seoDesc: (s) => `Your SEO score is ${s}/100, which limits your organic visibility.`,
    genTitle: "Digital presence",
    genDesc: "We lack enough analysis data to identify the main barrier. We recommend a full review.",
  },
  es: {
    unknownCompany: "Empresa desconocida", perMonth: "/ mes",
    webTitle: "Rendimiento web",
    webDesc: (s) => `Vuestro sitio web obtiene ${s}/100, lo que afecta a la experiencia de usuario y a vuestra visibilidad en los buscadores.`,
    geoTitle: "Visibilidad IA (GEO)",
    geoDesc: (s) => `Vuestra puntuación GEO es ${s}/100. Eso significa que a los buscadores con IA les cuesta recomendaros.`,
    seoTitle: "Optimización para buscadores",
    seoDesc: (s) => `Vuestra puntuación SEO es ${s}/100, lo que limita vuestra visibilidad orgánica.`,
    genTitle: "Presencia digital",
    genDesc: "Nos faltan datos de análisis suficientes para identificar la barrera principal. Recomendamos una revisión completa.",
  },
};

export async function buildGrowthReportSnapshot(
  lead: LeadRow,
  selectedModules?: ModuleSelection,
  language: string = "sv"
): Promise<GrowthReportData> {
  const gtr = GROWTH_L[gPick(language)];
  const [webRes, geoRes, seoRes] = await Promise.all([
    supabase
      .from("web_analyses")
      .select("performance_score, seo_score, accessibility_score, best_practices_score, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("geo_analyses")
      .select("id, geo_score, summary, completed_at, created_at")
      .eq("lead_id", lead.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("seo_analyses")
      .select("visibility_score, ai_summary, primary_keywords, ai_opportunities, estimated_keywords, raw_data")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Apply module selection — if a module is deselected, treat as if no data exists
  const sel = selectedModules || { web: true, geo: true, seo: true };
  const webData = sel.web ? webRes.data : null;
  const geoData = sel.geo ? geoRes.data : null;
  const seoData = sel.seo ? seoRes.data : null;

  let findings: GeoFinding[] = [];
  let actions: GeoAction[] = [];

  if (geoData?.id) {
    const [findingsRes, actionsRes] = await Promise.all([
      supabase
        .from("geo_findings")
        .select("severity, category, title, description, recommendation")
        .eq("geo_analysis_id", geoData.id),
      supabase
        .from("geo_actions")
        .select("priority, title, steps, estimated_impact, estimated_effort")
        .eq("geo_analysis_id", geoData.id),
    ]);
    findings = (findingsRes.data || []) as GeoFinding[];
    actions = (actionsRes.data || []) as GeoAction[];
  }

  const scores = {
    web: webData?.performance_score ?? null,
    webSeo: webData?.seo_score ?? null,
    geo: geoData?.geo_score ?? null,
    seoVis: seoData?.visibility_score ?? null,
  };

  const allScores = [scores.web, scores.geo, scores.webSeo, scores.seoVis].filter(
    (s): s is number => s !== null
  );
  const minScore = allScores.length > 0 ? Math.min(...allScores) : 100;
  const highCount = findings.filter((f) => f.severity === "high").length;

  // Never recommend dominate — cap at growth
  let recommended_package: "start" | "growth" | "dominate" = "start";
  if (minScore < 70 || highCount >= 1) {
    recommended_package = "growth";
  }

  // Determine biggest barrier
  const barrierCandidates: { area: string; title: string; description: string; score: number }[] = [];
  if (scores.web !== null) {
    barrierCandidates.push({
      area: "web",
      title: gtr.webTitle,
      description: gtr.webDesc(scores.web),
      score: scores.web,
    });
  }
  if (scores.geo !== null) {
    barrierCandidates.push({
      area: "geo",
      title: gtr.geoTitle,
      description: gtr.geoDesc(scores.geo),
      score: scores.geo,
    });
  }
  if (scores.webSeo !== null) {
    barrierCandidates.push({
      area: "seo",
      title: gtr.seoTitle,
      description: gtr.seoDesc(scores.webSeo),
      score: scores.webSeo,
    });
  }

  barrierCandidates.sort((a, b) => a.score - b.score);
  const biggest_barrier = barrierCandidates[0] || {
    area: "general",
    title: gtr.genTitle,
    description: gtr.genDesc,
  };

  // Fetch pricing (new unified model)
  let ai_visibility_pricing: GrowthReportData["ai_visibility_pricing"] = undefined;
  let pricing: GrowthReportData["pricing"] = undefined;
  let contact: GrowthReportData["contact"] = undefined;

  if (lead.organization_id) {
    const { data: pricingData } = await supabase
      .from("organization_pricing")
      .select("*")
      .eq("organization_id", lead.organization_id)
      .maybeSingle();

    if (pricingData) {
      // New unified pricing
      ai_visibility_pricing = {
        start_monthly: Number((pricingData as any).ai_visibility_start_monthly) || 4900,
        growth_monthly: Number((pricingData as any).ai_visibility_growth_monthly) || 8900,
        dominate_monthly: Number((pricingData as any).ai_visibility_dominate_monthly) || 14900,
        website_rebuild_from: Number((pricingData as any).website_rebuild_from_price) || 18000,
        show_website_upsell: (pricingData as any).show_website_upsell !== false,
        currency: (pricingData as any).currency || "SEK",
        billing_period_label: (pricingData as any).billing_period_label || gtr.perMonth,
      };

      // Legacy pricing for backward compat
      const pkg = recommended_package;
      pricing = {
        geo_monthly:
          pkg === "start"
            ? Number(pricingData.geo_start_monthly)
            : pkg === "growth"
            ? Number(pricingData.geo_growth_monthly)
            : Number(pricingData.geo_dominate_monthly),
        web_fix: Number(pricingData.web_performance_fix_from),
        seo_monthly:
          pkg === "start"
            ? Number(pricingData.seo_start_monthly)
            : pkg === "growth"
            ? Number(pricingData.seo_growth_monthly)
            : Number(pricingData.seo_dominate_monthly),
      };

      contact = {
        booking_url: pricingData.booking_url || undefined,
        email: pricingData.contact_email || "hej@kodco.se",
        phone: pricingData.contact_phone || undefined,
      };
    }
  }

  return {
    type: "complete_growth_report",
    included_modules: {
      web: !!webData,
      geo: !!geoData,
      seo: !!seoData,
    },
    company: {
      name: lead.company_name || gtr.unknownCompany,
      domain: lead.website || null,
    },
    created_at: new Date().toISOString(),
    web: webData
      ? {
          performance_score: webData.performance_score,
          seo_score: webData.seo_score,
          accessibility_score: webData.accessibility_score,
          best_practices_score: webData.best_practices_score,
          analyzed_at: webData.created_at,
        }
      : null,
    geo: geoData
      ? {
          geo_score: geoData.geo_score,
          summary: geoData.summary,
          findings,
          actions,
          analyzed_at: geoData.completed_at || geoData.created_at,
        }
      : null,
    seo: seoData
      ? {
          visibility_score: seoData.visibility_score,
          ai_summary: seoData.ai_summary,
          // Prefer ranked_keywords from DataForSEO (real Google rankings) over on-page word frequency
          primary_keywords: (() => {
            const rawData = (seoData as any).raw_data;
            const rankedKw = rawData?.ranked_keywords;
            const estimatedKw = (seoData as any).estimated_keywords;
            if (Array.isArray(rankedKw) && rankedKw.length > 0) {
              return rankedKw.slice(0, 15).map((k: any) => ({
                keyword: k.keyword,
                position: k.position ?? k.rank_group,
                volume: k.search_volume ?? k.volume ?? 0,
              }));
            }
            if (Array.isArray(estimatedKw) && estimatedKw.length > 0) {
              return estimatedKw.slice(0, 15);
            }
            return Array.isArray(seoData.primary_keywords) ? (seoData.primary_keywords as any) : null;
          })(),
          ai_opportunities: Array.isArray(seoData.ai_opportunities)
            ? (seoData.ai_opportunities as any)
            : null,
        }
      : null,
    recommended_package,
    biggest_barrier,
    pricing,
    ai_visibility_pricing,
    contact,
  };
}
