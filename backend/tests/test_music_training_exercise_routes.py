from pathlib import Path
import asyncio
import sqlite3
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import (
    MusicTrainingExercisePayload,
    create_training_exercise,
    list_training,
    update_training_exercise,
)


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def _sample_payload(name="Spider 1-2-3-4", bpm=92):
    return MusicTrainingExercisePayload(
        name=name,
        instrument="guitar",
        target_bpm=bpm,
        tuning=["e", "B", "G", "D", "A", "E"],
        columns=8,
        cells=[
            ["1", "2", "3", "4", "", "", "", ""],
            ["1", "2", "3", "4", "", "", "", ""],
            ["1", "2", "3", "4", "", "", "", ""],
            ["1", "2", "3", "4", "", "", "", ""],
            ["1", "2", "3", "4", "", "", "", ""],
            ["1", "2", "3", "4", "", "", "", ""],
        ],
        notes="Palhetada alternada.",
    )


def test_music_training_exercise_create_and_update(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.music_engine.Database", lambda: Database(path=db_path))

    created = asyncio.run(create_training_exercise(_sample_payload()))
    listed = asyncio.run(list_training())
    updated = asyncio.run(
        update_training_exercise(
            created["data"]["id"],
            _sample_payload(name="Spider invertido", bpm=108),
        )
    )

    assert created["success"] is True
    assert created["data"]["content_type"] == "exercise"
    assert created["data"]["target_bpm"] == 92
    assert created["data"]["exercise_data"]["columns"] == 8
    assert listed["data"][0]["content_type"] == "exercise"
    assert listed["data"][0]["tuning"] == ["e", "B", "G", "D", "A", "E"]
    assert updated["data"]["name"] == "Spider invertido"
    assert updated["data"]["target_bpm"] == 108
