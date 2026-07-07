import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Use service role to bypass RLS
    const admin = createClient(supabaseUrl, serviceKey);

    // Check if user already has a center_admin role with a center
    const { data: existingRoles } = await admin
      .from("user_roles")
      .select("id, center_id")
      .eq("user_id", user.id)
      .eq("role", "center_admin")
      .limit(1);

    if (existingRoles && existingRoles.length > 0 && existingRoles[0].center_id) {
      return new Response(
        JSON.stringify({ center_id: existingRoles[0].center_id, role: "center_admin", existing: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { center_name, center_phone, center_email, center_address } = await req.json();
    if (!center_name?.trim()) throw new Error("Center name is required");

    // Create center
    const { data: center, error: centerErr } = await admin
      .from("centers")
      .insert({
        name: center_name.trim(),
        phone: center_phone?.trim() || null,
        email: center_email?.trim() || null,
        address: center_address?.trim() || null,
      })
      .select("id")
      .single();
    if (centerErr) throw centerErr;

    // Assign center_admin role
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: user.id, role: "center_admin", center_id: center.id });
    if (roleErr) throw roleErr;

    // Update profile with center_id
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ center_id: center.id })
      .eq("id", user.id);
    if (profileErr) throw profileErr;

    return new Response(
      JSON.stringify({ center_id: center.id, role: "center_admin" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
