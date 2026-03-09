from pathlib import Path
import asyncio
import json
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from core.notification_center_engine import NotificationCenterEngine
from main import PushDispatchPayload, PushReceiptsPayload, notifications_dispatch_push, notifications_refresh_push_receipts


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def _configure_temp_db(monkeypatch, db_path: Path):
    monkeypatch.setattr("core.notification_center_engine.Database", lambda: Database(path=db_path))


def _run(coro):
    return asyncio.run(coro)


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False


def test_dispatch_push_notifications_dry_run(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    NotificationCenterEngine.register_mobile_device("ExponentPushToken[test-1]", "expo", "Pixel")
    NotificationCenterEngine.create_custom_notification({
        "title": "Teste push",
        "message": "Mensagem de teste",
        "source_feature": "custom",
        "notification_type": "custom_notification",
    })

    result = _run(notifications_dispatch_push(PushDispatchPayload(dry_run=True)))

    assert result["success"] is True
    assert result["data"]["attempted"] == 1
    assert result["data"]["sent"] == 1
    assert result["data"]["dry_run"] is True

    with Database(path=db_path) as db:
        delivery = db.fetchone("SELECT status FROM notification_push_deliveries LIMIT 1")

    assert delivery["status"] == "dry_run"


def test_dispatch_push_notifications_sends_to_expo(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    monkeypatch.setattr(
        "core.notification_center_engine.urllib_request.urlopen",
        lambda request, timeout=15: _FakeResponse({"data": {"status": "ok", "id": "ticket-123"}}),
    )

    NotificationCenterEngine.register_mobile_device("ExponentPushToken[test-1]", "expo", "Pixel")
    NotificationCenterEngine.create_custom_notification({
        "title": "Teste push",
        "message": "Mensagem de teste",
        "source_feature": "custom",
        "notification_type": "custom_notification",
    })

    result = _run(notifications_dispatch_push(PushDispatchPayload(dry_run=False)))

    assert result["success"] is True
    assert result["data"]["attempted"] == 1
    assert result["data"]["sent"] == 1
    assert result["data"]["failed"] == 0

    with Database(path=db_path) as db:
        delivery = db.fetchone("SELECT status, ticket_id FROM notification_push_deliveries LIMIT 1")

    assert delivery["status"] == "sent"
    assert delivery["ticket_id"] == "ticket-123"


def test_dispatch_push_notifications_retries_transient_failure(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    NotificationCenterEngine.register_mobile_device("ExponentPushToken[test-1]", "expo", "Pixel")
    NotificationCenterEngine.create_custom_notification({
        "title": "Teste push",
        "message": "Mensagem de teste",
        "source_feature": "custom",
        "notification_type": "custom_notification",
    })
    NotificationCenterEngine._store_push_delivery(1, 1, status="failed", error_message="url_error:timeout", retry_count=1)

    monkeypatch.setattr(
        "core.notification_center_engine.urllib_request.urlopen",
        lambda request, timeout=15: _FakeResponse({"data": {"status": "ok", "id": "ticket-retry"}}),
    )

    result = _run(notifications_dispatch_push(PushDispatchPayload(dry_run=False)))
    assert result["data"]["retried"] == 1
    assert result["data"]["sent"] == 1

    with Database(path=db_path) as db:
        delivery = db.fetchone("SELECT status, ticket_id, retry_count FROM notification_push_deliveries LIMIT 1")

    assert delivery["status"] == "sent"
    assert delivery["ticket_id"] == "ticket-retry"
    assert delivery["retry_count"] == 1


def test_refresh_push_receipts_marks_invalid_device(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    NotificationCenterEngine.register_mobile_device("ExponentPushToken[test-1]", "expo", "Pixel")
    NotificationCenterEngine.create_custom_notification({
        "title": "Teste push",
        "message": "Mensagem de teste",
        "source_feature": "custom",
        "notification_type": "custom_notification",
    })
    NotificationCenterEngine._store_push_delivery(1, 1, status="sent", ticket_id="ticket-123", retry_count=0)

    monkeypatch.setattr(
        "core.notification_center_engine.urllib_request.urlopen",
        lambda request, timeout=15: _FakeResponse({"data": {"ticket-123": {"status": "error", "details": {"error": "DeviceNotRegistered"}}}}),
    )

    result = _run(notifications_refresh_push_receipts(PushReceiptsPayload(ticket_ids=["ticket-123"])))
    assert result["success"] is True
    assert result["data"]["checked"] == 1
    assert result["data"]["invalidated_devices"] == 1

    with Database(path=db_path) as db:
        delivery = db.fetchone("SELECT status, error_message FROM notification_push_deliveries LIMIT 1")
        device = db.fetchone("SELECT is_active FROM mobile_devices LIMIT 1")

    assert delivery["status"] == "receipt_error"
    assert "DeviceNotRegistered" in (delivery["error_message"] or "")
    assert device["is_active"] == 0
