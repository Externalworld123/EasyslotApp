import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify super_admin
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "change_role") {
      const { target_user_id, new_role, center_id } = body;

      // Safety: don't remove last super_admin
      if (new_role !== "super_admin") {
        const { data: superAdmins } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");
        const isSelf = superAdmins?.length === 1 && superAdmins[0].user_id === target_user_id;
        if (isSelf) {
          return new Response(JSON.stringify({ error: "Cannot remove the last super_admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Delete existing roles for user
      await adminClient.from("user_roles").delete().eq("user_id", target_user_id);

      // Insert new role
      const { error: insertErr } = await adminClient.from("user_roles").insert({
        user_id: target_user_id,
        role: new_role,
        center_id: new_role === "super_admin" ? null : (center_id || null),
      });
      if (insertErr) throw insertErr;

      // Update profile center_id
      if (center_id && new_role !== "super_admin") {
        await adminClient.from("profiles").update({ center_id }).eq("id", target_user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "assign_center") {
      const { target_user_id, center_id } = body;

      await adminClient
        .from("user_roles")
        .update({ center_id })
        .eq("user_id", target_user_id);

      await adminClient
        .from("profiles")
        .update({ center_id })
        .eq("id", target_user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_active") {
      const { target_user_id, is_active } = body;

      // Don't deactivate last super_admin
      if (!is_active) {
        const { data: superAdmins } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin");
        const targetIsSuperAdmin = superAdmins?.some((r: any) => r.user_id === target_user_id);
        if (targetIsSuperAdmin && superAdmins?.length === 1) {
          return new Response(JSON.stringify({ error: "Cannot deactivate the last super_admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      await adminClient.from("profiles").update({ is_active }).eq("id", target_user_id);

      // Ban/unban in auth
      await adminClient.auth.admin.updateUserById(target_user_id, {
        ban_duration: is_active ? "none" : "876600h",
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add_super_admin_by_email") {
      const { email } = body;

      // Find user by email
      const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const targetUser = authUsers.users.find((u: any) => u.email === email);
      if (!targetUser) {
        return new Response(JSON.stringify({ error: `User with email ${email} not found` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already super_admin
      const { data: existing } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", targetUser.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, message: "Already super_admin" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete existing roles and add super_admin
      await adminClient.from("user_roles").delete().eq("user_id", targetUser.id);
      const { error: insertErr } = await adminClient.from("user_roles").insert({
        user_id: targetUser.id,
        role: "super_admin",
        center_id: null,
      });
      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
