import { createFileRoute } from "@tanstack/react-router";

// Embute todos os arquivos do agent no bundle em build-time.
// Ao alterar qualquer arquivo em backend/edge-agent/, o bundle novo
// é publicado e o updater no edge sincroniza automaticamente.
const rawFiles = import.meta.glob("/backend/edge-agent/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Extensões binárias que não deveríamos servir como texto (nenhuma hoje,
// mas guardamos a lista para não quebrar no futuro).
const EXCLUDED = new Set<string>([]);

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type EdgeAgentManifest = {
  version: string;
  generated_at: string;
  files: { path: string; sha256: string; size: number }[];
};

export async function buildManifest(): Promise<EdgeAgentManifest> {
  const prefix = "/backend/edge-agent/";
  const entries: EdgeAgentManifest["files"] = [];
  const paths = Object.keys(rawFiles).sort();

  for (const p of paths) {
    if (!p.startsWith(prefix)) continue;
    const rel = p.slice(prefix.length);
    if (EXCLUDED.has(rel)) continue;
    // Nunca servir install.sh via updater — o updater não deve se auto-instalar
    if (rel === "install.sh") continue;
    // Nunca servir bytecode / caches — quebra sha256 (binário lido como texto)
    if (rel.includes("__pycache__") || rel.endsWith(".pyc")) continue;
    const content = rawFiles[p];
    if (typeof content !== "string") continue;
    entries.push({
      path: rel,
      sha256: await sha256Hex(content),
      size: new TextEncoder().encode(content).length,
    });
  }

  const version = await sha256Hex(
    entries.map((e) => `${e.path}:${e.sha256}`).join("\n"),
  );
  return {
    version: version.slice(0, 12),
    generated_at: new Date().toISOString(),
    files: entries,
  };
}

export function getRawFile(rel: string): string | null {
  const key = `/backend/edge-agent/${rel}`;
  const content = rawFiles[key];
  return typeof content === "string" ? content : null;
}

export const Route = createFileRoute("/api/public/edge-agent/manifest")({
  server: {
    handlers: {
      GET: async () => {
        const manifest = await buildManifest();
        return new Response(JSON.stringify(manifest, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
