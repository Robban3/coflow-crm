import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callAI, AI_MODELS } from "../_shared/ai.ts";
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
            // Generate email content (but don't send) via the shared Claude
            // outreach module, so sequence emails match the consultative tone
            // of one-off outreach. Awaits approval before sending.
            const lead = leadSequence.lead;

            const { data: analyses } = await supabase
              .from("web_analyses")
              .select("*")
              .eq("lead_id", lead.id)
              .order("created_at", { ascending: false })
              .limit(1);
            const analysis = analyses?.[0];

            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", leadSequence.created_by)
              .single();

            const market: "SE" | "US" | "DE" | "ES" | "UK" | "KR" | "CA" | "AU" | "IE" | "MX" | "AR" =
              (leadSequence.sequence?.market as "SE" | "US" | "DE" | "ES" | "UK" | "KR" | "CA" | "AU" | "IE" | "MX" | "AR") || "SE";

            const { count: totalSteps } = await supabase
              .from("sequence_steps")
              .select("*", { count: "exact", head: true })
              .eq("sequence_id", leadSequence.sequence_id);

            const ctx: OutreachContext = {
              companyName: lead.company_name || undefined,
              contactName: lead.contact_name || undefined,
              tone: profile?.outreach_tone || "standard",
              context: currentStep.step_order === 1 ? "initial" : "follow_up",
              market,
              stepNumber: currentStep.step_order,
              totalSteps: totalSteps || undefined,
              stepPrompt: currentStep.email_prompt || undefined,
              senderName: profile?.full_name || undefined,
              senderCompany: profile?.company_name || undefined,
            };
            if (analysis) {
              ctx.webAnalysis = {
                performanceScore: analysis.performance_score ?? 0,
                seoScore: analysis.seo_score ?? 0,
                accessibilityScore: analysis.accessibility_score ?? 0,
                bestPracticesScore: analysis.best_practices_score ?? 0,
              };
            }

            const aiData = await callAI({
              model: AI_MODELS.claude,
              messages: [
                { role: "system", content: buildOutreachSystemPrompt(ctx) },
                { role: "user", content: buildOutreachUserPrompt(ctx) },
              ],
            });
            const parsed = parseOutreachResponse(
              aiData.choices?.[0]?.message?.content,
              lead.company_name || undefined,
            );
            const emailContent = {
              subject: parsed.subject,
              body: appendSignature(parsed.body_without_signature, profile, market),
            };

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
