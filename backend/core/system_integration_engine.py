import os
import subprocess
from ctypes import create_unicode_buffer, windll
from pathlib import Path
from typing import Optional


class SystemIntegrationEngine:
    REPO_ROOT = Path(__file__).resolve().parents[2]
    ICON_PATH = REPO_ROOT / "icon.ico"
    SILENT_LAUNCHER_PATH = REPO_ROOT / "start_edi_silent.vbs"
    SILENT_SCRIPT_PATH = REPO_ROOT / "scripts" / "start_edi_hidden.ps1"
    DESKTOP_SHORTCUT_NAME = "EDI Web.lnk"
    STARTUP_SHORTCUT_NAME = "EDI Web Startup.lnk"
    LAUNCH_URL = "http://localhost:3000"

    @staticmethod
    def _is_windows() -> bool:
        return os.name == "nt"

    @staticmethod
    def _known_folder(csidl: int, fallback: Path) -> Path:
        if os.name != "nt":
            return fallback

        buffer = create_unicode_buffer(260)
        result = windll.shell32.SHGetFolderPathW(None, csidl, None, 0, buffer)
        if result == 0 and buffer.value:
            return Path(buffer.value)
        return fallback

    @classmethod
    def _desktop_dir(cls) -> Path:
        return cls._known_folder(0x10, Path.home() / "Desktop")

    @classmethod
    def _startup_dir(cls) -> Path:
        fallback = Path(os.environ.get("APPDATA", Path.home())) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        return cls._known_folder(0x07, fallback)

    @classmethod
    def _shortcut_target(cls) -> Path:
        windir = Path(os.environ.get("WINDIR", r"C:\Windows"))
        return windir / "System32" / "wscript.exe"

    @staticmethod
    def _ps_quote(value: str) -> str:
        return value.replace("'", "''")

    @classmethod
    def _ensure_supported(cls):
        if not cls._is_windows():
            raise RuntimeError("Integração disponível apenas no Windows")
        if not cls.SILENT_LAUNCHER_PATH.exists():
            raise FileNotFoundError(f"Launcher silencioso não encontrado em {cls.SILENT_LAUNCHER_PATH}")
        if not cls.ICON_PATH.exists():
            raise FileNotFoundError(f"Ícone do projeto não encontrado em {cls.ICON_PATH}")

    @classmethod
    def _run_powershell(cls, command: str):
        completed = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                command,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            error = completed.stderr.strip() or completed.stdout.strip() or "Falha ao executar integração com o Windows"
            raise RuntimeError(error)

    @classmethod
    def _create_shortcut(
        cls,
        shortcut_path: Path,
        *,
        arguments: Optional[str] = None,
        description: str,
    ) -> str:
        cls._ensure_supported()
        shortcut_path.parent.mkdir(parents=True, exist_ok=True)

        target = cls._shortcut_target()
        quoted_arguments = arguments or f'"{cls.SILENT_LAUNCHER_PATH}"'
        command = f"""
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut('{cls._ps_quote(str(shortcut_path))}')
$shortcut.TargetPath = '{cls._ps_quote(str(target))}'
$shortcut.Arguments = '{cls._ps_quote(quoted_arguments)}'
$shortcut.WorkingDirectory = '{cls._ps_quote(str(cls.REPO_ROOT))}'
$shortcut.Description = '{cls._ps_quote(description)}'
$shortcut.IconLocation = '{cls._ps_quote(str(cls.ICON_PATH))},0'
$shortcut.WindowStyle = 7
$shortcut.Save()
"""
        cls._run_powershell(command)
        return str(shortcut_path)

    @classmethod
    def desktop_shortcut_path(cls) -> Path:
        return cls._desktop_dir() / cls.DESKTOP_SHORTCUT_NAME

    @classmethod
    def startup_shortcut_path(cls) -> Path:
        return cls._startup_dir() / cls.STARTUP_SHORTCUT_NAME

    @classmethod
    def get_status(cls):
        desktop_shortcut = cls.desktop_shortcut_path()
        startup_shortcut = cls.startup_shortcut_path()
        return {
            "supported": cls._is_windows(),
            "launch_url": cls.LAUNCH_URL,
            "desktop_shortcut_exists": desktop_shortcut.exists(),
            "desktop_shortcut_path": str(desktop_shortcut),
            "windows_startup_enabled": startup_shortcut.exists(),
            "windows_startup_path": str(startup_shortcut),
            "silent_launcher_path": str(cls.SILENT_LAUNCHER_PATH),
            "icon_path": str(cls.ICON_PATH),
        }

    @classmethod
    def create_desktop_shortcut(cls):
        shortcut_path = cls.desktop_shortcut_path()
        created_path = cls._create_shortcut(
            shortcut_path,
            description="Abrir o EDI Web em segundo plano com acesso pela bandeja do sistema",
        )
        return {
            **cls.get_status(),
            "desktop_shortcut_path": created_path,
        }

    @classmethod
    def set_windows_startup(cls, enabled: bool):
        shortcut_path = cls.startup_shortcut_path()
        if enabled:
            cls._create_shortcut(
                shortcut_path,
                description="Iniciar o EDI Web automaticamente ao entrar no Windows com acesso pela bandeja do sistema",
            )
        elif shortcut_path.exists():
            shortcut_path.unlink()

        return cls.get_status()
