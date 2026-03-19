import asyncio
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    get_system_cloudflare_tunnel_status,
    start_system_cloudflare_tunnel,
    stop_system_cloudflare_tunnel,
)


def test_cloudflare_tunnel_routes_proxy_engine(monkeypatch):
    offline_status = {
        "status": "offline",
        "is_running": False,
        "public_url": None,
        "cloudflared_available": True,
    }
    online_status = {
        "status": "online",
        "is_running": True,
        "public_url": "https://edi-demo.trycloudflare.com",
        "cloudflared_available": True,
    }

    monkeypatch.setattr("main.CloudflareTunnelEngine.get_status", lambda: offline_status)
    monkeypatch.setattr("main.CloudflareTunnelEngine.start", lambda: online_status)
    monkeypatch.setattr("main.CloudflareTunnelEngine.stop", lambda: offline_status)

    status_response = asyncio.run(get_system_cloudflare_tunnel_status())
    start_response = asyncio.run(start_system_cloudflare_tunnel())
    stop_response = asyncio.run(stop_system_cloudflare_tunnel())

    assert status_response["success"] is True
    assert status_response["data"]["status"] == "offline"
    assert start_response["data"]["status"] == "online"
    assert start_response["data"]["public_url"] == "https://edi-demo.trycloudflare.com"
    assert stop_response["data"]["status"] == "offline"
