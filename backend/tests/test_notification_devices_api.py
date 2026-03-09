from pathlib import Path
import asyncio
import sqlite3
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import (
    MobileDevicePayload,
    notifications_delete_device,
    notifications_list_devices,
    notifications_register_device,
)


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def _configure_temp_db(monkeypatch, db_path: Path):
    monkeypatch.setattr("core.notification_center_engine.Database", lambda: Database(path=db_path))


def _run(coro):
    return asyncio.run(coro)


def test_notifications_device_registration_flow(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    payload = MobileDevicePayload(device_token="ExponentPushToken[test-1]", platform="expo", device_name="Pixel")
    created = _run(notifications_register_device(payload))
    listed = _run(notifications_list_devices())

    assert created["success"] is True
    assert created["data"]["device_token"] == "ExponentPushToken[test-1]"
    assert listed["success"] is True
    assert len(listed["data"]) == 1
    assert listed["data"][0]["platform"] == "expo"

    assert _run(notifications_delete_device("ExponentPushToken[test-1]")) == {"success": True}
    listed_after = _run(notifications_list_devices())
    assert listed_after["data"] == []


def test_notifications_delete_device_returns_404_when_missing(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    with pytest.raises(HTTPException) as exc_info:
        _run(notifications_delete_device("missing-token"))

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "device_not_found"
