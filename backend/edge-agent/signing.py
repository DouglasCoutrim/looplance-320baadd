"""
Assinatura HMAC das requisições ao backend, além do Bearer edge_token.

Mesmo esquema implementado em server-routes/_lib/edgeAuth.server.ts:
  X-Edge-Timestamp: <unix ms>
  X-Edge-Signature: hex( HMAC_SHA256(EDGE_SHARED_SECRET, f"{timestamp}.{raw_body}") )

`raw_body` é string vazia para GET.
"""
from __future__ import annotations

import hashlib
import hmac
import time


def signed_headers(edge_token: str, edge_shared_secret: str, raw_body: str = "") -> dict:
    timestamp = str(int(time.time() * 1000))
    payload = f"{timestamp}.{raw_body}".encode("utf-8")
    signature = hmac.new(edge_shared_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return {
        "Authorization": f"Bearer {edge_token}",
        "X-Edge-Timestamp": timestamp,
        "X-Edge-Signature": signature,
    }
