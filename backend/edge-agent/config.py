"""
Carrega configuração local (/etc/looplance/edge.env) e busca a config
remota do device (câmeras, botoeiras, overlays) no backend.

Nada disso toca o disco além do próprio env file (que é texto pequeno,
não vídeo). Todo o buffer de vídeo vive em RAM_BUFFER_DIR (tmpfs).
"""
from __future__ import annotations

import base64
import binascii
import os
import socket
import time
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv

ENV_PATH = Path(os.environ.get("LOOPLANCE_ENV_FILE", "/etc/looplance/edge.env"))


@dataclass
class CameraConfig:
    id: str
    quadra_id: str
    name: str
    buffer_seconds: int
    replay_seconds: int
    trigger_button: int

    arena_id: str = "unknown-arena"
    rtsp_url: str = ""
    overlay_url: str | None = None
    final_overlay_url: str | None = None
    video_x: int = 0
    video_y: int = 0
    video_width: int = 0
    video_height: int = 0
    active: bool = True
    stream_protocol: str = "rtsp"
    rtmp_stream_key: str | None = None
    protocol_settings: dict | None = None


@dataclass
class ButtonMapping:
    local_key: str          # "K1".."K12"
    camera_id: str


@dataclass
class Settings:
    edge_device_id: str
    edge_token: str
    edge_shared_secret: str
    api_base_url: str
    supabase_url: str
    supabase_anon_key: str
    r2_bucket_name: str
    r2_endpoint_url: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_public_base_url: str
    r2_live_bucket_name: str
    r2_live_public_base_url: str
    ram_buffer_dir: Path
    segment_seconds: int
    hls_segment_seconds: int
    hls_list_size: int
    heartbeat_interval_seconds: int
    edge_version: str

    hostname: str = field(default_factory=socket.gethostname)

    cameras: list[CameraConfig] = field(default_factory=list)
    button_map: dict[str, ButtonMapping] = field(default_factory=dict)  # local_key -> mapping

    def signed_headers(self, raw_body: str = "") -> dict:
        """Headers Authorization + assinatura HMAC (ver signing.py)."""
        from signing import signed_headers as _signed_headers
        return _signed_headers(self.edge_token, self.edge_shared_secret, raw_body)


def load_settings() -> Settings:
    load_dotenv(ENV_PATH)

    def get_env(name: str, default: str | None = None) -> str | None:
        """
        Lê variáveis normais ou a variante NAME_B64.

        O instalador grava credenciais R2 em base64 para que caracteres como
        /, +, =, #, aspas ou $ não sejam reinterpretados pelo bash/systemd/
        python-dotenv antes de chegarem ao boto3.
        """
        encoded = os.environ.get(f"{name}_B64")
        if encoded:
            try:
                return base64.b64decode(encoded.encode("ascii"), validate=True).decode("utf-8")
            except (UnicodeDecodeError, binascii.Error) as exc:
                raise RuntimeError(f"Variável {name}_B64 inválida em {ENV_PATH}") from exc
        return os.environ.get(name, default)

    def req(name: str) -> str:
        v = get_env(name)
        if not v:
            raise RuntimeError(f"Variável obrigatória ausente em {ENV_PATH}: {name}")
        return v

    def normalize_r2_endpoint(value: str) -> str:
        endpoint = value.strip().rstrip("/")
        parsed = urlparse(endpoint)
        if parsed.scheme != "https" or not parsed.netloc:
            raise RuntimeError(
                "R2_ENDPOINT_URL deve estar no formato "
                "https://<account_id>.r2.cloudflarestorage.com"
            )
        if parsed.path or parsed.params or parsed.query or parsed.fragment:
            raise RuntimeError(
                "R2_ENDPOINT_URL deve conter apenas o endpoint da conta R2, "
                "sem bucket, caminho, query ou fragmento"
            )
        if not parsed.netloc.endswith(".r2.cloudflarestorage.com"):
            raise RuntimeError(
                "R2_ENDPOINT_URL inválido para Cloudflare R2. Use "
                "https://<account_id>.r2.cloudflarestorage.com"
            )
        return endpoint

    return Settings(
        edge_device_id=req("EDGE_DEVICE_ID"),
        edge_token=req("EDGE_TOKEN"),
        edge_shared_secret=req("EDGE_SHARED_SECRET"),
        api_base_url=req("API_BASE_URL").rstrip("/"),
        supabase_url=req("SUPABASE_URL").rstrip("/"),
        supabase_anon_key=req("SUPABASE_ANON_KEY"),
        r2_bucket_name=req("R2_BUCKET_NAME"),
        r2_endpoint_url=normalize_r2_endpoint(req("R2_ENDPOINT_URL")),
        r2_access_key_id=req("R2_ACCESS_KEY_ID"),
        r2_secret_access_key=req("R2_SECRET_ACCESS_KEY"),
        r2_public_base_url=req("R2_PUBLIC_BASE_URL").rstrip("/"),
        r2_live_bucket_name=get_env("R2_LIVE_BUCKET_NAME", "looplance-live") or "looplance-live",
        r2_live_public_base_url=(get_env(
            "R2_LIVE_PUBLIC_BASE_URL", "https://live.izyia.com.br"
        ) or "https://live.izyia.com.br").rstrip("/"),
        ram_buffer_dir=Path(get_env("RAM_BUFFER_DIR", "/dev/shm/looplance") or "/dev/shm/looplance"),
        segment_seconds=int(get_env("SEGMENT_SECONDS", "2") or "2"),
        hls_segment_seconds=int(get_env("HLS_SEGMENT_SECONDS", "2") or "2"),
        hls_list_size=int(get_env("HLS_LIST_SIZE", "6") or "6"),
        heartbeat_interval_seconds=int(get_env("HEARTBEAT_INTERVAL_SECONDS", "30") or "30"),
        edge_version=get_env("EDGE_VERSION", "1.0.0") or "1.0.0",
    )



def fetch_remote_config(settings: Settings, retries: int = 5) -> None:
    """
    GET /api/public/edge/config
    Preenche settings.cameras e settings.button_map a partir do backend.
    Repete com backoff caso o backend esteja indisponível no boot.
    """
    url = f"{settings.api_base_url}/api/public/edge/config"
    last_err = None
    for attempt in range(retries):
        try:
            resp = httpx.get(url, headers=settings.signed_headers(""), timeout=15)
            resp.raise_for_status()
            data = resp.json()
            settings.cameras = [
                CameraConfig(
                    id=c["id"],
                    quadra_id=c["quadra_id"],
                    arena_id=c.get("arena_id", "unknown-arena"),
                    name=c["name"],
                    rtsp_url=c.get("rtsp_url") or "",
                    buffer_seconds=c["buffer_seconds"],
                    replay_seconds=c["replay_seconds"],
                    trigger_button=c["trigger_button"],
                    overlay_url=c.get("overlay_url"),
                    final_overlay_url=c.get("final_overlay_url"),
                    video_x=c.get("video_x", 0),
                    video_y=c.get("video_y", 0),
                    video_width=c.get("video_width", 0),
                    video_height=c.get("video_height", 0),
                    active=c.get("active", True),
                    stream_protocol=c.get("stream_protocol", "rtsp"),
                    rtmp_stream_key=c.get("rtmp_stream_key"),
                    protocol_settings=c.get("protocol_settings"),
                )

                for c in data["cameras"]
                if c.get("active", True)
            ]
            settings.button_map = {
                b["local_key"]: ButtonMapping(local_key=b["local_key"], camera_id=b["camera_id"])
                for b in data.get("botoeiras", [])
            }
            return
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(min(2 ** attempt, 30))
    raise RuntimeError(f"Não foi possível buscar config remota em {url}: {last_err}")
