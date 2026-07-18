export class YouTubeApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

interface YouTubeCredentials {
  accessToken: string | null;
  refreshToken: string;
  tokenExpiresAt: string | null;
}

interface BroadcastResponse {
  id: string;
  title: string;
  scheduledStartTime: string;
  status: string;
}

interface StreamResponse {
  id: string;
  streamKey: string;
  ingestionAddress: string;
}

export class YouTubeApiClient {
  private clientId: string;
  private clientSecret: string;
  private credentials: YouTubeCredentials;

  constructor(clientId: string, clientSecret: string, credentials: YouTubeCredentials) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.credentials = credentials;
  }

  private async refreshAccessToken(): Promise<string> {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.credentials.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new YouTubeApiError(`Falha ao renovar token OAuth: ${err}`, resp.status);
    }

    const data = await resp.json() as { access_token: string; expires_in: number };
    this.credentials.accessToken = data.access_token;
    this.credentials.tokenExpiresAt = new Date(
      Date.now() + (data.expires_in - 60) * 1000,
    ).toISOString();

    return data.access_token;
  }

  private async getValidAccessToken(): Promise<string> {
    if (
      this.credentials.accessToken &&
      this.credentials.tokenExpiresAt &&
      new Date(this.credentials.tokenExpiresAt) > new Date()
    ) {
      return this.credentials.accessToken;
    }
    return this.refreshAccessToken();
  }

  async createBroadcast(arenaName: string): Promise<BroadcastResponse> {
    const token = await this.getValidAccessToken();
    const body = {
      snippet: {
        title: `Looplance - ${arenaName}`,
        scheduledStartTime: new Date().toISOString(),
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: true,
      },
    };

    const resp = await fetch(
      "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new YouTubeApiError(`Falha ao criar liveBroadcast: ${err}`, resp.status);
    }

    const data = await resp.json() as {
      id: string;
      snippet: { title: string; scheduledStartTime: string };
      status: { lifeCycleStatus: string };
    };

    return {
      id: data.id,
      title: data.snippet.title,
      scheduledStartTime: data.snippet.scheduledStartTime,
      status: data.status.lifeCycleStatus,
    };
  }

  async createStream(): Promise<StreamResponse> {
    const token = await this.getValidAccessToken();
    const body = {
      snippet: {
        title: `Looplance Stream ${Date.now()}`,
      },
      cdn: {
        ingestionType: "rtmp",
        resolution: "720p",
        frameRate: "30fps",
      },
      contentDetails: {
        isReusable: false,
      },
    };

    const resp = await fetch(
      "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,contentDetails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new YouTubeApiError(`Falha ao criar liveStream: ${err}`, resp.status);
    }

    const data = await resp.json() as {
      id: string;
      cdn: { ingestionInfo: { streamName: string; ingestionAddress: string } };
    };

    return {
      id: data.id,
      streamKey: data.cdn.ingestionInfo.streamName,
      ingestionAddress: data.cdn.ingestionInfo.ingestionAddress,
    };
  }

  async bindBroadcast(broadcastId: string, streamId: string): Promise<void> {
    const token = await this.getValidAccessToken();
    const resp = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=id,contentDetails&id=${broadcastId}&streamId=${streamId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new YouTubeApiError(`Falha ao fazer bind broadcast/stream: ${err}`, resp.status);
    }
  }

  async transitionBroadcast(broadcastId: string, status: "testing" | "active" | "complete"): Promise<void> {
    const token = await this.getValidAccessToken();
    const resp = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?part=status&id=${broadcastId}&broadcastStatus=${status}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new YouTubeApiError(`Falha ao transicionar broadcast para ${status}: ${err}`, resp.status);
    }
  }
}

export async function getYouTubeClientForArenaWithName(
  arenaId: string,
): Promise<{ client: YouTubeApiClient; arenaName: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [credsResult, arenaResult] = await Promise.all([
    supabaseAdmin
      .from("arena_youtube_credentials")
      .select("access_token, refresh_token, token_expires_at, client_id, client_secret")
      .eq("arena_id", arenaId)
      .maybeSingle(),
    supabaseAdmin
      .from("arenas")
      .select("nome")
      .eq("id", arenaId)
      .single(),
  ]);

  if (credsResult.error) throw new YouTubeApiError(`Erro lendo credenciais: ${credsResult.error.message}`, 500);
  if (!credsResult.data) return null;

  const { client_id, client_secret, refresh_token, access_token, token_expires_at } = credsResult.data;
  if (!client_id || !client_secret || !refresh_token) return null;

  const arenaName = arenaResult.data?.nome ?? "Arena";

  const client = new YouTubeApiClient(client_id, client_secret, {
    accessToken: access_token,
    refreshToken: refresh_token,
    tokenExpiresAt: token_expires_at,
  });

  return { client, arenaName };
}

// ── OAuth 2.0 helpers (YouTube Connect flow) ──────────────────────────

const SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"];

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

function encodeOAuthState(arenaId: string, userId: string): string {
  return base64UrlEncode(JSON.stringify({ arenaId, userId }));
}

export function decodeOAuthState(state: string): { arenaId: string; userId: string } | null {
  try {
    return JSON.parse(base64UrlDecode(state));
  } catch {
    return null;
  }
}

export function generateYouTubeOAuthUrl(
  redirectUri: string,
  arenaId: string,
  userId: string,
): string {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    throw new YouTubeApiError("YOUTUBE_CLIENT_ID não configurado", 500);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: encodeOAuthState(arenaId, userId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new YouTubeApiError("YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET não configurados", 500);
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new YouTubeApiError(`Falha ao trocar code por tokens: ${err}`, resp.status);
  }

  return resp.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}
