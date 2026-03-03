from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Optional


class AuthConfigError(Exception):
    pass


class AuthEngine:
    """Gerencia autenticação simples baseada em senha com token de sessão."""

    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.config_path = self.storage_dir / "auth_config.json"
        self._sessions: Dict[str, datetime] = {}
        self._session_ttl = timedelta(hours=12)

    def ensure_config(self):
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        if self.config_path.exists():
            return

        default_username = "edi_admin"
        default_password = "troque-esta-senha"
        payload = self._build_config(default_username, default_password)
        payload["password_hint"] = "Altere a senha inicial após o primeiro login."
        self._write_config(payload)

    def _build_config(self, username: str, password: str) -> dict:
        salt = secrets.token_hex(16)
        password_hash = self._hash_password(password, salt)
        return {
            "username": username,
            "password_salt": salt,
            "password_hash": password_hash,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _write_config(self, payload: dict):
        self.config_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def read_config(self) -> dict:
        self.ensure_config()
        try:
            data = json.loads(self.config_path.read_text(encoding="utf-8"))
        except Exception as exc:
            raise AuthConfigError(f"Falha ao ler auth_config.json: {exc}") from exc

        required_fields = {"username", "password_salt", "password_hash"}
        if not required_fields.issubset(data):
            raise AuthConfigError(
                "auth_config.json inválido. Campos obrigatórios: username, password_salt, password_hash"
            )
        return data

    @staticmethod
    def _hash_password(password: str, salt: str) -> str:
        return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()

    def validate_credentials(self, username: str, password: str) -> bool:
        config = self.read_config()
        if username != config["username"]:
            return False

        expected_hash = config["password_hash"]
        received_hash = self._hash_password(password, config["password_salt"])
        return hmac.compare_digest(expected_hash, received_hash)

    def create_session(self) -> str:
        token = secrets.token_urlsafe(48)
        self._sessions[token] = datetime.now(timezone.utc) + self._session_ttl
        return token

    def is_valid_session(self, token: Optional[str]) -> bool:
        if not token:
            return False

        self._cleanup_sessions()
        expiry = self._sessions.get(token)
        if not expiry:
            return False

        if expiry < datetime.now(timezone.utc):
            self._sessions.pop(token, None)
            return False

        return True

    def revoke_session(self, token: Optional[str]):
        if token:
            self._sessions.pop(token, None)

    def _cleanup_sessions(self):
        now = datetime.now(timezone.utc)
        expired_tokens = [token for token, expiry in self._sessions.items() if expiry < now]
        for token in expired_tokens:
            self._sessions.pop(token, None)

    def update_password(self, username: str, current_password: str, new_password: str):
        if not self.validate_credentials(username, current_password):
            raise AuthConfigError("Credenciais atuais inválidas")

        if len(new_password) < 8:
            raise AuthConfigError("Nova senha precisa ter pelo menos 8 caracteres")

        payload = self._build_config(username, new_password)
        self._write_config(payload)
        self._sessions.clear()
