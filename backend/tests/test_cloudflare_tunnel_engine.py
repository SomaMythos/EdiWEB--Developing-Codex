import os
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.cloudflare_tunnel_engine import CloudflareTunnelEngine


def test_extract_hostname_from_cloudflare_config_text():
    config_text = """
tunnel: abc123
credentials-file: C:\\Users\\Rafael\\.cloudflared\\abc123.json

ingress:
  - hostname: edi.seu-dominio.com
    service: http://localhost:3000
  - service: http_status:404
"""

    hostname = CloudflareTunnelEngine._extract_hostname_from_config_text(config_text)

    assert hostname == "edi.seu-dominio.com"


def test_parse_public_url_from_quick_tunnel_output():
    line = "INF Requesting new quick Tunnel on trycloudflare.com... your quick Tunnel has been created at https://fancy-zebra.trycloudflare.com"

    public_url = CloudflareTunnelEngine._parse_public_url_from_output(line)

    assert public_url == "https://fancy-zebra.trycloudflare.com"


def test_resolve_start_command_prefers_token(monkeypatch):
    monkeypatch.setenv("CLOUDFLARE_TUNNEL_TOKEN", "secret-token")
    monkeypatch.setattr(CloudflareTunnelEngine, "_cloudflared_bin", classmethod(lambda cls: Path(r"C:\cloudflare\cloudflared.exe")))
    monkeypatch.setattr(CloudflareTunnelEngine, "_known_public_url", classmethod(lambda cls: "https://edi.seu-dominio.com"))

    command, mode, public_url = CloudflareTunnelEngine._resolve_start_command()

    assert command == [
        r"C:\cloudflare\cloudflared.exe",
        "tunnel",
        "run",
        "--token",
        "secret-token",
    ]
    assert mode == "named-token"
    assert public_url == "https://edi.seu-dominio.com"

    monkeypatch.delenv("CLOUDFLARE_TUNNEL_TOKEN", raising=False)


def test_resolve_start_command_falls_back_to_quick_tunnel(monkeypatch, tmp_path):
    monkeypatch.delenv("CLOUDFLARE_TUNNEL_TOKEN", raising=False)
    monkeypatch.setenv("CLOUDFLARE_TARGET_URL", "http://localhost:3000")
    monkeypatch.setattr(CloudflareTunnelEngine, "_cloudflared_bin", classmethod(lambda cls: Path(r"C:\cloudflare\cloudflared.exe")))
    monkeypatch.setattr(CloudflareTunnelEngine, "_config_path", classmethod(lambda cls: tmp_path / "config.yml"))

    command, mode, public_url = CloudflareTunnelEngine._resolve_start_command()

    assert command == [
        r"C:\cloudflare\cloudflared.exe",
        "tunnel",
        "--url",
        "http://localhost:3000",
    ]
    assert mode == "quick"
    assert public_url is None
