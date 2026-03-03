import base64
import hashlib
import hmac
import json
import os
import secrets
from pathlib import Path

from data.database import _get_edi_storage_dir


DEFAULT_PASSWORD = "edi123"
PASSWORD_CONFIG_FILENAME = "auth_config.json"


def _password_config_path() -> Path:
    storage_dir = _get_edi_storage_dir()
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir / PASSWORD_CONFIG_FILENAME


def _hash_password(password: str, salt: bytes) -> str:
    password_bytes = password.encode("utf-8")
    digest = hashlib.pbkdf2_hmac("sha256", password_bytes, salt, 200_000)
    return base64.b64encode(digest).decode("utf-8")


def _create_password_payload(password: str) -> dict:
    salt = secrets.token_bytes(16)
    return {
        "version": 1,
        "salt": base64.b64encode(salt).decode("utf-8"),
        "password_hash": _hash_password(password, salt),
    }


def _load_or_create_password_config() -> dict:
    config_path = _password_config_path()
    if config_path.exists():
        with config_path.open("r", encoding="utf-8") as source:
            return json.load(source)

    payload = _create_password_payload(os.getenv("EDI_DEFAULT_PASSWORD", DEFAULT_PASSWORD))
    with config_path.open("w", encoding="utf-8") as target:
        json.dump(payload, target, ensure_ascii=False, indent=2)
    return payload


def verify_password(password: str) -> bool:
    config = _load_or_create_password_config()
    stored_hash = config.get("password_hash")
    salt_encoded = config.get("salt")
    if not stored_hash or not salt_encoded:
        return False

    salt = base64.b64decode(salt_encoded.encode("utf-8"))
    computed_hash = _hash_password(password, salt)
    return hmac.compare_digest(stored_hash, computed_hash)


def update_password(current_password: str, new_password: str) -> bool:
    if not verify_password(current_password):
        return False

    payload = _create_password_payload(new_password)
    with _password_config_path().open("w", encoding="utf-8") as target:
        json.dump(payload, target, ensure_ascii=False, indent=2)
    return True


def password_config_exists() -> bool:
    return _password_config_path().exists()


def password_config_location() -> str:
    return str(_password_config_path())

