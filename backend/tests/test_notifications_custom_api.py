from pathlib import Path
import asyncio
import sqlite3
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import (
    CustomNotificationPayload,
    NotificationStatusPayload,
    notifications_create_custom,
    notifications_update_custom,
    notifications_update_status,
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


def test_create_custom_notification_valid_payload(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    payload = CustomNotificationPayload(
        title="Aviso de revisão",
        message="Revisar planejamento semanal",
        scheduled_for="2026-01-01T09:30:00",
        severity="warning",
        sound_key="default",
        color_token="warning",
    )

    result = _run(notifications_create_custom(payload))
    assert result["success"] is True
    assert result["data"]["id"] == 1

    with Database(path=db_path) as db:
        created = db.fetchone("SELECT * FROM notifications WHERE id = 1")

    assert created["notification_type"] == "custom_notification"
    assert created["source_feature"] == "custom"
    assert created["status"] == "unread"
    assert created["title"] == "Aviso de revisão"


def test_create_custom_notification_invalid_payload():
    with pytest.raises(ValidationError):
        CustomNotificationPayload(
            title="   ",
            message="x" * 10,
            scheduled_for="2026-01-01T09:30:00",
        )

    with pytest.raises(ValidationError):
        CustomNotificationPayload(
            title="Título válido",
            message="x" * 501,
            scheduled_for="2026-01-01T09:30:00",
        )

    with pytest.raises(ValidationError):
        CustomNotificationPayload(
            title="Título válido",
            message="Mensagem válida",
            scheduled_for="not-a-date",
        )


def test_custom_notification_edit_and_status_flow(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    created_payload = CustomNotificationPayload(
        title="Lembrete inicial",
        message="Mensagem inicial",
        severity="info",
    )
    _run(notifications_create_custom(created_payload))

    updated_payload = CustomNotificationPayload(
        title="Lembrete editado",
        message="Mensagem editada",
        severity="success",
        sound_key="soft_chime",
        color_token="success",
    )
    update_result = _run(notifications_update_custom(1, updated_payload))
    assert update_result["success"] is True

    status_result = _run(notifications_update_status(1, NotificationStatusPayload(status="canceled")))
    assert status_result["success"] is True

    with Database(path=db_path) as db:
        updated = db.fetchone("SELECT * FROM notifications WHERE id = 1")

    assert updated["title"] == "Lembrete editado"
    assert updated["message"] == "Mensagem editada"
    assert updated["severity"] == "success"
    assert updated["status"] == "canceled"
