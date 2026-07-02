import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).max(200),
  role: z.enum(["super_admin", "client_owner", "arena_owner", "arena_user"]),
  arena_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
});

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Autoriza: super_admin OU arena_owner (só pode convidar arena_user/arena_owner na arena dele)
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });

    if (!isSuper) {
      if (!["arena_user", "arena_owner"].includes(data.role) || !data.arena_id) {
        throw new Response("forbidden", { status: 403 });
      }
      const { data: owns } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "arena_owner")
        .eq("arena_id", data.arena_id)
        .maybeSingle();
      if (!owns) throw new Response("forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Convida via email (Supabase envia link mágico)
    const { data: invited, error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: {
          full_name: data.full_name,
          invited_role: data.role,
          invited_arena_id: data.arena_id ?? null,
          invited_client_id: data.client_id ?? null,
        },
      }
    );

    if (invErr) {
      // Se o usuário já existe, tenta atribuir a role mesmo assim
      if (!invErr.message.toLowerCase().includes("already")) {
        throw new Response(invErr.message, { status: 400 });
      }
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (!existing) throw new Response(invErr.message, { status: 400 });
      await supabaseAdmin.rpc("admin_assign_role", {
        p_user_id: existing.id,
        p_role: data.role,
        p_arena_id: data.arena_id ?? null,
        p_client_id: data.client_id ?? null,
      });
      return { ok: true, reused: true, user_id: existing.id };
    }

    const newId = invited.user?.id;
    if (newId) {
      await supabaseAdmin.rpc("admin_assign_role", {
        p_user_id: newId,
        p_role: data.role,
        p_arena_id: data.arena_id ?? null,
        p_client_id: data.client_id ?? null,
      });
    }

    return { ok: true, user_id: newId };
  });
