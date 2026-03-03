import base64
import hashlib
import hmac
import json
import os
import secrets
import shutil
import sys
from pathlib import Path

from data.database import _get_edi_storage_dir


PASSWORD_CONFIG_FILENAME = "auth_config.json"
BOOTSTRAP_PASSWORD_FILENAME = "auth_password.txt"


def _legacy_password_config_paths() -> list[Path]:
    backend_dir = Path(__file__).resolve().parents[1]
    candidates = [
        backend_dir / PASSWORD_CONFIG_FILENAME,
        backend_dir / "data" / PASSWORD_CONFIG_FILENAME,
        Path(sys.executable).resolve().parent / PASSWORD_CONFIG_FILENAME,
        Path.cwd().resolve() / PASSWORD_CONFIG_FILENAME,
    ]

    unique_candidates: list[Path] = []
    seen = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        unique_candidates.append(resolved)

    return unique_candidates


def _migrate_legacy_password_config(target_path: Path) -> None:
    if target_path.exists():
        return

    for legacy_path in _legacy_password_config_paths():
        if not legacy_path.exists() or legacy_path.resolve() == target_path.resolve():
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(legacy_path), str(target_path))
        return


def _password_config_path() -> Path:
    storage_dir = _get_edi_storage_dir()
    storage_dir.mkdir(parents=True, exist_ok=True)
    target_path = storage_dir / PASSWORD_CONFIG_FILENAME
    _migrate_legacy_password_config(target_path)
    return target_path


def _bootstrap_password_path() -> Path:
    return _password_config_path().with_name(BOOTSTRAP_PASSWORD_FILENAME)


def _resolve_initial_password() -> str:
    env_password = os.getenv("EDI_DEFAULT_PASSWORD")
    if env_password:
        return env_password

    bootstrap_path = _bootstrap_password_path()
    if bootstrap_path.exists():
        persisted_password = bootstrap_path.read_text(encoding="utf-8").strip()
        if persisted_password:
            return persisted_password

    generated_password = secrets.token_urlsafe(12)
    bootstrap_path.write_text(generated_password + "\n", encoding="utf-8")
    try:
        os.chmod(bootstrap_path, 0o600)
    except OSError:
        pass
    return generated_password


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

    payload = _create_password_payload(_resolve_initial_password())
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
