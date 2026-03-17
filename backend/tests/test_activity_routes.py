from pathlib import Path
import asyncio
import sqlite3
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import ActivityCreate, create_activity, update_activity


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def test_create_activity_accepts_everyday_fixed_schedule(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.activity_engine.Database", lambda: Database(path=db_path))

    result = asyncio.run(
        create_activity(
            ActivityCreate(
                title="Cafe da Manha",
                min_duration=30,
                max_duration=60,
                frequency_type="everyday",
                fixed_time="06:30",
                fixed_duration=30,
                is_disc=1,
                is_fun=0,
            )
        )
    )

    with Database(path=db_path) as db:
        activity = db.fetchone(
            """
            SELECT title, frequency_type, fixed_time, fixed_duration, is_disc, is_fun
            FROM activities
            WHERE title = ?
            """,
            ("Cafe da Manha",),
        )

    assert result == {"success": True, "message": "Activity created"}
    assert activity is not None
    assert activity["frequency_type"] == "everyday"
    assert activity["fixed_time"] == "06:30"
    assert activity["fixed_duration"] == 30
    assert activity["is_disc"] == 0
    assert activity["is_fun"] == 0


def test_create_activity_accepts_intercalate_frequency(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.activity_engine.Database", lambda: Database(path=db_path))

    result = asyncio.run(
        create_activity(
            ActivityCreate(
                title="Lavar Roupas",
                min_duration=20,
                max_duration=40,
                frequency_type="intercalate",
                intercalate_days=5,
                is_disc=1,
                is_fun=0,
            )
        )
    )

    with Database(path=db_path) as db:
        activity = db.fetchone(
            """
            SELECT title, frequency_type, intercalate_days, is_disc, is_fun
            FROM activities
            WHERE title = ?
            """,
            ("Lavar Roupas",),
        )

    assert result == {"success": True, "message": "Activity created"}
    assert activity is not None
    assert activity["frequency_type"] == "intercalate"
    assert activity["intercalate_days"] == 5
    assert activity["is_disc"] == 0
    assert activity["is_fun"] == 0


def test_update_activity_persists_new_values(monkeypatch, tmp_path):
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
            ("Leitura", 20, 30, "flex", None, None, None, 1, 0),
        )

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.activity_engine.Database", lambda: Database(path=db_path))

    result = asyncio.run(
        update_activity(
            1,
            ActivityCreate(
                title="Leitura profunda",
                min_duration=25,
                max_duration=45,
                frequency_type="everyday",
                fixed_time="07:15",
                fixed_duration=25,
                is_disc=1,
                is_fun=1,
            )
        )
    )

    with Database(path=db_path) as db:
        activity = db.fetchone(
            """
            SELECT title, min_duration, max_duration, frequency_type, fixed_time, fixed_duration, is_disc, is_fun
            FROM activities
            WHERE id = 1
            """
        )

    assert result == {"success": True, "message": "Activity updated"}
    assert activity["title"] == "Leitura profunda"
    assert activity["min_duration"] == 25
    assert activity["max_duration"] == 45
    assert activity["frequency_type"] == "everyday"
    assert activity["fixed_time"] == "07:15"
    assert activity["fixed_duration"] == 25
    assert activity["is_disc"] == 0
    assert activity["is_fun"] == 0
