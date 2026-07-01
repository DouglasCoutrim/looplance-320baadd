// _lib/supabaseAdmin.server.ts
//
// Cliente Supabase com SERVICE ROLE. Só pode ser importado dentro de
// handlers server-side (server routes), NUNCA em componentes/rotas do
// client, conforme checklist de segurança da spec (seção 11).
//
// Uso:
//   const { supabaseAdmin } = await import('~/lib/supabaseAdmin.server')
// (import dinâmico dentro do handler para garantir que o bundler nunca
// inclua isso no bundle do cliente)

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente do servidor')
  }

  _client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _client
}
