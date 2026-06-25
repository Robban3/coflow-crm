import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Define available tools for the AI agent
const agentTools = [
  {
    type: "function",
    function: {
      name: "search_google_places",
      description: "Sök efter företag på Google Places baserat på sökord och plats. Returnerar företag med info om de har hemsida eller inte. Använd detta för att hitta potentiella leads. Efter sökning, VISA ALLTID resultaten för användaren och fråga vilka de vill skapa som leads.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Sökord, t.ex. 'restauranger', 'snickare', 'tandläkare', 'frisörer'" },
          location: { type: "string", description: "Plats att söka i, t.ex. 'Stockholm', 'Göteborg', 'Malmö'. Om inte angiven, lägg till ', Sverige' automatiskt." },
          limit: { type: "number", description: "Antal resultat att hämta (max 20, default 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "import_places_as_leads",
      description: "Importera företag från Google Places som nya leads i systemet. Skicka in en array med företag (name, phone, website, address). Använd EFTER att användaren har godkänt vilka företag som ska importeras.",
      parameters: {
        type: "object",
        properties: {
          places: {
            type: "array",
            description: "Array med företag att importera",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Företagsnamn" },
                phone: { type: "string", description: "Telefonnummer" },
                website: { type: "string", description: "Hemsida URL" },
                address: { type: "string", description: "Adress" },
              },
              required: ["name"],
            },
          },
          run_analysis: { type: "boolean", description: "Om true, kör automatisk webbanalys för leads som har hemsida" },
        },
        required: ["places"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_website",
      description: "Analysera en webbplats med PageSpeed Insights och Firecrawl för att få prestanda-, SEO-poäng och kontaktinfo.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL till webbplatsen som ska analyseras" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Skapa en enskild ny lead i systemet.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Företagets namn" },
          email: { type: "string", description: "E-postadress" },
          phone: { type: "string", description: "Telefonnummer" },
          website: { type: "string", description: "Webbplats URL" },
          source: { type: "string", description: "Källa, t.ex. 'google_places', 'manual', 'ai_agent'" },
        },
        required: ["company_name", "source"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Uppdatera information för en befintlig lead. Använd detta efter att ha analyserat eller importerat leads för att fylla i kontaktinfo, e-post, telefon etc.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "Lead-ID (UUID) att uppdatera" },
          company_name: { type: "string", description: "Nytt företagsnamn" },
          contact_name: { type: "string", description: "Kontaktpersonens namn" },
          email: { type: "string", description: "E-postadress" },
          phone: { type: "string", description: "Telefonnummer" },
          website: { type: "string", description: "Webbplats URL" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_analysis_for_lead",
      description: "Kör en webbanalys (PageSpeed + Firecrawl) för en lead och SPARA resultatet i databasen. Detta skapar en ny post i web_analyses och uppdaterar leadens info med eventuell kontaktinfo som hittas.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "Lead-ID (UUID) att analysera" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_batch_analysis",
      description: "Kör webbanalyser för flera leads på en gång. Sparar resultaten i databasen och uppdaterar leads med hittad kontaktinfo. Max 5 åt gången.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: {
            type: "array",
            description: "Array med lead UUIDs att analysera",
            items: { type: "string" },
          },
        },
        required: ["lead_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_analysis_summary",
      description: "Hämta och sammanfatta analysresultat för en eller flera leads. Returnerar prestanda, SEO-poäng och förbättringsförslag.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "Enskilt lead-ID att hämta analys för" },
          lead_ids: {
            type: "array",
            description: "Flera lead-IDs att hämta analyser för",
            items: { type: "string" },
          },
          include_recommendations: { type: "boolean", description: "Inkludera AI-genererade förbättringsförslag" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_tasks_for_leads",
      description: "Skapa uppgifter/tasks för flera leads på en gång. Skicka in lead IDs (UUID format) och uppgiftsinformation. VIKTIGT: Använd bara riktiga lead_id från get_leads eller nyss skapade leads.",
      parameters: {
        type: "object",
        properties: {
          lead_ids: {
            type: "array",
            description: "Array med lead UUIDs att skapa uppgifter för",
            items: { type: "string" },
          },
          task_title_template: { type: "string", description: "Mall för uppgiftstitel. Använd {company_name} för att inkludera företagsnamn" },
          task_description: { type: "string", description: "Beskrivning av uppgiften" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Prioritet" },
          due_date: { type: "string", description: "Förfallodatum i format YYYY-MM-DD" },
        },
        required: ["lead_ids", "task_title_template"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Skapa en enskild uppgift/task. Använd create_tasks_for_leads för att skapa uppgifter för flera leads.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Uppgiftens titel" },
          description: { type: "string", description: "Beskrivning av uppgiften" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"], description: "Prioritet" },
          due_date: { type: "string", description: "Förfallodatum i format YYYY-MM-DD" },
          lead_id: { type: "string", description: "Lead-ID (UUID) att koppla uppgiften till. Måste vara ett riktigt UUID från databasen." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leads",
      description: "Hämta befintliga leads från systemet med valfria filter. Returnerar riktiga lead IDs (UUID) som kan användas för att skapa uppgifter.",
      parameters: {
        type: "object",
        properties: {
          has_email: { type: "boolean", description: "Filtrera på leads som har e-post" },
          has_website: { type: "boolean", description: "Filtrera på leads som har webbplats" },
          no_website: { type: "boolean", description: "Filtrera på leads som SAKNAR webbplats" },
          limit: { type: "number", description: "Antal leads att hämta" },
          source: { type: "string", description: "Filtrera på källa" },
          search: { type: "string", description: "Sök på företagsnamn" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_email_stats",
      description: "Hämta statistik om skickade mail, öppningsgrad etc.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Antal dagar bakåt att hämta statistik för (default 30)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leads_opened_emails",
      description: "Hämta leads som har öppnat mail vi skickat - bra för uppföljning.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Antal leads att hämta" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_outreach_email",
      description: "Generera ett smart outreach-mailförslag för en lead. AI:n analyserar leadens data (hemsida, bransch etc) och föreslår bästa approach. Returnerar ämne, brödtext och strategi-motivering. Använd detta INNAN send_outreach_email för att låta användaren granska och ge feedback.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "Lead-ID (UUID) att generera mail för" },
          focus: { type: "string", description: "Vad mailet ska fokusera på, t.ex. 'boka möte', 'SEO-förbättringar', 'ny hemsida'" },
          tone: { type: "string", enum: ["standard", "familiar", "informative", "direct"], description: "Tonalitet: standard (balanserad), familiar (varm/personlig), informative (faktabaserad), direct (kort och koncis)" },
          custom_instructions: { type: "string", description: "Extra instruktioner från användaren, t.ex. 'nämn deras nya produktlansering', 'fokusera på mobilvänlighet'" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_outreach_email",
      description: "Skicka ett outreach-mail till en lead. Använd draft_outreach_email först för att generera och låta användaren godkänna innehållet. KRÄVER att användaren explicit godkänner mailet innan det skickas.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "Lead-ID (UUID) att skicka mail till" },
          subject: { type: "string", description: "Ämnesrad för mailet" },
          body: { type: "string", description: "Brödtext för mailet (utan signatur - läggs till automatiskt)" },
        },
        required: ["lead_id", "subject", "body"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, executeTools = false } = await req.json();

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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // System prompt for the AI agent
    const systemPrompt = `Du är en AI-assistent för CoFlow CRM-system. Du hjälper användaren att:
- Hitta nya leads via Google Places
- Importera företag som leads OCH uppdatera deras info
- Analysera webbplatser (enskilt och i batch)
- Sammanfatta analysresultat
- Skapa uppgifter för leads
- Skicka smarta outreach-mail
- Ge statistik och insikter

VIKTIGA REGLER:
1. När du visar leads, inkludera alltid deras ID i formatet [LEAD:uuid:Företagsnamn] så användaren kan klicka på dem.
2. När du skapar uppgifter för leads, använd ALLTID riktiga lead UUIDs från get_leads eller nyss skapade leads.
3. För att koppla uppgifter till leads: Först hämta leads med get_leads, sedan använd deras id för att skapa uppgifter.
4. Svara alltid på svenska och var professionell men vänlig.

LEAD-SÖKNING WORKFLOW (VIKTIG!):
När användaren ber dig hitta företag/leads baserat på sökord (t.ex. "hitta 10 snickare i Stockholm"):
1. Använd search_google_places med sökordet och platsen
2. VISA ALLTID resultaten som en numrerad lista med format:
   📍 **Hittade [X] företag för "[sökord]" i [plats]:**
   
   1. **[Företagsnamn]** - [Adress]
      📞 [Telefon] | 🌐 [Hemsida eller "Saknar hemsida"]
      ⭐ [Rating] ([Antal recensioner] recensioner)
   
   (upprepa för alla resultat)
   
   ---
   **Sammanfattning:** [X] med hemsida, [Y] utan hemsida
   
   **Vill du att jag:**
   - ✅ Skapar leads av alla [X] företag?
   - 📊 Skapar leads och kör webbanalys för de med hemsida?
   - ✏️ Väljer specifika företag? (ange nummer, t.ex. "1, 3, 5")
3. VÄNTA på användarens svar innan du importerar
4. När användaren godkänner, använd import_places_as_leads med run_analysis=true om de vill ha analys

LEAD-HANTERING WORKFLOW:
1. import_places_as_leads - Importerar företag som leads (med valfri automatisk analys)
2. update_lead - Uppdaterar lead med ny info (kontakt, email, telefon etc)
3. run_analysis_for_lead - Kör analys för EN lead och sparar resultatet + uppdaterar leadens info
4. run_batch_analysis - Kör analyser för FLERA leads (max 5 åt gången)
5. get_analysis_summary - Hämta och sammanfatta analysresultat

ANALYS WORKFLOW:
- När användaren vill analysera leads, använd run_analysis_for_lead (enskild) eller run_batch_analysis (flera)
- Analysen sparar resultat i databasen OCH uppdaterar leadens kontaktinfo automatiskt
- Använd get_analysis_summary för att hämta och presentera resultat
- Efter analys, föreslå att skapa uppgifter eller generera outreach baserat på resultaten

OUTREACH-MAIL WORKFLOW:
1. När användaren vill skicka mail, använd ALLTID draft_outreach_email först
2. Presentera mailet tydligt med ämne och innehåll
3. Förklara din strategi: varför du valde denna approach
4. Fråga användaren om de vill:
   - Godkänna och skicka mailet
   - Ändra fokus (t.ex. "fokusera mer på SEO")
   - Ändra ton (standard/familiar/informative/direct)
   - Lägga till något specifikt
   - Ta bort något
5. Om användaren ger feedback, generera ett nytt utkast med draft_outreach_email och deras instruktioner
6. SKICKA ALDRIG mail utan explicit godkännande från användaren (t.ex. "ja, skicka det", "godkänt", "kör på")

MAIL-PRESENTATION FORMAT:
När du visar ett mailutkast, formatera det så här:

📧 **Förslag på outreach-mail**

**Ämne:** [ämnesrad]

**Innehåll:**
[brödtext]

---
**Min strategi:** [kort förklaring av approach]

**Vill du att jag:**
- ✅ Skickar mailet som det är?
- ✏️ Ändrar något? (berätta vad)
- 🔄 Testar en annan approach?

LEAD-FORMAT:
- Visa leads så här: "[LEAD:abc123-uuid:Företaget AB]" - detta blir klickbart för användaren
- Exempel: "Jag hittade [LEAD:550e8400-e29b-41d4-a716-446655440000:Restaurang Bella] som saknar hemsida."

SMART ANALYS:
- Om leaden har hemsida: Analysera deras sida och föreslå förbättringar (SEO, prestanda, design)
- Om leaden SAKNAR hemsida: Pitcha värdet av en professionell hemsida
- Anpassa tonen efter leadens bransch och storlek`;


    console.log("AI Agent chat request, messages:", messages.length);

    // Call AI with tools
    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: agentTools,
        tool_choice: "auto",
      }),
    });

    console.log("Gemini first-call status:", aiResponse.status);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "För många förfrågningar, försök igen senare." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-tjänstens kvot är slut. Kontrollera saldo/kvot för API-nyckeln." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message;

    // Surface "empty" responses instead of silently returning no content (which
    // the UI showed as the generic "Jag kunde inte generera ett svar."). If the
    // model returned neither text nor a tool call, log the raw payload (incl.
    // finish_reason) and return a real error so the cause is visible.
    if (!assistantMessage || (!assistantMessage.content && !(assistantMessage.tool_calls?.length))) {
      console.error("AI returned empty message. Raw aiData:", JSON.stringify(aiData));
      const finishReason = aiData.choices?.[0]?.finish_reason ?? "unknown";
      return new Response(
        JSON.stringify({
          error: `AI gav inget svar (finish_reason: ${finishReason}). Kontrollera Gemini/verktygskonfigurationen.`,
          detail: aiData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if AI wants to use tools
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && executeTools) {
      // Execute the tool calls
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall: any) => {
          const { name, arguments: argsStr } = toolCall.function;
          const args = JSON.parse(argsStr);
          
          console.log("Executing tool:", name, args);
          
          const result = await executeToolCall(name, args, supabase, supabaseAuth, userId);
          
          return {
            tool_call_id: toolCall.id,
            role: "tool",
            name,
            content: JSON.stringify(result),
          };
        })
      );

      // Call AI again with tool results
      const followUpResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults,
          ],
        }),
      });

      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text();
        console.error("Follow-up AI call failed:", followUpResponse.status, errorText);
        throw new Error(`Follow-up AI call failed: ${followUpResponse.status}`);
      }

      const followUpData = await followUpResponse.json();
      const followUpMessage = followUpData.choices?.[0]?.message;
      
      // If no message content, construct a summary from tool results
      if (!followUpMessage?.content) {
        console.log("No content from follow-up, summarizing tool results");
        const summaryParts: string[] = [];
        
        for (const result of toolResults) {
          const parsedContent = JSON.parse(result.content);
          if (parsedContent.success) {
            if (result.name === "create_task" && parsedContent.task) {
              summaryParts.push(`✅ Skapade uppgift: "${parsedContent.task.title}"`);
            } else if (result.name === "create_tasks_for_leads" && parsedContent.created) {
              summaryParts.push(`✅ Skapade ${parsedContent.created} uppgifter för leads`);
            } else if (result.name === "get_leads" && parsedContent.leads) {
              const leadsInfo = parsedContent.leads.slice(0, 5).map((l: any) => l.displayFormat).join(", ");
              summaryParts.push(`📋 Hittade ${parsedContent.count} leads: ${leadsInfo}${parsedContent.count > 5 ? "..." : ""}`);
            } else if (result.name === "search_google_places" && parsedContent.places) {
              summaryParts.push(`🔍 Hittade ${parsedContent.count} företag (${parsedContent.summary?.withoutWebsite || 0} utan hemsida)`);
            } else if (result.name === "import_places_as_leads" && parsedContent.imported) {
              const leadsInfo = parsedContent.leads.slice(0, 5).map((l: any) => l.displayFormat).join(", ");
              let importSummary = `✅ Importerade ${parsedContent.imported} leads: ${leadsInfo}`;
              
              // Add analysis results if available
              if (parsedContent.analysisRun && parsedContent.summary) {
                const s = parsedContent.summary;
                importSummary += `\n\n📊 **Webbanalyser körda:** ${s.analyzed} leads analyserade`;
                if (s.withPoorPerformance > 0) {
                  importSummary += `\n- 🔴 ${s.withPoorPerformance} med låg prestanda (säljmöjlighet!)`;
                }
                if (s.withGoodPerformance > 0) {
                  importSummary += `\n- 🟢 ${s.withGoodPerformance} med bra prestanda`;
                }
                if (s.foundContactInfo > 0) {
                  importSummary += `\n- 📧 Hittade kontaktinfo för ${s.foundContactInfo} leads`;
                }
              }
              
              summaryParts.push(importSummary);
            } else if (result.name === "update_lead" && parsedContent.lead) {
              summaryParts.push(`✅ Uppdaterade ${parsedContent.lead.displayFormat || parsedContent.lead.company_name}: ${parsedContent.updated.join(", ")}`);
            } else if (result.name === "run_analysis_for_lead" && parsedContent.analysis) {
              const a = parsedContent.analysis;
              const lead = parsedContent.lead;
              let summary = `📊 Analyserade ${lead.displayFormat}`;
              if (a.scores) {
                summary += `\n- Prestanda: ${a.scores.performance}/100\n- SEO: ${a.scores.seo}/100`;
              }
              if (a.leadUpdated) {
                summary += `\n- 🔄 Uppdaterade lead med hittad kontaktinfo`;
              }
              summaryParts.push(summary);
            } else if (result.name === "run_batch_analysis" && parsedContent.results) {
              let summary = `📊 **Batch-analys klar** - ${parsedContent.analyzed} leads analyserade\n`;
              for (const r of parsedContent.results) {
                summary += `\n${r.displayFormat}:`;
                if (r.scores) {
                  summary += ` P:${r.scores.performance} SEO:${r.scores.seo}`;
                }
                if (r.updatedFields) {
                  summary += ` (uppdaterade: ${r.updatedFields.join(", ")})`;
                }
              }
              summaryParts.push(summary);
            } else if (result.name === "get_analysis_summary" && parsedContent.summaries) {
              let summary = `📈 **Analyssammanfattning**\n`;
              for (const s of parsedContent.summaries) {
                summary += `\n${s.lead?.displayFormat || s.url}: Snitt ${s.averageScore}/100`;
                if (s.recommendations?.length) {
                  summary += `\n  → ${s.recommendations.join("; ")}`;
                }
              }
              summaryParts.push(summary);
            } else if (result.name === "draft_outreach_email" && parsedContent.draft) {
              const draft = parsedContent.draft;
              const lead = parsedContent.lead;
              summaryParts.push(`📧 **Förslag på outreach-mail till ${lead.company_name}**\n\n**Ämne:** ${draft.subject}\n\n**Innehåll:**\n${draft.body}\n\n---\n**Min strategi:** ${draft.strategy}\n\n**Vill du att jag:**\n- ✅ Skickar mailet som det är?\n- ✏️ Ändrar något? (berätta vad)\n- 🔄 Testar en annan approach?`);
            } else if (result.name === "send_outreach_email" && parsedContent.message) {
              summaryParts.push(`✅ ${parsedContent.message}`);
            } else if (result.name === "analyze_website" && parsedContent.analysis) {
              const a = parsedContent.analysis;
              let summary = `📊 Analyserade ${a.url}`;
              if (a.performance) {
                summary += `\n- Prestanda: ${a.performance.performanceScore}/100\n- SEO: ${a.performance.seoScore}/100`;
              }
              if (a.scraped?.email) {
                summary += `\n- Hittad e-post: ${a.scraped.email}`;
              }
              summaryParts.push(summary);
            }
          } else if (parsedContent.error) {
            summaryParts.push(`❌ Fel vid ${result.name}: ${parsedContent.error}`);
          }
        }
        
        return new Response(
          JSON.stringify({
            message: { 
              role: "assistant", 
              content: summaryParts.length > 0 
                ? summaryParts.join("\n\n") 
                : "Åtgärderna utfördes men jag kunde inte generera en sammanfattning."
            },
            toolCalls: assistantMessage.tool_calls,
            toolResults,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({
          message: followUpMessage,
          toolCalls: assistantMessage.tool_calls,
          toolResults,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No tool calls, return the message directly
    return new Response(
      JSON.stringify({
        message: assistantMessage,
        toolCalls: assistantMessage?.tool_calls || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("AI Agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Execute a tool call and return the result
async function executeToolCall(
  name: string,
  args: any,
  supabase: any,
  userClient: any,
  userId: string
): Promise<any> {
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();
  const userOrgId = userProfile?.organization_id || null;

  switch (name) {
    case "get_leads": {
      // RLS-scoped client: the agent only sees leads the caller can access.
      const supabase = userClient;
      if (!userOrgId) {
        return { success: false, error: "Användaren tillhör ingen organisation" };
      }
      let query = supabase.from("leads").select("*");
      query = query.eq("organization_id", userOrgId);
      
      if (args.has_email) {
        query = query.not("email", "is", null);
      }
      if (args.has_website) {
        query = query.not("website", "is", null);
      }
      if (args.no_website) {
        query = query.or("website.is.null,website.eq.");
      }
      if (args.source) {
        query = query.eq("source", args.source);
      }
      if (args.search) {
        query = query.ilike("company_name", `%${args.search}%`);
      }
      
      query = query.order("created_at", { ascending: false });
      
      if (args.limit) {
        query = query.limit(args.limit);
      } else {
        query = query.limit(10);
      }
      
      const { data, error } = await query;
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      // Format leads for display with clickable format
      const formattedLeads = data.map((lead: any) => ({
        ...lead,
        displayFormat: `[LEAD:${lead.id}:${lead.company_name}]`,
      }));
      
      return { success: true, leads: formattedLeads, count: data.length };
    }
    
    case "create_lead": {
      if (!userOrgId) {
        return { success: false, error: "Användaren tillhör ingen organisation" };
      }
      const { data, error } = await supabase
        .from("leads")
        .insert({
          organization_id: userOrgId,
          company_name: args.company_name,
          email: args.email || null,
          phone: args.phone || null,
          website: args.website || null,
          source: args.source || "ai_agent",
          created_by: userId,
        })
        .select()
        .single();
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { 
        success: true, 
        lead: data,
        displayFormat: `[LEAD:${data.id}:${data.company_name}]`,
      };
    }
    
    case "update_lead": {
      if (!userOrgId) {
        return { success: false, error: "Användaren tillhör ingen organisation" };
      }
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!args.lead_id || !uuidRegex.test(args.lead_id)) {
        return { success: false, error: "Ogiltigt lead-ID" };
      }
      
      // Build update object with only provided fields
      const updateData: any = {};
      if (args.company_name) updateData.company_name = args.company_name;
      if (args.contact_name) updateData.contact_name = args.contact_name;
      if (args.email) updateData.email = args.email;
      if (args.phone) updateData.phone = args.phone;
      if (args.website) updateData.website = args.website;
      
      if (Object.keys(updateData).length === 0) {
        return { success: false, error: "Ingen data att uppdatera" };
      }
      
      const { data, error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", args.lead_id)
        .eq("organization_id", userOrgId)
        .select()
        .single();
      
      if (error) {
        console.error("Update lead error:", error);
        return { success: false, error: error.message };
      }
      
      return { 
        success: true, 
        lead: data,
        updated: Object.keys(updateData),
        displayFormat: `[LEAD:${data.id}:${data.company_name}]`,
      };
    }
    
    case "run_analysis_for_lead": {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!args.lead_id || !uuidRegex.test(args.lead_id)) {
        return { success: false, error: "Ogiltigt lead-ID" };
      }
      
      if (!userOrgId) {
        return { success: false, error: "Användaren tillhör ingen organisation" };
      }
      
      // Get lead
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", args.lead_id)
        .eq("organization_id", userOrgId)
        .single();
      
      if (leadError || !lead) {
        return { success: false, error: "Lead hittades inte" };
      }
      
      if (!lead.website) {
        return { success: false, error: `${lead.company_name} har ingen webbplats att analysera` };
      }
      
      let url = lead.website.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
      }
      
      const analysisResult: any = { url, leadUpdates: {} };
      
      // Scrape with Firecrawl
      const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlApiKey) {
        try {
          const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${firecrawlApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url,
              formats: ["markdown"],
              onlyMainContent: false,
            }),
          });
          
          if (scrapeRes.ok) {
            const scrapeData = await scrapeRes.json();
            const markdown = scrapeData.data?.markdown || "";
            const metadata = scrapeData.data?.metadata || {};
            
            // Extract contact info
            const emailMatch = markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const phoneMatch = markdown.match(/(?:\+46[\s-]?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}|0\d{1,3}[\s-]\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}|07\d[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/);
            
            analysisResult.scraped = {
              title: metadata.title,
              description: metadata.description,
              foundEmail: emailMatch ? emailMatch[0] : null,
              foundPhone: phoneMatch ? phoneMatch[0] : null,
            };
            
            // Update lead with found contact info
            if (emailMatch && !lead.email) {
              analysisResult.leadUpdates.email = emailMatch[0];
            }
            if (phoneMatch && !lead.phone) {
              analysisResult.leadUpdates.phone = phoneMatch[0];
            }
          }
        } catch (e) {
          analysisResult.scrapeError = e instanceof Error ? e.message : "Firecrawl-fel";
        }
      }
      
      // Get PageSpeed scores
      let performanceScore = null;
      let seoScore = null;
      let accessibilityScore = null;
      let bestPracticesScore = null;
      let rawData: any = null;
      
      try {
        const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES&strategy=mobile`;
        const psRes = await fetch(psUrl);
        const psData = await psRes.json();
        
        if (psData.lighthouseResult?.categories) {
          const cats = psData.lighthouseResult.categories;
          performanceScore = Math.round((cats.performance?.score || 0) * 100);
          seoScore = Math.round((cats.seo?.score || 0) * 100);
          accessibilityScore = Math.round((cats.accessibility?.score || 0) * 100);
          bestPracticesScore = Math.round((cats["best-practices"]?.score || 0) * 100);
          rawData = psData.lighthouseResult;
          
          analysisResult.scores = {
            performance: performanceScore,
            seo: seoScore,
            accessibility: accessibilityScore,
            bestPractices: bestPracticesScore,
          };
        }
      } catch (e) {
        analysisResult.pageSpeedError = e instanceof Error ? e.message : "PageSpeed-fel";
      }
      
      // Save analysis to database
      const { data: savedAnalysis, error: saveError } = await supabase
        .from("web_analyses")
        .insert({
          url,
          lead_id: lead.id,
          analyzed_by: userId,
          organization_id: userOrgId,
          performance_score: performanceScore,
          seo_score: seoScore,
          accessibility_score: accessibilityScore,
          best_practices_score: bestPracticesScore,
          raw_data: rawData,
        })
        .select()
        .single();
      
      if (saveError) {
        console.error("Save analysis error:", saveError);
      } else {
        analysisResult.analysisId = savedAnalysis.id;
      }
      
      // Update lead if we found new contact info
      if (Object.keys(analysisResult.leadUpdates).length > 0) {
        const { error: updateError } = await supabase
          .from("leads")
          .update(analysisResult.leadUpdates)
          .eq("id", lead.id);
        
        if (updateError) {
          console.error("Update lead error:", updateError);
        } else {
          analysisResult.leadUpdated = true;
        }
      }
      
      return {
        success: true,
        analysis: analysisResult,
        lead: {
          id: lead.id,
          company_name: lead.company_name,
          displayFormat: `[LEAD:${lead.id}:${lead.company_name}]`,
        },
      };
    }
    
    case "run_batch_analysis": {
      const leadIds = args.lead_ids || [];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      const validIds = leadIds.filter((id: string) => uuidRegex.test(id)).slice(0, 5);
      
      if (validIds.length === 0) {
        return { success: false, error: "Inga giltiga lead IDs" };
      }
      
      // Get user's organization_id (required for RLS)
      const { data: batchProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .single();
      
      const batchOrgId = batchProfile?.organization_id;
      if (!batchOrgId) {
        return { success: false, error: "Användaren tillhör ingen organisation" };
      }
      
      // Get leads with websites
      const { data: leads } = await supabase
        .from("leads")
        .select("*")
        .in("id", validIds)
        .not("website", "is", null);
      
      if (!leads || leads.length === 0) {
        return { success: false, error: "Inga leads med webbplats hittades" };
      }
      
      const results: any[] = [];
      const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
      
      for (const lead of leads) {
        let url = lead.website.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `https://${url}`;
        }
        
        const leadResult: any = {
          leadId: lead.id,
          companyName: lead.company_name,
          url,
          displayFormat: `[LEAD:${lead.id}:${lead.company_name}]`,
        };
        
        const leadUpdates: any = {};
        
        // Scrape
        if (firecrawlApiKey) {
          try {
            const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${firecrawlApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url,
                formats: ["markdown"],
                onlyMainContent: false,
              }),
            });
            
            if (scrapeRes.ok) {
              const scrapeData = await scrapeRes.json();
              const markdown = scrapeData.data?.markdown || "";
              
              const emailMatch = markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              const phoneMatch = markdown.match(/(?:\+46[\s-]?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}|0\d{1,3}[\s-]\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}|07\d[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/);
              
              if (emailMatch && !lead.email) leadUpdates.email = emailMatch[0];
              if (phoneMatch && !lead.phone) leadUpdates.phone = phoneMatch[0];
            }
          } catch (e) {
            leadResult.scrapeError = true;
          }
        }
        
        // PageSpeed
        let performanceScore = null;
        let seoScore = null;
        let accessibilityScore = null;
        let bestPracticesScore = null;
        let rawData: any = null;
        
        try {
          const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES&strategy=mobile`;
          const psRes = await fetch(psUrl);
          const psData = await psRes.json();
          
          if (psData.lighthouseResult?.categories) {
            const cats = psData.lighthouseResult.categories;
            performanceScore = Math.round((cats.performance?.score || 0) * 100);
            seoScore = Math.round((cats.seo?.score || 0) * 100);
            accessibilityScore = Math.round((cats.accessibility?.score || 0) * 100);
            bestPracticesScore = Math.round((cats["best-practices"]?.score || 0) * 100);
            rawData = psData.lighthouseResult;
            
            leadResult.scores = {
              performance: performanceScore,
              seo: seoScore,
              accessibility: accessibilityScore,
              bestPractices: bestPracticesScore,
            };
          }
        } catch (e) {
          leadResult.pageSpeedError = true;
        }
        
        // Save analysis
        await supabase
          .from("web_analyses")
          .insert({
            url,
            lead_id: lead.id,
            analyzed_by: userId,
            organization_id: batchOrgId,
            performance_score: performanceScore,
            seo_score: seoScore,
            accessibility_score: accessibilityScore,
            best_practices_score: bestPracticesScore,
            raw_data: rawData,
          });
        
        // Update lead
        if (Object.keys(leadUpdates).length > 0) {
          await supabase
            .from("leads")
            .update(leadUpdates)
            .eq("id", lead.id);
          leadResult.updatedFields = Object.keys(leadUpdates);
        }
        
        results.push(leadResult);
      }
      
      return {
        success: true,
        analyzed: results.length,
        results,
        summary: {
          withGoodPerformance: results.filter(r => r.scores?.performance >= 80).length,
          withPoorPerformance: results.filter(r => r.scores?.performance < 50).length,
          withContactInfo: results.filter(r => r.updatedFields?.length > 0).length,
        },
      };
    }
    
    case "get_analysis_summary": {
      // RLS-scoped client: only analyses the caller can access.
      const supabase = userClient;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      let leadIdsToQuery: string[] = [];
      
      if (args.lead_id && uuidRegex.test(args.lead_id)) {
        leadIdsToQuery = [args.lead_id];
      } else if (args.lead_ids && Array.isArray(args.lead_ids)) {
        leadIdsToQuery = args.lead_ids.filter((id: string) => uuidRegex.test(id));
      }
      
      if (leadIdsToQuery.length === 0) {
        // Get recent analyses
        const { data: recentAnalyses, error } = await supabase
          .from("web_analyses")
          .select(`
            *,
            leads!web_analyses_lead_id_fkey (
              id,
              company_name,
              email,
              phone
            )
          `)
          .order("created_at", { ascending: false })
          .limit(10);
        
        if (error) {
          return { success: false, error: error.message };
        }
        
        const formattedAnalyses = (recentAnalyses || []).map((a: any) => ({
          id: a.id,
          url: a.url,
          scores: {
            performance: a.performance_score,
            seo: a.seo_score,
            accessibility: a.accessibility_score,
            bestPractices: a.best_practices_score,
          },
          lead: a.leads ? {
            id: a.leads.id,
            company_name: a.leads.company_name,
            displayFormat: `[LEAD:${a.leads.id}:${a.leads.company_name}]`,
          } : null,
          analyzedAt: a.created_at,
        }));
        
        return {
          success: true,
          analyses: formattedAnalyses,
          count: formattedAnalyses.length,
        };
      }
      
      // Get analyses for specific leads
      const { data: analyses, error } = await supabase
        .from("web_analyses")
        .select(`
          *,
          leads!web_analyses_lead_id_fkey (
            id,
            company_name,
            email,
            phone,
            website
          )
        `)
        .in("lead_id", leadIdsToQuery)
        .order("created_at", { ascending: false });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      if (!analyses || analyses.length === 0) {
        return { success: false, error: "Inga analyser hittades för dessa leads" };
      }
      
      // Group by lead (get most recent for each)
      const leadAnalysisMap = new Map();
      for (const a of analyses) {
        if (!leadAnalysisMap.has(a.lead_id)) {
          leadAnalysisMap.set(a.lead_id, a);
        }
      }
      
      const summaries = Array.from(leadAnalysisMap.values()).map((a: any) => {
        const scores = {
          performance: a.performance_score,
          seo: a.seo_score,
          accessibility: a.accessibility_score,
          bestPractices: a.best_practices_score,
        };
        
        // Generate recommendations based on scores
        const recommendations: string[] = [];
        if (scores.performance < 50) recommendations.push("Prestanda är låg - optimera bilder och JavaScript");
        if (scores.seo < 70) recommendations.push("SEO behöver förbättras - fokusera på meta-taggar och struktur");
        if (scores.accessibility < 70) recommendations.push("Tillgänglighet kan förbättras");
        if (scores.bestPractices < 70) recommendations.push("Best practices bör ses över");
        
        return {
          lead: a.leads ? {
            id: a.leads.id,
            company_name: a.leads.company_name,
            email: a.leads.email,
            website: a.leads.website,
            displayFormat: `[LEAD:${a.leads.id}:${a.leads.company_name}]`,
          } : null,
          url: a.url,
          scores,
          averageScore: Math.round((scores.performance + scores.seo + scores.accessibility + scores.bestPractices) / 4),
          recommendations: args.include_recommendations ? recommendations : undefined,
          analyzedAt: a.created_at,
        };
      });
      
      return {
        success: true,
        summaries,
        count: summaries.length,
        overallSummary: {
          averagePerformance: Math.round(summaries.reduce((sum, s) => sum + (s.scores.performance || 0), 0) / summaries.length),
          averageSeo: Math.round(summaries.reduce((sum, s) => sum + (s.scores.seo || 0), 0) / summaries.length),
          needsWork: summaries.filter(s => s.averageScore < 60).length,
          goodShape: summaries.filter(s => s.averageScore >= 80).length,
        },
      };
    }
    
    case "import_places_as_leads": {
      const places = args.places || [];
      const runAnalysis = args.run_analysis || false;
      
      if (places.length === 0) {
        return { success: false, error: "Inga företag att importera" };
      }
      
      // Get user's organization_id (required for RLS)
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .single();
      
      const organizationId = profile?.organization_id;
      if (!organizationId) {
        return { success: false, error: "Användaren tillhör ingen organisation" };
      }
      
      const leadsToInsert = places.map((place: any) => ({
        company_name: place.name,
        phone: place.phone || null,
        website: place.website || null,
        source: "google_places",
        source_data: { address: place.address },
        created_by: userId,
        organization_id: organizationId,
      }));
      
      const { data, error } = await supabase
        .from("leads")
        .insert(leadsToInsert)
        .select();
      
      if (error) {
        console.error("Import error:", error);
        return { success: false, error: error.message };
      }
      
      const formattedLeads = data.map((lead: any) => ({
        id: lead.id,
        company_name: lead.company_name,
        website: lead.website,
        displayFormat: `[LEAD:${lead.id}:${lead.company_name}]`,
      }));
      
      // If run_analysis is true, run batch analysis for leads with websites
      const analysisResults: any[] = [];
      if (runAnalysis) {
        const leadsWithWebsite = data.filter((lead: any) => lead.website);
        const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
        
        for (const lead of leadsWithWebsite.slice(0, 5)) { // Max 5 analyses
          let url = lead.website.trim();
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = `https://${url}`;
          }
          
          const leadResult: any = {
            leadId: lead.id,
            companyName: lead.company_name,
            url,
            displayFormat: `[LEAD:${lead.id}:${lead.company_name}]`,
          };
          
          const leadUpdates: any = {};
          
          // Scrape with Firecrawl
          if (firecrawlApiKey) {
            try {
              const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${firecrawlApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url,
                  formats: ["markdown"],
                  onlyMainContent: false,
                }),
              });
              
              if (scrapeRes.ok) {
                const scrapeData = await scrapeRes.json();
                const markdown = scrapeData.data?.markdown || "";
                
                const emailMatch = markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                const phoneMatch = markdown.match(/(?:\+46[\s-]?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}|0\d{1,3}[\s-]\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}|07\d[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/);
                
                if (emailMatch && !lead.email) leadUpdates.email = emailMatch[0];
                if (phoneMatch && !lead.phone) leadUpdates.phone = phoneMatch[0];
                
                leadResult.foundEmail = emailMatch ? emailMatch[0] : null;
                leadResult.foundPhone = phoneMatch ? phoneMatch[0] : null;
              }
            } catch (e) {
              leadResult.scrapeError = true;
            }
          }
          
          // PageSpeed analysis
          let performanceScore = null;
          let seoScore = null;
          let accessibilityScore = null;
          let bestPracticesScore = null;
          let rawData: any = null;
          
          try {
            const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES&strategy=mobile`;
            const psRes = await fetch(psUrl);
            const psData = await psRes.json();
            
            if (psData.lighthouseResult?.categories) {
              const cats = psData.lighthouseResult.categories;
              performanceScore = Math.round((cats.performance?.score || 0) * 100);
              seoScore = Math.round((cats.seo?.score || 0) * 100);
              accessibilityScore = Math.round((cats.accessibility?.score || 0) * 100);
              bestPracticesScore = Math.round((cats["best-practices"]?.score || 0) * 100);
              rawData = psData.lighthouseResult;
              
              leadResult.scores = {
                performance: performanceScore,
                seo: seoScore,
                accessibility: accessibilityScore,
                bestPractices: bestPracticesScore,
              };
            }
          } catch (e) {
            leadResult.pageSpeedError = true;
          }
          
          // Save analysis
          await supabase
            .from("web_analyses")
            .insert({
              url,
              lead_id: lead.id,
              analyzed_by: userId,
              organization_id: organizationId,
              performance_score: performanceScore,
              seo_score: seoScore,
              accessibility_score: accessibilityScore,
              best_practices_score: bestPracticesScore,
              raw_data: rawData,
            });
          
          // Update lead with found contact info
          if (Object.keys(leadUpdates).length > 0) {
            await supabase
              .from("leads")
              .update(leadUpdates)
              .eq("id", lead.id);
            leadResult.updatedFields = Object.keys(leadUpdates);
          }
          
          analysisResults.push(leadResult);
        }
      }
      
      return { 
        success: true, 
        imported: data.length,
        leads: formattedLeads,
        analysisRun: runAnalysis,
        analysisResults: runAnalysis ? analysisResults : undefined,
        summary: runAnalysis ? {
          analyzed: analysisResults.length,
          withGoodPerformance: analysisResults.filter(r => r.scores?.performance >= 80).length,
          withPoorPerformance: analysisResults.filter(r => r.scores?.performance < 50).length,
          foundContactInfo: analysisResults.filter(r => r.foundEmail || r.foundPhone).length,
        } : undefined,
      };
    }
    
    case "create_tasks_for_leads": {
      const leadIds = args.lead_ids || [];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      // Filter to only valid UUIDs
      const validIds = leadIds.filter((id: string) => uuidRegex.test(id));
      
      if (validIds.length === 0) {
        return { success: false, error: "Inga giltiga lead IDs" };
      }
      
      // Get lead info for titles
      const { data: leads } = await supabase
        .from("leads")
        .select("id, company_name")
        .in("id", validIds);
      
      if (!leads || leads.length === 0) {
        return { success: false, error: "Inga leads hittades med dessa IDs" };
      }
      
      const tasksToInsert = leads.map((lead: any) => ({
        title: args.task_title_template.replace("{company_name}", lead.company_name),
        description: args.task_description || null,
        priority: args.priority || "medium",
        due_date: args.due_date || null,
        lead_id: lead.id,
        status: "todo",
        created_by: userId,
        assigned_to: userId,
      }));
      
      const { data: tasks, error } = await supabase
        .from("tasks")
        .insert(tasksToInsert)
        .select();
      
      if (error) {
        console.error("Task creation error:", error);
        return { success: false, error: error.message };
      }
      
      return { 
        success: true, 
        created: tasks.length,
        tasks: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          lead_id: t.lead_id,
        })),
      };
    }
    
    case "create_task": {
      // Validate lead_id if provided - must be a valid UUID
      let validLeadId = null;
      if (args.lead_id) {
        // Check if it's a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(args.lead_id)) {
          // Verify the lead exists
          const { data: leadCheck } = await supabase
            .from("leads")
            .select("id")
            .eq("id", args.lead_id)
            .eq("organization_id", userOrgId)
            .single();
          
          if (leadCheck) {
            validLeadId = args.lead_id;
          }
        }
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: args.title,
          description: args.description || null,
          priority: args.priority || "medium",
          due_date: args.due_date || null,
          lead_id: validLeadId,
          status: "todo",
          created_by: userId,
          assigned_to: userId,
        })
        .select()
        .single();
      
      if (error) {
        console.error("Task creation error:", error);
        return { success: false, error: error.message };
      }
      
      return { success: true, task: data, linkedToLead: !!validLeadId };
    }
    
    case "get_email_stats": {
      const supabase = userClient;
      const days = args.days || 30;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      
      const { data: sentEmails, error } = await supabase
        .from("sent_emails")
        .select("*")
        .gte("created_at", fromDate.toISOString())
        .eq("sent_by", userId);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      const totalSent = sentEmails.length;
      const opened = sentEmails.filter((e: any) => e.opened_at).length;
      const openRate = totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0;
      
      return {
        success: true,
        stats: {
          totalSent,
          opened,
          openRate: `${openRate}%`,
          period: `${days} dagar`,
        },
      };
    }
    
    case "get_leads_opened_emails": {
      // RLS-scoped client: only the caller's own opened emails (also blocks cross-org).
      const supabase = userClient;
      const { data, error } = await supabase
        .from("sent_emails")
        .select(`
          *,
          leads!sent_emails_lead_id_fkey (
            id,
            company_name,
            email,
            phone,
            website
          )
        `)
        .not("opened_at", "is", null)
        .not("lead_id", "is", null)
        .order("opened_at", { ascending: false })
        .limit(args.limit || 20);
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      // Deduplicate by lead_id
      const uniqueLeads = new Map();
      for (const email of data) {
        if (email.leads && !uniqueLeads.has(email.lead_id)) {
          uniqueLeads.set(email.lead_id, {
            lead: email.leads,
            lastOpenedAt: email.opened_at,
            openedCount: email.opened_count || 1,
            subject: email.subject,
          });
        }
      }
      
      return {
        success: true,
        leads: Array.from(uniqueLeads.values()),
        count: uniqueLeads.size,
      };
    }
    
    case "search_google_places": {
      const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
      if (!apiKey) {
        return { success: false, error: "Google Places API-nyckel saknas" };
      }

      const query = args.query;
      // Add ", Sverige" if no location specified to ensure Swedish results
      let location = args.location || "";
      if (!location) {
        location = "Sverige";
      }
      const limit = Math.min(args.limit || 10, 20);
      
      const textQuery = `${query} i ${location}`;
      const searchUrl = "https://places.googleapis.com/v1/places:searchText";

      try {
        const searchRes = await fetch(searchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount",
          },
          body: JSON.stringify({
            textQuery: textQuery,
            maxResultCount: limit,
            languageCode: "sv",
            regionCode: "SE",
          }),
        });

        const searchData = await searchRes.json();

        if (searchData.error) {
          return { success: false, error: searchData.error.message };
        }

        const results = (searchData.places || []).map((place: any, index: number) => ({
          index: index + 1,
          name: place.displayName?.text || "",
          address: place.formattedAddress || "",
          phone: place.nationalPhoneNumber || null,
          website: place.websiteUri || null,
          rating: place.rating || null,
          reviewCount: place.userRatingCount || 0,
          hasWebsite: !!place.websiteUri,
        }));

        // Summarize results
        const withWebsite = results.filter((r: any) => r.hasWebsite).length;
        const withoutWebsite = results.filter((r: any) => !r.hasWebsite).length;

        return {
          success: true,
          places: results,
          count: results.length,
          summary: {
            total: results.length,
            withWebsite,
            withoutWebsite,
            query: textQuery,
          },
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Okänt fel" };
      }
    }
    
    case "analyze_website": {
      const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
      
      let url = args.url.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
      }

      const results: any = { url };

      // Try Firecrawl for content scraping
      if (firecrawlApiKey) {
        try {
          const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${firecrawlApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url,
              formats: ["markdown"],
              onlyMainContent: false,
            }),
          });

          const scrapeData = await scrapeRes.json();

          if (scrapeRes.ok && scrapeData.data) {
            const markdown = scrapeData.data.markdown || "";
            const metadata = scrapeData.data.metadata || {};

            // Extract contact info
            const emailMatch = markdown.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const phoneMatch = markdown.match(/(?:\+46[\s-]?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}|0\d{1,3}[\s-]\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}|07\d[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/);

            results.scraped = {
              title: metadata.title,
              description: metadata.description,
              email: emailMatch ? emailMatch[0] : null,
              phone: phoneMatch ? phoneMatch[0] : null,
              contentLength: markdown.length,
            };

            // Look for SEO issues in content
            const seoIssues: string[] = [];
            if (!metadata.description) seoIssues.push("Saknar meta description");
            if (!metadata.title || metadata.title.length < 30) seoIssues.push("Kort eller saknad title-tagg");
            if (markdown.length < 500) seoIssues.push("Väldigt lite textinnehåll");

            results.seoIssues = seoIssues;
          }
        } catch (e) {
          results.scrapeError = e instanceof Error ? e.message : "Firecrawl-fel";
        }
      }

      // Also try PageSpeed for performance data
      try {
        const pageSpeedUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=SEO&strategy=mobile`;
        const psRes = await fetch(pageSpeedUrl);
        const psData = await psRes.json();

        if (psData.lighthouseResult?.categories) {
          const cats = psData.lighthouseResult.categories;
          results.performance = {
            performanceScore: Math.round((cats.performance?.score || 0) * 100),
            seoScore: Math.round((cats.seo?.score || 0) * 100),
          };
        }
      } catch (e) {
        // PageSpeed is optional
      }

      return { success: true, analysis: results };
    }
    
    case "draft_outreach_email": {
      // RLS-scoped client: can only draft for leads the caller can access.
      const supabase = userClient;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!args.lead_id || !uuidRegex.test(args.lead_id)) {
        return { success: false, error: "Ogiltigt lead-ID" };
      }
      
      // Get lead data
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", args.lead_id)
        .eq("organization_id", userOrgId)
        .single();
      
      if (leadError || !lead) {
        return { success: false, error: "Lead hittades inte" };
      }
      
      // Get user profile for signature context
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      // Analyze website if available
      let websiteAnalysis: any = null;
      let websiteContent = "";
      
      if (lead.website) {
        const firecrawlApiKey = Deno.env.get("FIRECRAWL_API_KEY");
        
        let url = lead.website.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `https://${url}`;
        }
        
        // Try to scrape website
        if (firecrawlApiKey) {
          try {
            const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${firecrawlApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url,
                formats: ["markdown"],
                onlyMainContent: true,
              }),
            });
            
            if (scrapeRes.ok) {
              const scrapeData = await scrapeRes.json();
              websiteContent = (scrapeData.data?.markdown || "").substring(0, 2000);
            }
          } catch (e) {
            console.log("Scrape error:", e);
          }
        }
        
        // Get PageSpeed scores
        try {
          const psUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&category=PERFORMANCE&category=SEO&strategy=mobile`;
          const psRes = await fetch(psUrl);
          const psData = await psRes.json();
          
          if (psData.lighthouseResult?.categories) {
            const cats = psData.lighthouseResult.categories;
            websiteAnalysis = {
              performanceScore: Math.round((cats.performance?.score || 0) * 100),
              seoScore: Math.round((cats.seo?.score || 0) * 100),
            };
          }
        } catch (e) {
          // Ignore
        }
      }
      
      // Build AI prompt for email generation
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        return { success: false, error: "AI-nyckel saknas" };
      }
      
      const toneInstructions: Record<string, string> = {
        standard: "Balanserad och professionell ton. Vänlig men saklig.",
        familiar: "Varm och personlig ton. Känns som från en bekant.",
        informative: "Faktabaserad och pedagogisk. Fokus på insikter.",
        direct: "Kort och koncis. Max 80 ord. Rakt på sak.",
      };
      
      const effectiveTone = args.tone || profile?.outreach_tone || "standard";
      const hasWebsite = !!lead.website;
      
      let emailSystemPrompt: string;
      let emailUserPrompt: string;
      
      if (!hasWebsite) {
        // No website pitch
        emailSystemPrompt = `Du skriver personliga outreach-mail på svenska för en webbbyrå.
TONALITET: ${toneInstructions[effectiveTone] || toneInstructions.standard}

DU KONTAKTAR ETT FÖRETAG SOM SAKNAR HEMSIDA. Målet är att:
- Visa förståelse för att de inte prioriterat hemsida
- Förklara hur en modern hemsida kan hjälpa deras verksamhet
- Vara hjälpsam, inte pushy

REGLER:
- Börja med "Hej" eller "Hej [Namn]"
- Max 150 ord
- Avsluta med öppen fråga
- Inkludera INTE signatur (läggs på automatiskt)
- Svara ENDAST med JSON: {"subject": "...", "body": "...", "strategy": "kort förklaring av din approach"}`;
        
        emailUserPrompt = `Skriv outreach-mail till:
Företag: ${lead.company_name}
${lead.contact_name ? `Kontaktperson: ${lead.contact_name}` : ""}
${args.focus ? `FOKUS: ${args.focus}` : ""}
${args.custom_instructions ? `EXTRA INSTRUKTIONER: ${args.custom_instructions}` : ""}

Företaget SAKNAR hemsida. Pitcha värdet av en professionell webbplats.`;
      } else {
        // Has website - analysis-based pitch
        emailSystemPrompt = `Du skriver personliga outreach-mail på svenska för en webbbyrå.
TONALITET: ${toneInstructions[effectiveTone] || toneInstructions.standard}

Du har analyserat företagets hemsida och kan referera till specifika saker.

REGLER:
- Börja med "Hej" eller "Hej [Namn]"  
- Referera till något SPECIFIKT från deras sida
- Föreslå förbättringar inom SEO, prestanda eller design
- Max 150 ord
- Avsluta med öppen fråga
- Inkludera INTE signatur
- Svara ENDAST med JSON: {"subject": "...", "body": "...", "strategy": "kort förklaring av din approach"}`;
        
        emailUserPrompt = `Skriv outreach-mail till:
Företag: ${lead.company_name}
Hemsida: ${lead.website}
${lead.contact_name ? `Kontaktperson: ${lead.contact_name}` : ""}
${args.focus ? `FOKUS: ${args.focus}` : ""}
${args.custom_instructions ? `EXTRA INSTRUKTIONER: ${args.custom_instructions}` : ""}

${websiteAnalysis ? `
ANALYS:
- Prestanda: ${websiteAnalysis.performanceScore}/100
- SEO: ${websiteAnalysis.seoScore}/100
` : ""}

${websiteContent ? `
INNEHÅLL FRÅN HEMSIDAN:
${websiteContent}
` : ""}`;
      }
      
      // Call AI to generate email
      const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: emailSystemPrompt },
            { role: "user", content: emailUserPrompt },
          ],
        }),
      });
      
      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("AI error:", aiRes.status, errText);
        return { success: false, error: "Kunde inte generera mail" };
      }
      
      const aiData = await aiRes.json();
      const content = aiData.choices?.[0]?.message?.content;
      
      if (!content) {
        return { success: false, error: "Inget svar från AI" };
      }
      
      // Parse JSON response
      let emailDraft: { subject: string; body: string; strategy: string };
      try {
        const jsonMatch = content.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
        if (jsonMatch) {
          emailDraft = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON");
        }
      } catch {
        emailDraft = {
          subject: `${lead.company_name} - förslag`,
          body: content.replace(/```json|```/g, "").trim(),
          strategy: "Generellt outreach-mail",
        };
      }
      
      return {
        success: true,
        draft: {
          subject: emailDraft.subject,
          body: emailDraft.body,
          strategy: emailDraft.strategy || "Smart outreach baserat på tillgänglig data",
        },
        lead: {
          id: lead.id,
          company_name: lead.company_name,
          email: lead.email,
          contact_name: lead.contact_name,
          has_website: hasWebsite,
        },
        analysis: websiteAnalysis,
        tone: effectiveTone,
      };
    }
    
    case "send_outreach_email": {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!args.lead_id || !uuidRegex.test(args.lead_id)) {
        return { success: false, error: "Ogiltigt lead-ID" };
      }
      
      // Get lead
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", args.lead_id)
        .eq("organization_id", userOrgId)
        .single();
      
      if (leadError || !lead) {
        return { success: false, error: "Lead hittades inte" };
      }
      
      if (!lead.email) {
        return { success: false, error: `${lead.company_name} har ingen e-postadress registrerad. Lägg till e-post för leaden först.` };
      }
      
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      // Create sent_emails record
      const { data: sentEmailRecord, error: insertError } = await supabase
        .from("sent_emails")
        .insert({
          lead_id: lead.id,
          sent_by: userId,
          recipient_email: lead.email,
          recipient_name: lead.contact_name,
          subject: args.subject,
          body: args.body,
          source: "ai_agent",
        })
        .select("id")
        .single();
      
      if (insertError) {
        console.error("Insert error:", insertError);
        return { success: false, error: "Kunde inte registrera mailet" };
      }
      
      // Build HTML email
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      let html = args.body.replace(/\n/g, "<br>");
      
      // Add signature
      if (profile?.email_signature) {
        html += `<br><br>${profile.email_signature.replace(/\n/g, "<br>")}`;
      }
      if (profile?.email_footer) {
        html += `<br><br>${profile.email_footer.replace(/\n/g, "<br>")}`;
      }
      
      // Add logo
      if (profile?.company_logo_url) {
        const img = `<img src="${profile.company_logo_url}" alt="${profile.company_name || "Logo"}" style="max-height:48px;max-width:200px;object-fit:contain;display:block;margin-top:12px;" />`;
        html += profile.company_website
          ? `<br><a href="${profile.company_website}" target="_blank">${img}</a>`
          : `<br>${img}`;
      }
      
      // Add tracking pixel
      if (sentEmailRecord?.id) {
        html += `<img src="${supabaseUrl}/functions/v1/track-email-open?id=${sentEmailRecord.id}" width="1" height="1" style="display:none;" alt="" />`;
      }
      
      // Send via Resend
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (!RESEND_API_KEY) {
        return { success: false, error: "RESEND_API_KEY saknas" };
      }
      
      const fromEmail = "mail@coflow.se";
      const fromName = profile?.sender_display_name || profile?.full_name || profile?.company_name || "CoFlow";
      
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [lead.email],
          subject: args.subject,
          html,
          text: args.body,
          reply_to: fromEmail,
        }),
      });
      
      const resendText = await resendRes.text();
      
      if (!resendRes.ok) {
        console.error("Resend error:", resendRes.status, resendText);
        return { success: false, error: `Kunde inte skicka mail: ${resendText}` };
      }
      
      // Update sent_emails with Resend ID
      try {
        const resendData = JSON.parse(resendText);
        if (resendData.id) {
          await supabase
            .from("sent_emails")
            .update({ resend_email_id: resendData.id })
            .eq("id", sentEmailRecord.id);
        }
      } catch {
        // Ignore
      }
      
      return {
        success: true,
        message: `Mail skickat till ${lead.email}`,
        lead: {
          id: lead.id,
          company_name: lead.company_name,
          email: lead.email,
        },
        emailId: sentEmailRecord.id,
      };
    }
    
    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}
