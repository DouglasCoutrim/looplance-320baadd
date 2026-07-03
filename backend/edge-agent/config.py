"""
Carrega configuração local (/etc/looplance/edge.env) e busca a config
remota do device (câmeras, botoeiras, overlays) no backend.

Nada disso toca o disco além do próprio env file (que é texto pequeno,
não vídeo). Todo o buffer de vídeo vive em RAM_BUFFER_DIR (tmpfs).
"""
from __future__ import annotations

import os
import socket
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from dotenv import load_dotenv

ENV_PATH = Path(os.environ.get("LOOPLANCE_ENV_FILE", "/etc/looplance/edge.env"))


@dataclass
class CameraConfig:
    id: str
    quadra_id: str
    name: str
    rtsp_url: str
    buffer_seconds: int
    replay_seconds: int
    trigger_button: int
    overlay_url: str | None
    final_overlay_url: str | None
    video_x: int
    video_y: int
    video_width: int
    video_height: int
    active: bool
    arena_id: str | None = None



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
    ram_buffer_dir: Path
    segment_seconds: int
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

    def req(name: str) -> str:
        v = os.environ.get(name)
        if not v:
            raise RuntimeError(f"Variável obrigatória ausente em {ENV_PATH}: {name}")
        return v

    return Settings(
        edge_device_id=req("EDGE_DEVICE_ID"),
        edge_token=req("EDGE_TOKEN"),
        edge_shared_secret=req("EDGE_SHARED_SECRET"),
        api_base_url=req("API_BASE_URL").rstrip("/"),
        supabase_url=req("SUPABASE_URL").rstrip("/"),
        supabase_anon_key=req("SUPABASE_ANON_KEY"),
        r2_bucket_name=req("R2_BUCKET_NAME"),
        r2_endpoint_url=req("R2_ENDPOINT_URL"),
        r2_access_key_id=req("R2_ACCESS_KEY_ID"),
        r2_secret_access_key=req("R2_SECRET_ACCESS_KEY"),
        r2_public_base_url=req("R2_PUBLIC_BASE_URL").rstrip("/"),
        ram_buffer_dir=Path(os.environ.get("RAM_BUFFER_DIR", "/dev/shm/looplance")),
        segment_seconds=int(os.environ.get("SEGMENT_SECONDS", "2")),
        heartbeat_interval_seconds=int(os.environ.get("HEARTBEAT_INTERVAL_SECONDS", "30")),
        edge_version=os.environ.get("EDGE_VERSION", "1.0.0"),
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
                    name=c["name"],
                    rtsp_url=c["rtsp_url"],
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
