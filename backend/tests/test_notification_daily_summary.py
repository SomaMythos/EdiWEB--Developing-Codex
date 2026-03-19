from datetime import date as real_date, datetime as real_datetime, timedelta, timezone
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.notification_center_engine import NotificationCenterEngine
from data.database import Database


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def _configure_temp_db(monkeypatch, db_path: Path):
    monkeypatch.setattr("core.notification_center_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.daily_log_engine.Database", lambda: Database(path=db_path))


class _FixedSummaryDate:
    @classmethod
    def today(cls):
        return real_date(2026, 3, 18)


class _FixedSummaryDateTime:
    LOCAL_TZ = timezone(timedelta(hours=-3))

    @classmethod
    def now(cls):
        return real_datetime(2026, 3, 18, 7, 30, tzinfo=cls.LOCAL_TZ)

    @classmethod
    def strptime(cls, value, fmt):
        return real_datetime.strptime(value, fmt)

    @classmethod
    def fromisoformat(cls, value):
        return real_datetime.fromisoformat(value)


def _seed_daily_log_with_activity(db_path: Path, *, completed: int):
    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Programar", 30, 30, "flex", None, None, None, 1, 0),
        )
        db.execute("INSERT INTO daily_logs (date) VALUES (?)", ("2026-03-18",))
        db.execute(
            """
            INSERT INTO daily_activity_logs (daily_log_id, activity_id, duration, completed, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (1, 1, 30, completed, "07:00:00"),
        )


def test_daily_summary_is_not_generated_for_zero_activities_and_cancels_invalid_existing(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)
    monkeypatch.setattr("core.notification_center_engine.date", _FixedSummaryDate)
    monkeypatch.setattr("core.daily_log_engine.date", _FixedSummaryDate)
    monkeypatch.setattr("core.notification_center_engine.datetime", _FixedSummaryDateTime)

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO notifications (
                notification_type,
                type,
                source_feature,
                title,
                message,
                severity,
                status,
                scheduled_for,
                meta,
                unique_key
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "daily_summary",
                "daily_summary",
                "daily",
                "Resumo diário",
                "Hoje você completou 0 de 0 atividades",
                "info",
                "unread",
                None,
                '{"date":"2026-03-18","total_activities":0,"completed_activities":0,"completion_rate":0}',
                "daily_summary:2026-03-18",
            ),
        )

    NotificationCenterEngine._store_daily_summary()

    with Database(path=db_path) as db:
        notification = db.fetchone(
            "SELECT status FROM notifications WHERE unique_key = ?",
            ("daily_summary:2026-03-18",),
        )

    assert notification["status"] == "canceled"


def test_daily_summary_is_scheduled_for_end_of_day_when_there_are_activities(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)
    monkeypatch.setattr("core.notification_center_engine.date", _FixedSummaryDate)
    monkeypatch.setattr("core.daily_log_engine.date", _FixedSummaryDate)
    monkeypatch.setattr("core.notification_center_engine.datetime", _FixedSummaryDateTime)

    _seed_daily_log_with_activity(db_path, completed=0)

    NotificationCenterEngine._store_daily_summary()

    notifications = NotificationCenterEngine.list_notifications(
        notification_type="daily_summary",
        include_read=True,
    )

    assert len(notifications) == 1
    assert notifications[0]["message"] == "Hoje você completou 0 de 1 atividades"
    assert notifications[0]["scheduled_for"].startswith("2026-03-18T23:59")
