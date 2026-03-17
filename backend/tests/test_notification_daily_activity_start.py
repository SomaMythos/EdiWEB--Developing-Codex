from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.notification_center_engine import NotificationCenterEngine
from core.daily_engine import DailyEngine
from data.database import Database


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def _configure_temp_db(monkeypatch, db_path: Path):
    monkeypatch.setattr("core.notification_center_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.daily_engine.Database", lambda: Database(path=db_path))


def _seed_daily_block(db_path: Path, target_date: str, start_time: str, completed: int = 0):
    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO daily_plan_blocks (date, start_time, duration, source_type, block_name, completed)
            VALUES (?, ?, ?, 'fixed', 'Treino', ?)
            """,
            (target_date, start_time, 45, completed),
        )


class _FixedDateTime:
    @classmethod
    def now(cls):
        from datetime import datetime

        return datetime(2026, 3, 10, 9, 0, 0)

    @classmethod
    def strptime(cls, value, fmt):
        from datetime import datetime

        return datetime.strptime(value, fmt)

    @classmethod
    def fromisoformat(cls, value):
        from datetime import datetime

        return datetime.fromisoformat(value)


def test_generate_daily_activity_start_notification(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)
    monkeypatch.setattr("core.notification_center_engine.datetime", _FixedDateTime)

    _seed_daily_block(db_path, "2026-03-10", "08:50")

    NotificationCenterEngine._check_daily_routine_start_notifications(lookback_minutes=15)

    notifications = NotificationCenterEngine.list_notifications(include_read=True)
    assert len(notifications) == 1
    assert notifications[0]["notification_type"] == "daily_activity_start"
    assert notifications[0]["source_feature"] == "daily"


def test_does_not_generate_for_future_or_completed_block(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)
    monkeypatch.setattr("core.notification_center_engine.datetime", _FixedDateTime)

    _seed_daily_block(db_path, "2026-03-10", "09:10")
    _seed_daily_block(db_path, "2026-03-10", "08:55", completed=1)

    NotificationCenterEngine._check_daily_routine_start_notifications(lookback_minutes=15)

    notifications = NotificationCenterEngine.list_notifications(include_read=True)
    assert notifications == []


def test_notification_disappears_when_daily_block_is_completed(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)
    monkeypatch.setattr("core.notification_center_engine.datetime", _FixedDateTime)

    _seed_daily_block(db_path, "2026-03-10", "08:50")

    NotificationCenterEngine._check_daily_routine_start_notifications(lookback_minutes=15)

    unread_before = NotificationCenterEngine.list_notifications(
        notification_type="daily_activity_start",
        include_read=False,
    )
    assert len(unread_before) == 1

    DailyEngine.toggle_block_completion(1, True)

    unread_after = NotificationCenterEngine.list_notifications(
        notification_type="daily_activity_start",
        include_read=False,
    )
    completed_notifications = NotificationCenterEngine.list_notifications(
        notification_type="daily_activity_start",
        status="completed",
        include_read=True,
    )

    assert unread_after == []
    assert len(completed_notifications) == 1
