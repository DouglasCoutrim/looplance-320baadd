"""Upload do clip final para Cloudflare R2 (S3-compatible)."""
from __future__ import annotations

import datetime as dt
import logging
from pathlib import Path

import boto3
from botocore.config import Config

from config import Settings

log = logging.getLogger("looplance.uploader")


def _client(settings: Settings):
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3},
            s3={"addressing_style": "path"},
            read_timeout=45,
            connect_timeout=10,
        ),
        region_name="auto",
    )


def upload_clip(
    settings: Settings,
    *,
    arena_id: str,
    quadra_id: str,
    replay_id: str,
    file_path: Path,
) -> tuple[str, str, int]:
    """
    Convenção de chave (spec 4.2):
      replays/<arena_id>/<quadra_id>/<yyyy-mm-dd>/<replay_id>.mp4
    Retorna (r2_key, video_url, file_size_bytes).

    Usa put_object (single-request PUT) em vez de upload_file, porque o
    transfer manager do boto3 alterna para multipart em arquivos maiores e
    o Cloudflare R2 é estrito quanto à assinatura SigV4 dessas partes,
    causando SignatureDoesNotMatch de forma intermitente.
    """
    date_part = dt.datetime.utcnow().strftime("%Y-%m-%d")
    key = f"replays/{arena_id}/{quadra_id}/{date_part}/{replay_id}.mp4"

    size = file_path.stat().st_size
    client = _client(settings)

    with file_path.open("rb") as fh:
        client.put_object(
            Bucket=settings.r2_bucket_name,
            Key=key,
            Body=fh,
            ContentLength=size,
            ContentType="video/mp4",
            ContentDisposition="attachment",
        )

    video_url = f"{settings.r2_public_base_url}/{key}"
    log.info("upload concluído: %s (%.1f MB)", key, size / 1_000_000)
    return key, video_url, size
