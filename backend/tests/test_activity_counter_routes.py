from pathlib import Path
import asyncio
import sqlite3
import sys
from datetime import date


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import ActivityCounterCreate, complete_activity_counter, create_activity_counter, list_activity_counters


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


class _FakeDate(date):
    @classmethod
    def today(cls):
        return cls(2026, 4, 8)


def test_create_and_complete_activity_counter(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.activity_counter_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.activity_counter_engine.date", _FakeDate)

    created = asyncio.run(
        create_activity_counter(
            ActivityCounterCreate(title="Lavar roupas")
        )
    )

    with Database(path=db_path) as db:
        db.execute(
            """
            UPDATE activity_counters
            SET started_at = ?
            WHERE id = 1
            """,
            ("2026-04-03",),
        )

    completed = asyncio.run(complete_activity_counter(1))

    assert created["success"] is True
    assert created["data"]["title"] == "Lavar roupas"
    assert created["data"]["started_at"] == "2026-04-08"
    assert created["data"]["completed_at"] is None

    assert completed["success"] is True
    assert completed["data"]["elapsed_days"] == 5


def test_list_activity_counters_returns_average_by_title(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO activity_counters (
                title,
                started_at,
                completed_at,
                elapsed_days
            ) VALUES (?, ?, ?, ?)
            """,
            ("Lavar roupas", "2026-04-03", "2026-04-08", 5),
        )
        db.execute(
            """
            INSERT INTO activity_counters (
                title,
                started_at,
                completed_at,
                elapsed_days
            ) VALUES (?, ?, ?, ?)
            """,
            ("Lavar roupas", "2026-04-10", "2026-04-14", 4),
        )
        db.execute(
            """
            INSERT INTO activity_counters (
                title,
                started_at
            ) VALUES (?, ?)
            """,
            ("Lavar roupas", "2026-04-20"),
        )

    monkeypatch.setattr("core.activity_counter_engine.Database", lambda: Database(path=db_path))

    result = asyncio.run(list_activity_counters())

    assert result["success"] is True
    assert result["data"]["summary"]["open_count"] == 1
    assert result["data"]["summary"]["completed_count"] == 2
    assert result["data"]["items"][0]["is_completed"] is False
    assert result["data"]["items"][0]["completed_cycles"] == 2
    assert result["data"]["items"][0]["average_elapsed_days"] == 4.5
    assert result["data"]["summary"]["averages"][0]["title"] == "Lavar roupas"
