from pathlib import Path
import asyncio
import sqlite3
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import (
    StudyPlaylistCreatePayload,
    StudyTopicPayload,
    StudyVideoCreatePayload,
    StudyVideoUpdatePayload,
    create_study_playlist,
    create_study_topic,
    create_study_video,
    get_study_topic,
    update_study_video,
)


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def test_study_topic_video_progress_and_completion_flow(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.study_engine.Database", lambda: Database(path=db_path))

    created_topic = asyncio.run(
        create_study_topic(
            StudyTopicPayload(
                title="React avançado",
                description="Hooks, estado e arquitetura.",
            )
        )
    )

    created_video = asyncio.run(
        create_study_video(
            created_topic["data"]["id"],
            StudyVideoCreatePayload(
                title="Aula 01",
                source_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            ),
        )
    )

    updated_video = asyncio.run(
        update_study_video(
            created_video["data"]["id"],
            StudyVideoUpdatePayload(
                notes="Revisar useDeferredValue depois.",
                current_seconds=120,
                duration_seconds=600,
            ),
        )
    )

    completed_video = asyncio.run(
        update_study_video(
            created_video["data"]["id"],
            StudyVideoUpdatePayload(is_completed=True),
        )
    )

    topic_detail = asyncio.run(get_study_topic(created_topic["data"]["id"]))

    assert created_topic["data"]["title"] == "React avançado"
    assert created_video["data"]["provider"] == "youtube"
    assert "youtube.com/embed/dQw4w9WgXcQ" in created_video["data"]["embed_url"]
    assert updated_video["data"]["progress_percent"] == 20
    assert updated_video["data"]["notes"] == "Revisar useDeferredValue depois."
    assert completed_video["data"]["is_completed"] is True
    assert completed_video["data"]["progress_percent"] == 100
    assert completed_video["data"]["completed_at"] is not None
    assert topic_detail["data"]["total_videos"] == 1
    assert topic_detail["data"]["completed_videos"] == 1
    assert topic_detail["data"]["videos"][0]["display_title"] == "Aula 01"


def test_study_video_uses_url_based_title_when_manual_title_is_blank(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.study_engine.Database", lambda: Database(path=db_path))

    created_topic = asyncio.run(
        create_study_topic(
            StudyTopicPayload(
                title="Estudos soltos",
                description="Captura de titulo automatica.",
            )
        )
    )

    created_video = asyncio.run(
        create_study_video(
            created_topic["data"]["id"],
            StudyVideoCreatePayload(
                title="",
                source_url="https://cdn.example.com/uploads/curso-react-moderno.mp4",
            ),
        )
    )

    assert created_video["data"]["title"] == "curso react moderno"
    assert created_video["data"]["display_title"] == "curso react moderno"


def test_study_playlist_creates_video_by_video_and_skips_duplicates(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.study_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "core.study_engine.StudyEngine._fetch_youtube_playlist_items",
        staticmethod(
            lambda _source_url: [
                {"title": "Parte 1", "source_url": "https://www.youtube.com/watch?v=vid001"},
                {"title": "Parte 2", "source_url": "https://www.youtube.com/watch?v=vid002"},
                {"title": "Parte 2 repetida", "source_url": "https://www.youtube.com/watch?v=vid002"},
            ]
        ),
    )

    created_topic = asyncio.run(
        create_study_topic(
            StudyTopicPayload(
                title="HTML e CSS",
                description="Playlist completa.",
            )
        )
    )

    playlist_result = asyncio.run(
        create_study_playlist(
            created_topic["data"]["id"],
            StudyPlaylistCreatePayload(source_url="https://www.youtube.com/playlist?list=PL123456"),
        )
    )
    topic_detail = asyncio.run(get_study_topic(created_topic["data"]["id"]))

    assert playlist_result["data"]["created_count"] == 2
    assert playlist_result["data"]["skipped_count"] == 1
    assert [video["display_title"] for video in playlist_result["data"]["created_videos"]] == ["Parte 1", "Parte 2"]
    assert topic_detail["data"]["total_videos"] == 2
