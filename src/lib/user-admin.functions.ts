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
        p_arena_id: data.arena_id ?? undefined,
        p_client_id: data.client_id ?? undefined,
      });
      return { ok: true, reused: true, user_id: existing.id };
    }

    const newId = invited.user?.id;
    if (newId) {
      await supabaseAdmin.rpc("admin_assign_role", {
        p_user_id: newId,
        p_role: data.role,
        p_arena_id: data.arena_id ?? undefined,
        p_client_id: data.client_id ?? undefined,
      });
    }

    return { ok: true, user_id: newId };
  });

// ─── Register arena user (via QR code) ─────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1).max(200),
  cpf: z.string().length(11),
  arena_id: z.string().uuid(),
});

export const registerArenaUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cria usuário no auth.users com senha (sem email de confirmação)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        cpf: data.cpf,
      },
    });

    if (createErr) {
      throw new Response(createErr.message, { status: 400 });
    }

    const newId = created.user?.id;
    if (!newId) {
      throw new Response("Falha ao criar usuário", { status: 500 });
    }

    // Atribui role arena_user diretamente (service role bypassa RLS)
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newId,
        role: "arena_user",
        arena_id: data.arena_id,
      });

    if (roleErr) {
      throw new Response(roleErr.message, { status: 500 });
    }

    // Atualiza arena_id no profile
    await supabaseAdmin
      .from("profiles")
      .update({ arena_id: data.arena_id })
      .eq("id", newId);

    return { ok: true, user_id: newId };
  });

// ─── Create arena admin (super admin cria admin de arena com senha) ────────

const createArenaAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1).max(200),
  arena_id: z.string().uuid(),
});

export const createArenaAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createArenaAdminSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Só super_admin pode criar admin de arena
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    if (!isSuper) {
      throw new Response("forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cria usuário no auth.users com senha
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
      },
    });

    if (createErr) {
      throw new Response(createErr.message, { status: 400 });
    }

    const newId = created.user?.id;
    if (!newId) {
      throw new Response("Falha ao criar usuário", { status: 500 });
    }

    // Atribui role arena_owner diretamente (service role bypassa RLS)
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newId,
        role: "arena_owner",
        arena_id: data.arena_id,
      });

    if (roleErr) {
      throw new Response(roleErr.message, { status: 500 });
    }

    // Atualiza arena_id no profile
    await supabaseAdmin
      .from("profiles")
      .update({ arena_id: data.arena_id })
      .eq("id", newId);

    return { ok: true, user_id: newId };
  });
