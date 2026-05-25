import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("leaderboard")
        .select("user_id, stage, prestige_cores, monsters_defeated, updated_at")
        .order("stage", { ascending: false })
        .order("prestige_cores", { ascending: false })
        .limit(10);

      if (error) throw error;

      const ranked = (data ?? []).map((row: any, i: number) => ({
        rank: i + 1,
        userId: row.user_id,
        stage: row.stage,
        cores: row.prestige_cores,
        defeated: row.monsters_defeated,
        updatedAt: row.updated_at,
        isMe: row.user_id === user.id,
      }));

      const myRow = await supabase
        .from("leaderboard")
        .select("stage, prestige_cores, monsters_defeated")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({ topPlayers: ranked, myScore: myRow.data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { stage, prestige_cores, monsters_defeated } = body;

      if (
        typeof stage !== "number" ||
        typeof prestige_cores !== "number" ||
        typeof monsters_defeated !== "number"
      ) {
        return new Response(JSON.stringify({ error: "Invalid payload" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("leaderboard").upsert(
        {
          user_id: user.id,
          stage,
          prestige_cores,
          monsters_defeated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
