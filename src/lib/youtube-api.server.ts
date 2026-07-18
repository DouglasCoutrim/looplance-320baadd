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
      .select("access_token, refresh_token, token_expires_at")
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

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new YouTubeApiError("YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET não configurados", 500);
  }

  const arenaName = arenaResult.data?.nome ?? "Arena";

  const client = new YouTubeApiClient(clientId, clientSecret, {
    accessToken: credsResult.data.access_token,
    refreshToken: credsResult.data.refresh_token,
    tokenExpiresAt: credsResult.data.token_expires_at,
  });

  return { client, arenaName };
}
