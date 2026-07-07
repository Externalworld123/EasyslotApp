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

    // Verify the caller is super_admin
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

    // Check caller is super_admin
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

    // Fetch all auth users
    const { data: authUsers, error: authErr } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });
    if (authErr) throw authErr;

    // Fetch all profiles
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, phone, is_active, center_id, created_at");

    // Fetch all user_roles
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("id, user_id, role, center_id");

    // Fetch all centers
    const { data: centers } = await adminClient
      .from("centers")
      .select("id, name");

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const centerMap = new Map((centers || []).map((c: any) => [c.id, c.name]));

    // Group roles by user_id
    const roleMap = new Map<string, any[]>();
    for (const r of roles || []) {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r);
    }

    const users = authUsers.users.map((u: any) => {
      const profile = profileMap.get(u.id);
      const userRoles = roleMap.get(u.id) || [];
      const primaryRole = userRoles.length > 0
        ? userRoles.reduce((best: any, cur: any) => {
            const hierarchy: Record<string, number> = {
              super_admin: 5, organization_admin: 4, center_admin: 3, staff: 2, marshal: 1,
            };
            return (hierarchy[cur.role] || 0) > (hierarchy[best.role] || 0) ? cur : best;
          })
        : null;

      return {
        id: u.id,
        email: u.email,
        full_name: profile?.full_name || "",
        phone: profile?.phone || null,
        is_active: profile?.is_active ?? true,
        role: primaryRole?.role || null,
        role_id: primaryRole?.id || null,
        center_id: primaryRole?.center_id || profile?.center_id || null,
        center_name: primaryRole?.center_id ? centerMap.get(primaryRole.center_id) || null : null,
        all_roles: userRoles.map((r: any) => ({
          id: r.id,
          role: r.role,
          center_id: r.center_id,
          center_name: r.center_id ? centerMap.get(r.center_id) || null : null,
        })),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    return new Response(JSON.stringify({ users, centers: centers || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
