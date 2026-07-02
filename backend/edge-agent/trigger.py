"""
Escuta a(s) botoeira(s) física(s) via evdev (Linux input subsystem).

A maioria das placas HID de botoeira (IO board) se apresenta ao Linux como
um teclado USB genérico, cada botão mapeado a uma tecla (ex: teclas 1-12 ou
F1-F12). O `input_boards` no banco guarda vendor_id/product_id para localizar
o /dev/input/eventX correto; `botoeiras.local_key` (K1..K12) mapeia a tecla
física para uma câmera via `trigger_button`/config remota.

Quando não há hardware físico disponível (ex: ambiente de desenvolvimento),
defina LOOPLANCE_FAKE_TRIGGER=1 e envie triggers via stdin ("K1<enter>").
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Callable

log = logging.getLogger("looplance.trigger")

# Mapeamento evdev -> "K1".."K12" — validado no frontend com as placas Zero Delay
# (arcade USB encoder). NÃO alterar sem re-testar no admin.
KEYCODE_TO_LOCAL_KEY = {
    2: "K1", 3: "K2", 4: "K3", 5: "K4", 6: "K5", 6: "K5",
    7: "K6", 8: "K7", 9: "K8", 10: "K9", 11: "K10",
    12: "K11", 13: "K12",
}

# Assinaturas conhecidas de placas Zero Delay / arcade USB encoders.
# (vendor_id, product_id) em inteiros. Detectadas automaticamente sem precisar
# cadastrar no banco.
ZERO_DELAY_SIGNATURES: set[tuple[int, int]] = {
    (0x0079, 0x0006),  # DragonRise Inc. Generic USB Joystick — Zero Delay clássico
    (0x0079, 0x0011),  # DragonRise Gamepad
    (0x0810, 0xE501),  # NEXT SNES-like encoder
    (0x0583, 0xA009),  # Padix arcade encoder
    (0x081F, 0xE401),  # iNNEXT / Zero Delay Encoder
}
ZERO_DELAY_NAME_HINTS = ("zero delay", "dragonrise", "arcade", "usb gamepad", "usb joystick", "generic usb")


def _looks_like_zero_delay(dev) -> bool:
    info = dev.info
    if (info.vendor, info.product) in ZERO_DELAY_SIGNATURES:
        return True
    name = (dev.name or "").lower()
    return any(hint in name for hint in ZERO_DELAY_NAME_HINTS)


def _find_input_boards_devices(vendor_ids: set[int], product_ids: set[tuple[int, int]]):
    from evdev import InputDevice, list_devices

    devices = []
    for path in list_devices():
        try:
            dev = InputDevice(path)
        except OSError:
            continue
        info = dev.info
        # 1) match explícito do banco (opcional)
        if (info.vendor, info.product) in product_ids or info.vendor in vendor_ids:
            devices.append(dev)
            continue
        # 2) auto-detecção Zero Delay (independente do que está cadastrado)
        if _looks_like_zero_delay(dev):
            devices.append(dev)
    return devices



def start_trigger_listener(on_trigger: OnTrigger, input_boards: list[dict]) -> threading.Thread:
    """
    input_boards: lista de dicts vindos da config remota, cada um com
    vendor_id/product_id (podem ser None se desconhecidos -> escuta todos os
    teclados disponíveis).
    """
    if os.environ.get("LOOPLANCE_FAKE_TRIGGER") == "1":
        t = threading.Thread(target=_fake_stdin_loop, args=(on_trigger,), daemon=True)
        t.start()
        return t

    t = threading.Thread(target=_evdev_loop, args=(on_trigger, input_boards), daemon=True)
    t.start()
    return t


def _fake_stdin_loop(on_trigger: OnTrigger) -> None:
    import sys
    log.warning("LOOPLANCE_FAKE_TRIGGER=1: digite K1..K12 + enter para simular um clique")
    for line in sys.stdin:
        key = line.strip().upper()
        if key:
            on_trigger(key)


def _evdev_loop(on_trigger: OnTrigger, input_boards: list[dict]) -> None:
    import select
    from evdev import categorize, ecodes, list_devices, InputDevice

    vendor_ids = {b["vendor_id"] for b in input_boards if b.get("vendor_id")}
    product_pairs = {
        (b["vendor_id"], b["product_id"])
        for b in input_boards
        if b.get("vendor_id") and b.get("product_id")
    }

    while True:
        devices = _find_input_boards_devices(vendor_ids, product_pairs) if (vendor_ids or product_pairs) else [
            InputDevice(p) for p in list_devices()
        ]
        if not devices:
            log.warning("nenhuma botoeira encontrada em /dev/input, tentando de novo em 5s")
            import time
            time.sleep(5)
            continue

        log.info("escutando botoeiras: %s", [d.name for d in devices])
        devices_by_fd = {d.fd: d for d in devices}
        try:
            while True:
                r, _, _ = select.select(devices_by_fd, [], [])
                for fd in r:
                    dev = devices_by_fd[fd]
                    for event in dev.read():
                        if event.type != ecodes.EV_KEY:
                            continue
                        key_event = categorize(event)
                        if key_event.keystate != key_event.key_down:
                            continue
                        local_key = KEYCODE_TO_LOCAL_KEY.get(event.code)
                        if local_key:
                            log.info("botão pressionado: %s (keycode=%s)", local_key, event.code)
                            on_trigger(local_key)
        except OSError:
            log.warning("dispositivo desconectado, re-detectando botoeiras")
            continue
