import sqlite3
from pathlib import Path

from core.daily_discipline_engine import DailyDisciplineEngine
from data.database import Database


class _FakeDatabase:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def fetchall(self, query, params=None):
        return [
            {
                "id": 1,
                "title": "Flex",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "flex",
                "intercalate_days": None,
                "fixed_time": "08:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 2,
                "title": "Everyday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "everyday",
                "intercalate_days": None,
                "fixed_time": "09:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 3,
                "title": "Workday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "workday",
                "intercalate_days": None,
                "fixed_time": "10:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 4,
                "title": "Offday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "offday",
                "intercalate_days": None,
                "fixed_time": "11:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
        ]


def test_frequency_filter_respects_weekend_overridden_to_work(monkeypatch):
    monkeypatch.setattr("core.daily_discipline_engine.Database", _FakeDatabase)
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-02-22", 10)

    ids = [item["id"] for item in result]
    assert ids == [1, 2, 3]


def test_frequency_filter_respects_weekday_overridden_to_off(monkeypatch):
    monkeypatch.setattr("core.daily_discipline_engine.Database", _FakeDatabase)
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "off",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-02-18", 10)

    ids = [item["id"] for item in result]
    assert ids == [1, 2, 4]


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def test_intercalate_frequency_waits_minimum_days_after_last_registration(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

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
            ("Lavar Roupas", 30, 30, "intercalate", 5, "08:00", 10, 1, 0),
        )
        db.execute("INSERT INTO daily_logs (date) VALUES (?)", ("2026-04-03",))
        db.execute(
            """
            INSERT INTO daily_activity_logs (daily_log_id, activity_id, duration, completed, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (1, 1, 30, 1, "08:00:00"),
        )

    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result_before = DailyDisciplineEngine.build_today_activity_list("2026-04-07", 10)
    result_after = DailyDisciplineEngine.build_today_activity_list("2026-04-08", 10)

    assert result_before == []
    assert [item["title"] for item in result_after] == ["Lavar Roupas"]
