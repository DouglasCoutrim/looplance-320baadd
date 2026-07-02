"""
Coleta métricas do host (CPU, memória, disco, temperatura, rede)
para o heartbeat do Edge Agent. Ubuntu Server.

Usa psutil para tudo. Temperatura tenta sensors_temperatures() e cai em
zonas /sys/class/thermal como fallback (VMs comumente não expõem sensores).

Rede: mede taxa (bytes/s) somando todas as interfaces exceto loopback,
usando snapshot t0 → dorme intervalo curto → snapshot t1.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Optional

log = logging.getLogger("looplance.metrics")

try:
    import psutil  # type: ignore
except Exception:  # noqa: BLE001
    psutil = None  # type: ignore

# Estado global para calcular delta de rede entre chamadas consecutivas
_last_net_snapshot: dict[str, float] = {"t": 0.0, "rx": 0.0, "tx": 0.0}


def _read_thermal_zone() -> Optional[float]:
    """Fallback quando psutil.sensors_temperatures não retorna nada."""
    try:
        for zone in Path("/sys/class/thermal").glob("thermal_zone*"):
            temp_file = zone / "temp"
            if temp_file.exists():
                raw = temp_file.read_text().strip()
                if raw:
                    return round(int(raw) / 1000.0, 1)
    except Exception:  # noqa: BLE001
        pass
    return None


def _read_temperature() -> Optional[float]:
    if psutil is None:
        return _read_thermal_zone()
    getter = getattr(psutil, "sensors_temperatures", None)
    if not getter:
        return _read_thermal_zone()
    try:
        temps = getter()
    except Exception:  # noqa: BLE001
        return _read_thermal_zone()
    # Prefere coretemp/k10temp/cpu_thermal, senão o primeiro sensor válido
    priority = ("coretemp", "k10temp", "cpu_thermal", "acpitz")
    for key in priority:
        entries = temps.get(key) or []
        for e in entries:
            if e.current:
                return round(float(e.current), 1)
    for entries in temps.values():
        for e in entries:
            if e.current:
                return round(float(e.current), 1)
    return _read_thermal_zone()


def _read_net_rate() -> tuple[Optional[int], Optional[int]]:
    if psutil is None:
        return None, None
    try:
        counters = psutil.net_io_counters(pernic=True)
    except Exception:  # noqa: BLE001
        return None, None
    rx_total = 0
    tx_total = 0
    for nic, c in counters.items():
        if nic == "lo" or nic.startswith("docker") or nic.startswith("veth"):
            continue
        rx_total += c.bytes_recv
        tx_total += c.bytes_sent

    now = time.time()
    last_t = _last_net_snapshot["t"]
    if not last_t:
        _last_net_snapshot.update({"t": now, "rx": rx_total, "tx": tx_total})
        return 0, 0
    dt = max(now - last_t, 0.001)
    rx_bps = int(max(0, rx_total - _last_net_snapshot["rx"]) / dt)
    tx_bps = int(max(0, tx_total - _last_net_snapshot["tx"]) / dt)
    _last_net_snapshot.update({"t": now, "rx": rx_total, "tx": tx_total})
    return rx_bps, tx_bps


def collect() -> dict:
    """Retorna um dict pronto pra enviar no heartbeat. Nunca lança."""
    payload: dict = {}
    if psutil is None:
        log.warning("psutil indisponível; heartbeat sem métricas de sistema")
        return payload
    try:
        payload["cpu_percent"] = round(psutil.cpu_percent(interval=None), 1)
    except Exception:  # noqa: BLE001
        pass
    try:
        vm = psutil.virtual_memory()
        payload["memory_percent"] = round(vm.percent, 1)
        payload["memory_total_mb"] = int(vm.total / (1024 * 1024))
        payload["memory_used_mb"] = int(vm.used / (1024 * 1024))
    except Exception:  # noqa: BLE001
        pass
    try:
        du = psutil.disk_usage("/")
        payload["disk_percent"] = round(du.percent, 1)
    except Exception:  # noqa: BLE001
        pass
    try:
        la = os.getloadavg()
        payload["load_avg_1m"] = round(la[0], 2)
    except Exception:  # noqa: BLE001
        pass
    temp = _read_temperature()
    if temp is not None:
        payload["temperature_c"] = temp
    rx, tx = _read_net_rate()
    if rx is not None:
        payload["net_rx_bps"] = rx
        payload["net_tx_bps"] = tx
    return payload
