import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deleteSchema = z.object({ replay_id: z.string().uuid() });

export const deleteReplay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Autoriza: super_admin OU arena_owner da arena do replay
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: replay, error: fetchErr } = await supabaseAdmin
      .from("replays")
      .select("id, r2_key, arena_id")
      .eq("id", data.replay_id)
      .maybeSingle();

    if (fetchErr) throw new Response(fetchErr.message, { status: 500 });
    if (!replay) throw new Response("not_found", { status: 404 });

    if (!isSuper) {
      if (!replay.arena_id) throw new Response("forbidden", { status: 403 });
      const { data: owns } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "arena_owner")
        .eq("arena_id", replay.arena_id)
        .maybeSingle();
      if (!owns) throw new Response("forbidden", { status: 403 });
    }

    // Apaga do R2
    let r2Status: string = "skipped";
    if (replay.r2_key) {
      try {
        const { deleteR2Object } = await import("@/lib/r2.server");
        const res = await deleteR2Object(replay.r2_key);
        r2Status = res.ok ? "deleted" : `r2_error_${res.status}`;
      } catch (err) {
        r2Status = `r2_exception: ${(err as Error).message}`;
      }
      await supabaseAdmin.from("r2_deletion_logs").insert({
        replay_id: replay.id,
        r2_key: replay.r2_key,
        status: r2Status,
      });
    }

    const { error: delErr } = await supabaseAdmin
      .from("replays")
      .delete()
      .eq("id", replay.id);
    if (delErr) throw new Response(delErr.message, { status: 500 });

    return { ok: true, r2Status };
  });

const bulkSchema = z.object({ replay_ids: z.array(z.string().uuid()).min(1).max(500) });

export const deleteReplaysBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bulkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deleteR2Object } = await import("@/lib/r2.server");

    const { data: replays, error: fetchErr } = await supabaseAdmin
      .from("replays")
      .select("id, r2_key, arena_id")
      .in("id", data.replay_ids);
    if (fetchErr) throw new Response(fetchErr.message, { status: 500 });

    let ownedArenaIds: Set<string> | null = null;
    if (!isSuper) {
      const { data: owns } = await supabase
        .from("user_roles")
        .select("arena_id")
        .eq("user_id", userId)
        .eq("role", "arena_owner");
      ownedArenaIds = new Set(
        ((owns ?? []).map((r) => r.arena_id).filter(Boolean)) as string[]
      );
    }

    let deleted = 0;
    let failed = 0;
    for (const replay of replays ?? []) {
      if (!isSuper && (!replay.arena_id || !ownedArenaIds!.has(replay.arena_id))) {
        failed++;
        continue;
      }
      let r2Status = "skipped";
      if (replay.r2_key) {
        try {
          const res = await deleteR2Object(replay.r2_key);
          r2Status = res.ok ? "deleted" : `r2_error_${res.status}`;
        } catch (err) {
          r2Status = `r2_exception: ${(err as Error).message}`;
        }
        await supabaseAdmin.from("r2_deletion_logs").insert({
          replay_id: replay.id,
          r2_key: replay.r2_key,
          status: r2Status,
        });
      }
      const { error: delErr } = await supabaseAdmin
        .from("replays")
        .delete()
        .eq("id", replay.id);
      if (delErr) failed++;
      else deleted++;
    }
    return { ok: true, deleted, failed };
  });
