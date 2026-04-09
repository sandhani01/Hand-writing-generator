from __future__ import annotations

import re
import shutil
import tempfile
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from fastapi.responses import FileResponse, Response

from ..config import get_settings

try:
    import boto3
except ImportError:  # pragma: no cover - optional dependency for local-only usage
    boto3 = None


def _safe_name(raw_name: str) -> str:
    candidate = re.sub(r"[^A-Za-z0-9._-]+", "_", raw_name).strip("._")
    return candidate or f"file_{uuid4().hex[:8]}"


class LocalStorageBackend:
    def store_upload(
        self,
        user_id: str,
        dataset_type: str,
        dataset_id: str,
        filename: str,
        content: bytes,
    ) -> str:
        settings = get_settings()
        safe_name = _safe_name(filename)
        target = settings.uploads_dir / user_id / dataset_type / dataset_id / safe_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return str(target)

    def dataset_glyph_root(self, user_id: str, dataset_id: str) -> str:
        settings = get_settings()
        target = settings.glyph_sets_dir / user_id / dataset_id
        target.mkdir(parents=True, exist_ok=True)
        return str(target)

    def render_output_ref(self, user_id: str, render_id: str) -> str:
        settings = get_settings()
        target = settings.renders_dir / user_id / f"{render_id}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        return str(target)

    @contextmanager
    def materialize_file(self, ref: str):
        yield Path(ref)

    @contextmanager
    def materialize_tree(self, ref: str):
        yield Path(ref)

    def save_tree(self, local_dir: Path, ref: str) -> None:
        target = Path(ref)
        if target.exists():
            shutil.rmtree(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(local_dir, target)

    def save_file(self, local_path: Path, ref: str) -> None:
        target = Path(ref)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(local_path, target)

    def read_file(self, ref: str) -> bytes:
        return Path(ref).read_bytes()

    def exists(self, ref: str) -> bool:
        return Path(ref).exists()

    def delete(self, ref: str) -> None:
        path = Path(ref)
        if not path.exists():
            return
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()

    def download_response(self, ref: str, filename: str, media_type: str) -> Response:
        return FileResponse(Path(ref), media_type=media_type, filename=filename)


class S3StorageBackend:
    def __init__(self) -> None:
        settings = get_settings()
        if boto3 is None:
            raise RuntimeError(
                "boto3 is required for HANDWRITING_STORAGE_BACKEND=s3."
            )
        if not settings.storage_bucket:
            raise RuntimeError(
                "Set HANDWRITING_STORAGE_BUCKET before using S3 object storage."
            )
        client_kwargs: dict[str, object] = {
            "service_name": "s3",
            "region_name": settings.storage_region or None,
            "endpoint_url": settings.storage_endpoint_url or None,
            "aws_access_key_id": settings.storage_access_key_id or None,
            "aws_secret_access_key": settings.storage_secret_access_key or None,
            "aws_session_token": settings.storage_session_token or None,
            "use_ssl": settings.storage_use_ssl,
        }
        self.client = boto3.client(**client_kwargs)
        self.bucket = settings.storage_bucket
        self.prefix = settings.storage_prefix.strip("/")

    def _key(self, *parts: str) -> str:
        fragments = [part.strip("/") for part in parts if part and part.strip("/")]
        if self.prefix:
            fragments.insert(0, self.prefix)
        return "/".join(fragments)

    def store_upload(
        self,
        user_id: str,
        dataset_type: str,
        dataset_id: str,
        filename: str,
        content: bytes,
    ) -> str:
        key = self._key("uploads", user_id, dataset_type, dataset_id, _safe_name(filename))
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType="image/jpeg",
        )
        return key

    def dataset_glyph_root(self, user_id: str, dataset_id: str) -> str:
        return f"{self._key('glyph_sets', user_id, dataset_id)}/"

    def render_output_ref(self, user_id: str, render_id: str) -> str:
        return self._key("renders", user_id, f"{render_id}.png")

    @contextmanager
    def materialize_file(self, ref: str):
        suffix = Path(ref).suffix or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            temp_path = Path(handle.name)
        try:
            self.client.download_file(self.bucket, ref, str(temp_path))
            yield temp_path
        finally:
            temp_path.unlink(missing_ok=True)

    @contextmanager
    def materialize_tree(self, ref: str):
        with tempfile.TemporaryDirectory() as temp_dir:
            destination_root = Path(temp_dir)
            paginator = self.client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket, Prefix=ref):
                for item in page.get("Contents", []):
                    key = item["Key"]
                    if key.endswith("/"):
                        continue
                    relative_key = key[len(ref) :].lstrip("/")
                    target = destination_root / relative_key
                    target.parent.mkdir(parents=True, exist_ok=True)
                    self.client.download_file(self.bucket, key, str(target))
            yield destination_root

    def save_tree(self, local_dir: Path, ref: str) -> None:
        self.delete(ref)
        for file_path in local_dir.rglob("*"):
            if not file_path.is_file():
                continue
            relative_path = file_path.relative_to(local_dir).as_posix()
            target_key = f"{ref.rstrip('/')}/{relative_path}"
            self.client.upload_file(str(file_path), self.bucket, target_key)

    def save_file(self, local_path: Path, ref: str) -> None:
        self.client.upload_file(str(local_path), self.bucket, ref)

    def read_file(self, ref: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=ref)
        return response["Body"].read()

    def exists(self, ref: str) -> bool:
        if ref.endswith("/"):
            response = self.client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=ref,
                MaxKeys=1,
            )
            return bool(response.get("Contents"))

        try:
            self.client.head_object(Bucket=self.bucket, Key=ref)
            return True
        except Exception:
            return False

    def delete(self, ref: str) -> None:
        if ref.endswith("/"):
            paginator = self.client.get_paginator("list_objects_v2")
            objects_to_delete: list[dict[str, str]] = []
            for page in paginator.paginate(Bucket=self.bucket, Prefix=ref):
                for item in page.get("Contents", []):
                    objects_to_delete.append({"Key": item["Key"]})
                    if len(objects_to_delete) == 1000:
                        self.client.delete_objects(
                            Bucket=self.bucket,
                            Delete={"Objects": objects_to_delete},
                        )
                        objects_to_delete = []
            if objects_to_delete:
                self.client.delete_objects(
                    Bucket=self.bucket,
                    Delete={"Objects": objects_to_delete},
                )
            return

        self.client.delete_object(Bucket=self.bucket, Key=ref)

    def download_response(self, ref: str, filename: str, media_type: str) -> Response:
        return Response(
            content=self.read_file(ref),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )


@lru_cache(maxsize=1)
def _get_backend():
    settings = get_settings()
    if settings.storage_backend == "local":
        return LocalStorageBackend()
    if settings.storage_backend == "s3":
        return S3StorageBackend()
    raise RuntimeError(
        f"Unsupported HANDWRITING_STORAGE_BACKEND={settings.storage_backend!r}."
    )


def store_upload(
    user_id: str,
    dataset_type: str,
    dataset_id: str,
    filename: str,
    content: bytes,
) -> str:
    return _get_backend().store_upload(user_id, dataset_type, dataset_id, filename, content)


def dataset_glyph_ref(user_id: str, dataset_id: str) -> str:
    return _get_backend().dataset_glyph_root(user_id, dataset_id)


def render_output_ref(user_id: str, render_id: str) -> str:
    return _get_backend().render_output_ref(user_id, render_id)


@contextmanager
def materialize_file(ref: str):
    with _get_backend().materialize_file(ref) as path:
        yield path


@contextmanager
def materialize_tree(ref: str):
    with _get_backend().materialize_tree(ref) as path:
        yield path


def save_tree(local_dir: Path, ref: str) -> None:
    _get_backend().save_tree(local_dir, ref)


def save_file(local_path: Path, ref: str) -> None:
    _get_backend().save_file(local_path, ref)


def read_file(ref: str) -> bytes:
    return _get_backend().read_file(ref)


def ref_exists(ref: str) -> bool:
    return _get_backend().exists(ref)


def delete_ref(ref: str) -> None:
    _get_backend().delete(ref)


def build_download_response(ref: str, filename: str, media_type: str) -> Response:
    return _get_backend().download_response(ref, filename, media_type)
