"""
Sincronização de horário para edge devices (Raspberry Pi sem RTC).

Estratégia (3 camadas):
  1. systemd-timesyncd  — já roda como daemon, configurado no install.sh.
  2. NTP aplicacional   — consulta servidores NTP brasileiros via ntplib.
  3. HTTP fallback      — lê header Date da resposta da API.

O loop principal verifica o offset a cada `check_interval` segundos.
Se o |offset| > `max_offset_seconds`, tenta corrigir com timedatectl.
"""
from __future__ import annotations

import logging
import subprocess
import threading
import time
from dataclasses import dataclass, field

import httpx

log = logging.getLogger("looplance.timesync")

NTP_SERVERS = [
    "a.st1.ntp.br",
    "b.st1.ntp.br",
    "c.st1.ntp.br",
    "pool.ntp.br",
    "a.ntp.br",
    "b.ntp.br",
]

CHECK_INTERVAL = 300       # 5 min entre verificações
MAX_OFFSET_SECONDS = 5.0   # corrige se diferença > 5s


class NtpUnavailableError(RuntimeError):
    """Nenhum servidor NTP respondeu."""


@dataclass
class TimeSyncResult:
    success: bool
    server_time: float | None = None  # timestamp UNIX
    offset: float = 0.0
    source: str = ""


def _ntp_query(server: str, timeout: float = 5.0) -> float:
    """Consulta um servidor NTP e retorna o timestamp UNIX do servidor."""
    import ntplib
    client = ntplib.NTPClient()
    resp = client.request(server, version=4, timeout=timeout)
    return resp.tx_time


def ntp_sync() -> TimeSyncResult:
    """Tenta obter o horário de vários servidores NTP.
    Retorna o primeiro que responder."""
    for server in NTP_SERVERS:
        try:
            server_ts = _ntp_query(server)
            offset = server_ts - time.time()
            log.info("NTP %s: server=%.3f local=%.3f offset=%.3f",
                      server, server_ts, time.time(), offset)
            return TimeSyncResult(
                success=True,
                server_time=server_ts,
                offset=offset,
                source=f"ntp:{server}",
            )
        except Exception:
            log.debug("NTP %s sem resposta", server)
    return TimeSyncResult(success=False)


def http_fallback_sync(api_base_url: str, timeout: float = 10.0) -> TimeSyncResult:
    """Obtém o horário do servidor via header Date de uma resposta HTTP."""
    try:
        resp = httpx.get(api_base_url, timeout=timeout)
        date_header = resp.headers.get("Date")
        if not date_header:
            return TimeSyncResult(success=False)
        parsed = time.strptime(date_header, "%a, %d %b %Y %H:%M:%S %Z")
        server_ts = time.mktime(parsed)
        offset = server_ts - time.time()
        log.info("HTTP fallback: server=%.3f local=%.3f offset=%.3f",
                  server_ts, time.time(), offset)
        return TimeSyncResult(
            success=True,
            server_time=server_ts,
            offset=offset,
            source="http:date-header",
        )
    except Exception:
        log.debug("HTTP fallback falhou", exc_info=True)
        return TimeSyncResult(success=False)


def _adjust_system_clock(server_ts: float) -> bool:
    """Ajusta o relógio do sistema via timedatectl ou date."""
    try:
        formatted = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(server_ts))
        subprocess.run(
            ["timedatectl", "set-time", formatted],
            capture_output=True, timeout=15, check=True,
        )
        log.info("Clock ajustado para %s (UTC)", formatted)
        return True
    except Exception:
        log.warning("timedatectl falhou, tentando date -s ...")
        try:
            formatted = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(server_ts))
            subprocess.run(
                ["date", "-s", formatted],
                capture_output=True, timeout=10, check=True,
            )
            log.info("Clock ajustado via date -s para %s (UTC)", formatted)
            return True
        except Exception as exc:
            log.error("Falha ao ajustar relógio do sistema: %s", exc)
            return False


def sync_once(api_base_url: str) -> TimeSyncResult:
    """Tenta NTP → HTTP fallback. Se offset > limite, ajusta o clock."""
    result = ntp_sync()
    if not result.success:
        log.warning("NTP indisponível, tentando fallback HTTP...")
        result = http_fallback_sync(api_base_url)

    if result.success and abs(result.offset) > MAX_OFFSET_SECONDS and result.server_time is not None:
        log.warning("Offset %.1fs > limite %.1fs — ajustando relógio...",
                     result.offset, MAX_OFFSET_SECONDS)
        if _adjust_system_clock(result.server_time):
            result.offset = 0.0
    elif result.success:
        log.info("Offset %.1fs dentro do limite (%.1fs) — sem ação",
                 result.offset, MAX_OFFSET_SECONDS)

    return result


def start_time_sync_loop(api_base_url: str, shutdown_event: threading.Event) -> None:
    """Loop em background: sincroniza horário periodicamente."""
    log.info("timesync iniciado (intervalo=%ds, max_offset=%.1fs)",
             CHECK_INTERVAL, MAX_OFFSET_SECONDS)
    while not shutdown_event.is_set():
        try:
            sync_once(api_base_url)
        except Exception:
            log.exception("Erro no ciclo de sincronização de horário")
        shutdown_event.wait(CHECK_INTERVAL)
