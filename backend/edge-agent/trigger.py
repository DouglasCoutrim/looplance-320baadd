"""
Escuta a(s) botoeira(s) física(s) via:
  - evdev (Linux input subsystem, /dev/input/event*) para teclados USB genéricos
  - joystick API (/dev/input/js*) para placas Zero Delay / arcade USB encoders

Quando não há hardware físico disponível (ex: ambiente de desenvolvimento),
defina LOOPLANCE_FAKE_TRIGGER=1 e envie triggers via stdin ("K1<enter>").
"""
from __future__ import annotations

import logging
import os
import threading
from typing import Callable

log = logging.getLogger("looplance.trigger")

# Mapeamento do hardware Zero Delay ARC-968 / placa arcade USB genérica.
# Traduz o button_number bruto do joystick (0..11) para a string que deve
# ser salva no banco na coluna cameras.trigger_button.
MAPA_BOTOEIRA = {
    0: "K1", 1: "K2", 2: "K3", 3: "K4",
    4: "L2", 5: "R2", 6: "L1", 7: "R1",
    8: "SE", 9: "ST", 10: "K11", 11: "K12",
}

# Mapeamento evdev -> "K1".."K12" — teclados USB tradicionais.
KEYCODE_TO_LOCAL_KEY = {
    2: "K1", 3: "K2", 4: "K3", 5: "K4", 6: "K5", 7: "K6",
    8: "K7", 9: "K8", 10: "K9", 11: "K10", 12: "K11", 13: "K12",
}

OnTrigger = Callable[[str], None]  # recebe local_key ("K1"...)


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
    Dispara threads para escutar dispositivos físicos:
      - /dev/input/event*  (evdev) — teclados USB e botoeiras HID
      - /dev/input/js*     (joystick) — placas Zero Delay / arcade encoders
    input_boards: lista de dicts vindos da config remota, cada um com
    vendor_id/product_id (podem ser None se desconhecidos -> escuta todos os
    teclados disponíveis).
    """
    if os.environ.get("LOOPLANCE_FAKE_TRIGGER") == "1":
        t = threading.Thread(target=_fake_stdin_loop, args=(on_trigger,), daemon=True)
        t.start()
        return t

    t_evdev = threading.Thread(target=_evdev_loop, args=(on_trigger, input_boards), daemon=True)
    t_evdev.start()

    t_js = threading.Thread(target=_jsdev_loop, args=(on_trigger,), daemon=True)
    t_js.start()

    return t_evdev


def _fake_stdin_loop(on_trigger: OnTrigger) -> None:
    import sys
    log.warning("LOOPLANCE_FAKE_TRIGGER=1: digite K1..K12 + enter para simular um clique")
    for line in sys.stdin:
        key = line.strip().upper()
        if key:
            on_trigger(key)


def _parse_hex(v) -> int | None:
    if v in (None, ""):
        return None
    if isinstance(v, int):
        return v
    try:
        return int(str(v), 16)
    except (TypeError, ValueError):
        return None


def _evdev_loop(on_trigger: OnTrigger, input_boards: list[dict]) -> None:
    import select
    from evdev import categorize, ecodes

    vendor_ids: set[int] = set()
    product_pairs: set[tuple[int, int]] = set()
    for b in input_boards or []:
        vid = _parse_hex(b.get("vendor_id"))
        pid = _parse_hex(b.get("product_id"))
        if vid is not None:
            vendor_ids.add(vid)
        if vid is not None and pid is not None:
            product_pairs.add((vid, pid))

    while True:
        # Sempre passa pela detecção com fallback Zero Delay automático.
        devices = _find_input_boards_devices(vendor_ids, product_pairs)
        if not devices:
            log.warning("nenhuma botoeira/Zero Delay encontrada em /dev/input, tentando de novo em 5s")
            import time
            time.sleep(5)
            continue

        log.info("escutando botoeiras: %s", [f"{d.name} [{d.info.vendor:04x}:{d.info.product:04x}]" for d in devices])

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


def _jsdev_loop(on_trigger: OnTrigger) -> None:
    """Lê eventos do joystick via /dev/input/js*.
    Usa a API jsdev (struct js_event) — não depende de evdev.
    Traduz button_number via MAPA_BOTOEIRA e chama on_trigger com a label.
    """
    import select
    import struct
    import time as _time

    JS_EVENT_BUTTON = 0x01
    JS_EVENT_INIT = 0x80

    while True:
        # Procura o primeiro joystick disponível
        js_path = None
        import glob as _glob
        for p in sorted(_glob.glob("/dev/input/js*")):
            try:
                fd = os.open(p, os.O_RDONLY | os.O_NONBLOCK)
                os.close(fd)
                js_path = p
                break
            except OSError:
                continue

        if js_path is None:
            log.warning("nenhum joystick encontrado em /dev/input/js*, tentando de novo em 5s")
            _time.sleep(5)
            continue

        try:
            fd = os.open(js_path, os.O_RDONLY | os.O_NONBLOCK)
        except OSError:
            log.warning("%s indisponível, tentando de novo em 5s", js_path)
            _time.sleep(5)
            continue

        log.info("escutando joystick %s", js_path)
        try:
            while True:
                r, _, _ = select.select([fd], [], [], 1.0)
                if not r:
                    continue
                raw = os.read(fd, 8)
                if len(raw) < 8:
                    continue
                _, value, evtype, number = struct.unpack("<IhBB", raw)
                if evtype & JS_EVENT_INIT:
                    continue
                if evtype == JS_EVENT_BUTTON and value == 1:
                    label = MAPA_BOTOEIRA.get(number)
                    if label:
                        log.info("joystick %s botão %d pressionado -> %s", js_path, number, label)
                        on_trigger(label)
        except OSError:
            log.warning("%s desconectado, re-detectando...", js_path)
        finally:
            try:
                os.close(fd)
            except OSError:
                pass
