from pathlib import Path
import asyncio
import sqlite3
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import (
    BpmRequest,
    MusicTrainingExercisePayload,
    add_training_session,
    create_training_exercise,
    delete_music_training,
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
        measure_size=4,
        library_group="Aquecimento",
        difficulty=3,
        tags=["alternate picking", "coordenação"],
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
    asyncio.run(add_training_session(created["data"]["id"], BpmRequest(bpm=96)))
    asyncio.run(add_training_session(created["data"]["id"], BpmRequest(bpm=112)))
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
    assert created["data"]["exercise_data"]["measure_size"] == 4
    assert created["data"]["exercise_data"]["library_group"] == "Aquecimento"
    assert created["data"]["exercise_data"]["difficulty"] == 3
    assert created["data"]["exercise_data"]["tags"] == ["alternate picking", "coordenação"]
    assert listed["data"][0]["content_type"] == "exercise"
    assert listed["data"][0]["tuning"] == ["e", "B", "G", "D", "A", "E"]
    assert listed["data"][0]["session_count"] == 2
    assert listed["data"][0]["best_bpm"] == 112
    assert listed["data"][0]["average_bpm"] == 104.0
    assert listed["data"][0]["last_practiced_at"]
    assert updated["data"]["name"] == "Spider invertido"
    assert updated["data"]["target_bpm"] == 108


def test_music_training_exercise_delete(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.music_engine.Database", lambda: Database(path=db_path))

    created = asyncio.run(create_training_exercise(_sample_payload()))
    deleted = asyncio.run(delete_music_training(created["data"]["id"]))
    listed = asyncio.run(list_training())

    assert deleted["success"] is True
    assert listed["data"] == []
