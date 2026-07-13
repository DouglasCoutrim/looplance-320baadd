// © 2026 Looplance. All Rights Reserved.
// Developed & Patented by Douglas Coutrim Silva.

import { createFileRoute } from "@tanstack/react-router";
import { buildManifest, getRawFile } from "./manifest";

/**
 * GET /api/public/edge-agent/file?path=main.py
 *
 * Devolve o conteÃºdo cru de um arquivo do backend/edge-agent/.
 * A whitelist Ã© o prÃ³prio manifesto â€” se o path nÃ£o estiver lÃ¡, 404.
 */
export const Route = createFileRoute("/api/public/edge-agent/file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = (url.searchParams.get("path") || "").trim();
        if (!path || path.includes("..") || path.startsWith("/")) {
          return new Response("bad path", { status: 400 });
        }
        const manifest = await buildManifest();
        const allowed = manifest.files.some((f) => f.path === path);
        if (!allowed) {
          return new Response("not found", { status: 404 });
        }
        const content = getRawFile(path);
        if (content == null) {
          return new Response("not found", { status: 404 });
        }
        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
