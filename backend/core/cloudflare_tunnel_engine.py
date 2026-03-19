import json
import os
import re
import subprocess
import threading
import contextlib
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Deque, Dict, Optional, Tuple


class CloudflareTunnelEngine:
    REPO_ROOT = Path(__file__).resolve().parents[2]
    DEFAULT_CLOUDFLARED_BIN = Path(r"C:\cloudflare\cloudflared.exe")
    DEFAULT_TARGET_URL = "http://localhost:3000"
    QUICK_TUNNEL_PATTERN = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com", re.IGNORECASE)
    HOSTNAME_PATTERN = re.compile(r"^\s*(?:-\s*)?hostname:\s*([^\s#]+)", re.IGNORECASE)

    _lock = threading.RLock()
    _process: Optional[subprocess.Popen] = None
    _stdout_thread: Optional[threading.Thread] = None
    _stderr_thread: Optional[threading.Thread] = None
    _public_url: Optional[str] = None
    _mode: Optional[str] = None
    _started_at: Optional[str] = None
    _last_error: Optional[str] = None
    _recent_output: Deque[str] = deque(maxlen=20)

    @classmethod
    def _get_storage_dir(cls) -> Path:
        custom_storage = os.getenv("EDI_STORAGE_DIR")
        if custom_storage:
            return Path(custom_storage).expanduser().resolve()

        home_dir = Path.home()
        for candidate in (home_dir / "Documents", home_dir / "documents"):
            if candidate.exists():
                return candidate / "EDI"
        return home_dir / "Documents" / "EDI"

    @classmethod
    def _state_path(cls) -> Path:
        state_dir = cls._get_storage_dir()
        state_dir.mkdir(parents=True, exist_ok=True)
        return state_dir / "cloudflare_tunnel_state.json"

    @classmethod
    def _cloudflared_bin(cls) -> Path:
        configured = os.getenv("CLOUDFLARED_BIN", "").strip()
        return Path(configured).expanduser() if configured else cls.DEFAULT_CLOUDFLARED_BIN

    @classmethod
    def _target_url(cls) -> str:
        return os.getenv("CLOUDFLARE_TARGET_URL", cls.DEFAULT_TARGET_URL).strip() or cls.DEFAULT_TARGET_URL

    @classmethod
    def _config_path(cls) -> Path:
        return cls.REPO_ROOT / "cloudflare" / "config.yml"

    @classmethod
    def _token(cls) -> Optional[str]:
        token = os.getenv("CLOUDFLARE_TUNNEL_TOKEN", "").strip()
        return token or None

    @classmethod
    def _read_config_text(cls) -> Optional[str]:
        config_path = cls._config_path()
        if not config_path.exists():
            return None
        try:
            return config_path.read_text(encoding="utf-8")
        except OSError:
            return None

    @classmethod
    def _extract_hostname_from_config_text(cls, config_text: Optional[str]) -> Optional[str]:
        if not config_text:
            return None
        for line in config_text.splitlines():
            match = cls.HOSTNAME_PATTERN.match(line.strip())
            if match:
                hostname = match.group(1).strip().strip("'\"")
                if hostname:
                    return hostname
        return None

    @classmethod
    def _known_public_url(cls) -> Optional[str]:
        hostname = cls._extract_hostname_from_config_text(cls._read_config_text())
        if not hostname:
            return None
        if hostname.startswith(("http://", "https://")):
            return hostname.rstrip("/")
        return f"https://{hostname}".rstrip("/")

    @classmethod
    def _resolve_start_command(cls) -> Tuple[list, str, Optional[str]]:
        token = cls._token()
        config_path = cls._config_path()
        if token:
            return (
                [str(cls._cloudflared_bin()), "tunnel", "run", "--token", token],
                "named-token",
                cls._known_public_url(),
            )

        if config_path.exists():
            return (
                [str(cls._cloudflared_bin()), "tunnel", "--config", str(config_path), "run"],
                "named-config",
                cls._known_public_url(),
            )

        return (
            [str(cls._cloudflared_bin()), "tunnel", "--url", cls._target_url()],
            "quick",
            None,
        )

    @classmethod
    def _parse_public_url_from_output(cls, line: str) -> Optional[str]:
        if not line:
            return None
        match = cls.QUICK_TUNNEL_PATTERN.search(line)
        if match:
            return match.group(0).rstrip("/")
        return None

    @classmethod
    def _save_state(cls, *, pid: Optional[int], running: bool):
        state = {
            "pid": pid,
            "running": running,
            "public_url": cls._public_url,
            "mode": cls._mode,
            "started_at": cls._started_at,
            "last_error": cls._last_error,
        }
        cls._state_path().write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")

    @classmethod
    def _load_state(cls) -> Dict:
        path = cls._state_path()
        if not path.exists():
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    @classmethod
    def _clear_state(cls):
        path = cls._state_path()
        if path.exists():
            with contextlib.suppress(OSError):
                path.unlink()

    @classmethod
    def _pid_is_running(cls, pid: Optional[int]) -> bool:
        if not pid:
            return False
        try:
            os.kill(pid, 0)
        except OSError:
            return False
        return True

    @classmethod
    def _sync_runtime_state(cls):
        if cls._process is not None and cls._process.poll() is not None:
            if cls._process.returncode not in (0, None):
                cls._last_error = cls._last_error or f"Cloudflare Tunnel finalizado com código {cls._process.returncode}."
            cls._process = None

        persisted = cls._load_state()
        persisted_pid = persisted.get("pid")
        persisted_running = cls._pid_is_running(persisted_pid)

        if cls._process is None:
            if persisted_running:
                cls._public_url = cls._public_url or persisted.get("public_url")
                cls._mode = cls._mode or persisted.get("mode")
                cls._started_at = cls._started_at or persisted.get("started_at")
                cls._last_error = cls._last_error or persisted.get("last_error")
            else:
                cls._public_url = None
                cls._mode = None
                cls._started_at = None
                cls._clear_state()

    @classmethod
    def _current_pid(cls) -> Optional[int]:
        if cls._process is not None and cls._process.poll() is None:
            return cls._process.pid
        persisted = cls._load_state()
        pid = persisted.get("pid")
        return pid if cls._pid_is_running(pid) else None

    @classmethod
    def _is_running(cls) -> bool:
        if cls._process is not None and cls._process.poll() is None:
            return True
        persisted = cls._load_state()
        return cls._pid_is_running(persisted.get("pid"))

    @classmethod
    def _consume_stream(cls, stream):
        try:
            for raw_line in iter(stream.readline, ""):
                line = (raw_line or "").strip()
                if not line:
                    continue
                with cls._lock:
                    cls._recent_output.append(line)
                    parsed_url = cls._parse_public_url_from_output(line)
                    if parsed_url and cls._public_url != parsed_url:
                        cls._public_url = parsed_url
                        cls._save_state(pid=cls._current_pid(), running=True)
        finally:
            with contextlib.suppress(Exception):
                stream.close()

    @classmethod
    def get_status(cls) -> Dict:
        with cls._lock:
            cls._sync_runtime_state()
            cloudflared_bin = cls._cloudflared_bin()
            config_path = cls._config_path()
            running = cls._is_running()
            pid = cls._current_pid()
            public_url = cls._public_url
            if not public_url and running:
                public_url = cls._load_state().get("public_url")

            status = "offline"
            if running and public_url:
                status = "online"
            elif running:
                status = "starting"

            return {
                "supported": True,
                "status": status,
                "is_online": status == "online",
                "is_running": running,
                "public_url": public_url,
                "copy_url": public_url,
                "mode": cls._mode or cls._load_state().get("mode"),
                "pid": pid,
                "started_at": cls._started_at or cls._load_state().get("started_at"),
                "last_error": cls._last_error or cls._load_state().get("last_error"),
                "cloudflared_bin": str(cloudflared_bin),
                "cloudflared_available": cloudflared_bin.exists(),
                "target_url": cls._target_url(),
                "config_path": str(config_path),
                "config_exists": config_path.exists(),
                "has_token": cls._token() is not None,
                "known_public_url": cls._known_public_url(),
            }

    @classmethod
    def start(cls) -> Dict:
        with cls._lock:
            status = cls.get_status()
            if status["is_running"]:
                return status

            cloudflared_bin = cls._cloudflared_bin()
            if not cloudflared_bin.exists():
                raise RuntimeError(f"cloudflared.exe não encontrado em {cloudflared_bin}")

            command, mode, known_url = cls._resolve_start_command()
            creationflags = 0
            if os.name == "nt":
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

            cls._public_url = known_url
            cls._mode = mode
            cls._started_at = datetime.now().isoformat(timespec="seconds")
            cls._last_error = None
            cls._recent_output.clear()

            cls._process = subprocess.Popen(
                command,
                cwd=str(cls.REPO_ROOT),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=creationflags,
                env=os.environ.copy(),
            )

            cls._stdout_thread = threading.Thread(
                target=cls._consume_stream,
                args=(cls._process.stdout,),
                daemon=True,
                name="cloudflare-tunnel-stdout",
            )
            cls._stderr_thread = threading.Thread(
                target=cls._consume_stream,
                args=(cls._process.stderr,),
                daemon=True,
                name="cloudflare-tunnel-stderr",
            )
            cls._stdout_thread.start()
            cls._stderr_thread.start()
            cls._save_state(pid=cls._process.pid, running=True)
            return cls.get_status()

    @classmethod
    def stop(cls) -> Dict:
        with cls._lock:
            cls._sync_runtime_state()
            pid = cls._current_pid()
            process = cls._process if cls._process is not None and cls._process.poll() is None else None

            if process is not None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            elif pid:
                if os.name == "nt":
                    subprocess.run(
                        ["taskkill", "/PID", str(pid), "/T", "/F"],
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                else:
                    os.kill(pid, 15)

            cls._process = None
            cls._public_url = None
            cls._mode = None
            cls._started_at = None
            cls._last_error = None
            cls._recent_output.clear()
            cls._clear_state()
            return cls.get_status()
