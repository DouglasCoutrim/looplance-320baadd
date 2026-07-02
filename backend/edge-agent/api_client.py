"""
Cliente HTTP para:
  - endpoints /api/public/edge/* do backend (TanStack), autenticados com edge_token
  - heartbeat via PATCH direto na Data API do Supabase (mantendo o comportamento
    já existente descrito na spec 6.2), usando a anon key + header custom
    x-edge-token, que a policy RLS valida via current_setting('request.header.x-edge-token').
"""
from __future__ import annotations

import logging
import time

import json

import httpx

from config import Settings

log = logging.getLogger("looplance.api")


def _post_signed(settings: Settings, path: str, body: dict, timeout: float) -> httpx.Response:
    # Serializa uma única vez: o corpo assinado (raw_body) precisa ser
    # EXATAMENTE o mesmo texto enviado, senão a verificação HMAC no
    # servidor não bate.
    raw_body = json.dumps(body)
    url = f"{settings.api_base_url}{path}"
    headers = {**settings.signed_headers(raw_body), "Content-Type": "application/json"}
    resp = httpx.post(url, content=raw_body, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp


def register_replay(
    settings: Settings,
    *,
    quadra_id: str,
    r2_key: str,
    video_url: str,
    duration_sec: float,
    file_size_bytes: int,
) -> dict:
    body = {
        "quadra_id": quadra_id,
        "r2_key": r2_key,
        "video_url": video_url,
        "duration_sec": round(duration_sec, 2),
        "file_size_bytes": file_size_bytes,
    }
    resp = _post_signed(settings, "/api/public/edge/replay", body, timeout=20)
    return resp.json()


def report_camera_status(
    settings: Settings, *, camera_id: str, streaming_status: str, streaming_error: str | None = None
) -> None:
    body = {"camera_id": camera_id, "streaming_status": streaming_status}
    if streaming_error:
        body["streaming_error"] = streaming_error
    try:
        _post_signed(settings, "/api/public/edge/camera-status", body, timeout=10)
    except Exception:  # noqa: BLE001
        log.exception("Falha ao reportar status da câmera %s", camera_id)


def send_heartbeat(settings: Settings, *, local_ip: str, uptime_seconds: int) -> None:
    """
    Envia heartbeat com telemetria completa (CPU, memória, disco, temperatura,
    rede) via rota assinada /api/public/edge/heartbeat. A rota atualiza o row
    do edge_devices com service_role no backend — sem depender de policy RLS
    para colunas novas.
    """
    from metrics import collect as collect_metrics  # import tardio: opcional

    body: dict = {
        "hostname": settings.hostname,
        "local_ip": local_ip,
        "uptime_seconds": uptime_seconds,
        "edge_version": settings.edge_version,
    }
    try:
        body.update(collect_metrics())
    except Exception:  # noqa: BLE001
        log.exception("Falha ao coletar métricas de sistema")

    try:
        _post_signed(settings, "/api/public/edge/heartbeat", body, timeout=10)
    except Exception:  # noqa: BLE001
        log.exception("Falha ao enviar heartbeat")



def _iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
