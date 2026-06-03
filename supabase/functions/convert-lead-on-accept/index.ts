import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { quoteId } = await req.json();
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "Missing quoteId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch quote with lead
    const { data: quote, error: qErr } = await supabaseAdmin
      .from("quotes")
      .select("id, lead_id, recipient_name, recipient_email, organization_id, created_by")
      .eq("id", quoteId)
      .eq("status", "accepted")
      .maybeSingle();

    if (qErr || !quote || !quote.lead_id) {
      return new Response(JSON.stringify({ converted: false, reason: "No linked lead or not accepted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch lead
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", quote.lead_id)
      .maybeSingle();

    if (!lead || lead.converted_to_customer_id) {
      return new Response(JSON.stringify({ converted: false, reason: "Lead already converted or not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create customer
    const { data: newCustomer, error: custErr } = await supabaseAdmin
      .from("customers")
      .insert({
        company_name: lead.company_name || quote.recipient_name || "Okänt företag",
        contact_name: lead.contact_name || quote.recipient_name || null,
        email: lead.email || quote.recipient_email || null,
        phone: lead.phone || null,
        website: lead.website || null,
        organization_id: lead.organization_id,
        created_by: lead.created_by || quote.created_by,
        status: "active",
      })
      .select("id")
      .single();

    if (custErr || !newCustomer) {
      console.error("Failed to create customer:", custErr);
      return new Response(JSON.stringify({ converted: false, error: custErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark lead as converted
    await supabaseAdmin
      .from("leads")
      .update({ converted_to_customer_id: newCustomer.id })
      .eq("id", quote.lead_id);

    // Link quote to customer
    await supabaseAdmin
      .from("quotes")
      .update({ customer_id: newCustomer.id })
      .eq("id", quoteId);

    return new Response(JSON.stringify({ converted: true, customerId: newCustomer.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
