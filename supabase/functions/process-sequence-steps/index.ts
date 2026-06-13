import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Endast cron/server får trigga: kräver service-role-token eller konfigurerad cron-hemlighet
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const cronHeader = req.headers.get("x-cron-secret");
    const authorized = token === supabaseKey || (!!cronSecret && cronHeader === cronSecret);
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing sequence steps...");

    // Find all active lead sequences with due steps
    const now = new Date().toISOString();
    const { data: dueSequences, error: queryError } = await supabase
      .from("lead_sequences")
      .select(`
        *,
        sequence:outreach_sequences(*),
        lead:leads(*)
      `)
      .eq("status", "active")
      .lte("next_step_at", now);

    if (queryError) {
      throw queryError;
    }

    console.log(`Found ${dueSequences?.length || 0} sequences to process`);

    // Also process approved emails that are ready to be sent
    const { data: approvedEmails, error: approvedError } = await supabase
      .from("sequence_step_executions")
      .select(`
        *,
        lead_sequence:lead_sequences(*, lead:leads(*), sequence:outreach_sequences(*)),
        step:sequence_steps(*)
      `)
      .eq("status", "approved");

    if (!approvedError && approvedEmails && approvedEmails.length > 0) {
      console.log(`Found ${approvedEmails.length} approved emails to send`);
      
      for (const execution of approvedEmails) {
        try {
          // Send the approved email
          const response = await fetch(`${supabaseUrl}/functions/v1/send-sequence-email`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              leadSequenceId: execution.lead_sequence_id,
              stepId: execution.step_id,
              executionId: execution.id,
              preApproved: true,
              approvedSubject: execution.generated_subject,
              approvedBody: execution.generated_body,
            }),
          });

          if (!response.ok) {
            console.error(`Failed to send approved email ${execution.id}`);
          } else {
            console.log(`Sent approved email ${execution.id}`);
          }
        } catch (err) {
          console.error(`Error sending approved email ${execution.id}:`, err);
        }
      }
    }

    const results = [];

    for (const leadSequence of dueSequences || []) {
      try {
        // Get the current step
        const { data: currentStep, error: stepError } = await supabase
          .from("sequence_steps")
          .select("*")
          .eq("sequence_id", leadSequence.sequence_id)
          .eq("step_order", leadSequence.current_step + 1)
          .single();

        if (stepError || !currentStep) {
          console.log(`No step found for sequence ${leadSequence.id}, marking as completed`);
          await supabase
            .from("lead_sequences")
            .update({
              status: "completed",
              completed_at: now,
              next_step_at: null,
            })
            .eq("id", leadSequence.id);
          
          // Send notification for sequence completion
          if (leadSequence.created_by) {
            const lead = leadSequence.lead;
            await supabase.from("notifications").insert({
              user_id: leadSequence.created_by,
              type: "sequence_completed",
              title: "Sekvens slutförd",
              message: `Sekvensen "${leadSequence.sequence?.name}" för ${lead?.company_name || lead?.contact_name || 'lead'} är nu klar`,
              link: lead?.id ? `/leads/${lead.id}` : "/outreach",
              metadata: {
                sequence_id: leadSequence.sequence_id,
                sequence_name: leadSequence.sequence?.name,
                lead_id: lead?.id,
              },
            });
            console.log(`Sequence completion notification sent to user ${leadSequence.created_by}`);
          }
          continue;
        }

        // Check if execution already exists
        const { data: existingExecution } = await supabase
          .from("sequence_step_executions")
          .select("*")
          .eq("lead_sequence_id", leadSequence.id)
          .eq("step_id", currentStep.id)
          .single();

        // Skip if already pending approval or approved
        if (existingExecution && 
            (existingExecution.status === "needs_approval" || 
             existingExecution.status === "approved")) {
          console.log(`Execution ${existingExecution.id} is waiting for approval, skipping`);
          continue;
        }

        let executionId = existingExecution?.id;

        if (!existingExecution) {
          // Create execution record
          const { data: newExecution, error: execError } = await supabase
            .from("sequence_step_executions")
            .insert({
              lead_sequence_id: leadSequence.id,
              step_id: currentStep.id,
              status: "pending",
              scheduled_at: leadSequence.next_step_at,
            })
            .select()
            .single();

          if (execError) {
            console.error(`Failed to create execution for ${leadSequence.id}:`, execError);
            continue;
          }
          executionId = newExecution.id;
        }

        if (currentStep.step_type === "email") {
          // Check if sequence requires approval
          const requiresApproval = leadSequence.sequence?.require_approval !== false;

          if (requiresApproval) {
            // Generate email content but don't send - wait for approval
            const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
            if (!GEMINI_API_KEY) {
              console.error("GEMINI_API_KEY not configured");
              continue;
            }

            const lead = leadSequence.lead;
            
            // Get web analyses for context
            const { data: analyses } = await supabase
              .from("web_analyses")
              .select("*")
              .eq("lead_id", lead.id)
              .order("created_at", { ascending: false })
              .limit(1);

            const analysis = analyses?.[0];

            // Get user profile for signature
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", leadSequence.created_by)
              .single();

            // Build context for AI
            const leadContext = `
Företag: ${lead.company_name || "Okänt"}
Kontaktperson: ${lead.contact_name || "Okänd"}
E-post: ${lead.email}
Hemsida: ${lead.website || "Saknas"}
`;

            const analysisContext = analysis ? `
Webbanalys resultat:
- Performance: ${analysis.performance_score ?? "Ej analyserat"}/100
- SEO: ${analysis.seo_score ?? "Ej analyserat"}/100
- Tillgänglighet: ${analysis.accessibility_score ?? "Ej analyserat"}/100
- Best Practices: ${analysis.best_practices_score ?? "Ej analyserat"}/100
` : "Ingen webbanalys genomförd ännu.";

            // Determine sequence market for language + tone
            const market: "SE" | "US" | "DE" =
              (leadSequence.sequence?.market as "SE" | "US" | "DE") || "SE";

            // Heuristic: skip a Swedish saved signature when sending in English/German
            const sigText = (profile?.email_signature || "").toLowerCase();
            const sigLooksSwedish =
              sigText.includes("med vänlig") ||
              sigText.includes("vänliga hälsningar") ||
              sigText.includes("mvh") ||
              sigText.includes("hälsningar");
            const useSavedSignature =
              !!profile?.email_signature && (market === "SE" || !sigLooksSwedish);

            const signatureContext = profile ? `
Sender:
- Name: ${profile.full_name || ""}
- Company: ${profile.company_name || ""}
${useSavedSignature ? `Saved signature (in ${market === "SE" ? "Swedish" : market === "US" ? "English" : "German"}, may be appended verbatim): ${profile.email_signature}` : "(No localized signature available — close the body without a signature; one will be appended automatically.)"}
` : "";

            const systemPromptByMarket: Record<"SE" | "US" | "DE", string> = {
              SE: `Du är en professionell säljare som skriver personliga outreach-mail på svenska.
Dina mail ska vara:
- Korta och koncisa (max 150 ord)
- Personliga baserade på mottagarens företag och situation
- Professionella men vänskapliga
- Fokuserade på värde för mottagaren
- Utan klyschor och säljspråk

${signatureContext}`,
              US: `You are a professional sales rep writing personalized outreach emails in American English.
Your emails should be:
- Short and concise (max 150 words)
- Personal, based on the recipient's company and situation
- Professional but friendly
- Focused on value for the recipient
- Free of clichés and salesy language

${signatureContext}`,
              DE: `Sie sind ein professioneller Vertriebsmitarbeiter und schreiben personalisierte Outreach-E-Mails auf Deutsch.
Ihre E-Mails sollen:
- Kurz und prägnant sein (max. 150 Wörter)
- Persönlich auf das Unternehmen und die Situation des Empfängers eingehen
- Professionell, aber freundlich klingen
- Den Mehrwert für den Empfänger in den Mittelpunkt stellen
- Ohne Floskeln und reine Verkaufssprache auskommen
- 'Sie' als Anrede verwenden

${signatureContext}`,
            };

            const systemPrompt = systemPromptByMarket[market];

            // Get total steps
            const { count: totalSteps } = await supabase
              .from("sequence_steps")
              .select("*", { count: "exact", head: true })
              .eq("sequence_id", leadSequence.sequence_id);

            const stepNumber = currentStep.step_order;

            const userPromptByMarket: Record<"SE" | "US" | "DE", string> = {
              SE: `Detta är mail ${stepNumber} av ${totalSteps} i en outreach-sekvens.

${stepNumber === 1 ? "Detta är första kontakten - presentera dig och ditt erbjudande baserat på deras behov." :
  stepNumber === totalSteps ? "Detta är sista mailet i sekvensen - gör ett sista försök att få kontakt." :
  "Detta är en uppföljning - referera till tidigare kontaktförsök och tillför nytt värde."}

${currentStep.email_prompt ? `Extra instruktioner: ${currentStep.email_prompt}` : ""}

Leadinformation:
${leadContext}

${analysisContext}

Generera ett mail med ämnesrad och brödtext. Formatera svaret som JSON:
{"subject": "Ämnesrad här", "body": "Mailtext här"}`,
              US: `This is email ${stepNumber} of ${totalSteps} in an outreach sequence.

${stepNumber === 1 ? "This is the first contact — introduce yourself and your offer based on their needs." :
  stepNumber === totalSteps ? "This is the final email in the sequence — make one last attempt to connect." :
  "This is a follow-up — reference previous contact attempts and add new value."}

${currentStep.email_prompt ? `Extra instructions: ${currentStep.email_prompt}` : ""}

Lead information:
${leadContext}

${analysisContext}

Generate an email with a subject line and body. Format the response as JSON:
{"subject": "Subject line here", "body": "Email body here"}`,
              DE: `Dies ist E-Mail ${stepNumber} von ${totalSteps} in einer Outreach-Sequenz.

${stepNumber === 1 ? "Dies ist der Erstkontakt — stellen Sie sich und Ihr Angebot anhand des Bedarfs vor." :
  stepNumber === totalSteps ? "Dies ist die letzte E-Mail der Sequenz — unternehmen Sie einen letzten Kontaktversuch." :
  "Dies ist ein Follow-up — beziehen Sie sich auf frühere Kontaktversuche und liefern Sie neuen Mehrwert."}

${currentStep.email_prompt ? `Zusätzliche Anweisungen: ${currentStep.email_prompt}` : ""}

Lead-Informationen:
${leadContext}

${analysisContext}

Generieren Sie eine E-Mail mit Betreffzeile und Text. Antworten Sie als JSON:
{"subject": "Betreff hier", "body": "E-Mail-Text hier"}`,
            };

            const emailContext = userPromptByMarket[market];

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
                  { role: "user", content: emailContext },
                ],
              }),
            });

            if (!aiResponse.ok) {
              console.error("AI gateway error:", aiResponse.status);
              continue;
            }

            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content;

            let emailContent;
            try {
              const jsonMatch = content?.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
              if (jsonMatch) {
                emailContent = JSON.parse(jsonMatch[0]);
              } else {
                throw new Error("No JSON found");
              }
            } catch {
              emailContent = {
                subject: `Angående ${lead.company_name || "ert företag"}`,
                body: content || "Kunde inte generera innehåll",
              };
            }

            // Append signature — localized for the sequence's market.
            // Skip a Swedish saved signature when sending in English/German.
            const closingByMarket: Record<"SE" | "US" | "DE", string> = {
              SE: "Med vänlig hälsning,",
              US: "Best regards,",
              DE: "Mit freundlichen Grüßen,",
            };
            if (useSavedSignature) {
              emailContent.body += `\n\n${profile!.email_signature}`;
            } else {
              const senderName = profile?.full_name || profile?.company_name || "";
              emailContent.body += `\n\n${closingByMarket[market]}\n${senderName}`.trimEnd();
            }
            const footerText = (profile?.email_footer || "").toLowerCase();
            const footerLooksSwedish =
              footerText.includes("med vänlig") ||
              footerText.includes("vänliga hälsningar") ||
              footerText.includes("mvh") ||
              footerText.includes("hälsningar");
            if (profile?.email_footer && (market === "SE" || !footerLooksSwedish)) {
              emailContent.body += `\n\n${profile.email_footer}`;
            }

            // Update execution with generated content and set to needs_approval
            await supabase
              .from("sequence_step_executions")
              .update({
                status: "needs_approval",
                generated_subject: emailContent.subject,
                generated_body: emailContent.body,
              })
              .eq("id", executionId);

            // Send notification that email needs approval
            if (leadSequence.created_by) {
              const lead = leadSequence.lead;
              await supabase.from("notifications").insert({
                user_id: leadSequence.created_by,
                type: "email_needs_approval",
                title: "Mail väntar på godkännande",
                message: `Ett mail i "${leadSequence.sequence?.name}" för ${lead?.company_name || lead?.contact_name || 'lead'} behöver godkännas`,
                link: "/outreach",
                metadata: {
                  sequence_id: leadSequence.sequence_id,
                  sequence_name: leadSequence.sequence?.name,
                  lead_id: lead?.id,
                  execution_id: executionId,
                },
              });
              console.log(`Approval needed notification sent to user ${leadSequence.created_by}`);
            }

            console.log(`Email generated for ${leadSequence.id}, waiting for approval`);
            results.push({ 
              leadSequenceId: leadSequence.id, 
              success: true, 
              status: "needs_approval" 
            });
          } else {
            // No approval needed - send directly
            const response = await fetch(`${supabaseUrl}/functions/v1/send-sequence-email`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                leadSequenceId: leadSequence.id,
                stepId: currentStep.id,
                executionId: executionId,
              }),
            });

            const result = await response.json();
            
            if (!response.ok) {
              console.error(`Failed to send email for ${leadSequence.id}:`, result);
              results.push({ 
                leadSequenceId: leadSequence.id, 
                success: false, 
                error: result.error 
              });
            } else {
              console.log(`Email sent for ${leadSequence.id}`);
              results.push({ 
                leadSequenceId: leadSequence.id, 
                success: true, 
                emailId: result.emailId 
              });
            }
          }
        } else if (currentStep.step_type === "task") {
          // Create a scheduled task in the tasks table
          const lead = leadSequence.lead;
          
          // Calculate due date based on delay (task should be done today since we're processing it now)
          const dueDate = new Date();
          dueDate.setHours(17, 0, 0, 0); // Set due time to 5 PM same day
          
          // Create a proper task entry with lead_id for direct linking
          const { error: taskError } = await supabase.from("tasks").insert({
            title: currentStep.task_title || "Uppföljningsuppgift",
            description: currentStep.task_description || `Uppgift från sekvens "${leadSequence.sequence?.name}" för ${lead.company_name || lead.contact_name || 'lead'}`,
            status: "todo",
            priority: "medium",
            due_date: dueDate.toISOString(),
            assigned_to: leadSequence.created_by,
            created_by: leadSequence.created_by,
            lead_id: lead.id,
          });

          if (taskError) {
            console.error(`Failed to create task for ${leadSequence.id}:`, taskError);
          } else {
            console.log(`Created task for lead ${lead.id}: ${currentStep.task_title}`);
          }
          
          // Also create an activity record for the lead timeline
          await supabase.from("activities").insert({
            lead_id: lead.id,
            type: "note",
            title: `Uppgift skapad: ${currentStep.task_title || "Uppföljning"}`,
            description: `En uppgift har schemalagts från sekvens "${leadSequence.sequence?.name}"`,
            user_id: leadSequence.created_by,
          });

          // Update execution
          await supabase
            .from("sequence_step_executions")
            .update({
              status: "completed",
              executed_at: now,
            })
            .eq("id", executionId);

          // Move to next step
          const nextStepOrder = currentStep.step_order + 1;
          const { data: nextStep } = await supabase
            .from("sequence_steps")
            .select("*")
            .eq("sequence_id", leadSequence.sequence_id)
            .eq("step_order", nextStepOrder)
            .single();

          if (nextStep) {
            const nextStepAt = new Date();
            nextStepAt.setDate(nextStepAt.getDate() + (nextStep.delay_days || 0));

            await supabase
              .from("lead_sequences")
              .update({
                current_step: nextStepOrder,
                next_step_at: nextStepAt.toISOString(),
              })
              .eq("id", leadSequence.id);
          } else {
            await supabase
              .from("lead_sequences")
              .update({
                status: "completed",
                completed_at: now,
                next_step_at: null,
              })
              .eq("id", leadSequence.id);
            
            // Send notification for sequence completion
            if (leadSequence.created_by) {
              const lead = leadSequence.lead;
              await supabase.from("notifications").insert({
                user_id: leadSequence.created_by,
                type: "sequence_completed",
                title: "Sekvens slutförd",
                message: `Sekvensen "${leadSequence.sequence?.name}" för ${lead?.company_name || lead?.contact_name || 'lead'} är nu klar`,
                link: lead?.id ? `/leads/${lead.id}` : "/outreach",
                metadata: {
                  sequence_id: leadSequence.sequence_id,
                  sequence_name: leadSequence.sequence?.name,
                  lead_id: lead?.id,
                },
              });
              console.log(`Sequence completion notification sent to user ${leadSequence.created_by}`);
            }
          }

          results.push({ 
            leadSequenceId: leadSequence.id, 
            success: true, 
            type: "task" 
          });
        }
      } catch (stepError) {
        console.error(`Error processing sequence ${leadSequence.id}:`, stepError);
        results.push({ 
          leadSequenceId: leadSequence.id, 
          success: false, 
          error: stepError instanceof Error ? stepError.message : "Unknown error" 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: dueSequences?.length || 0,
        results 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing sequences:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
