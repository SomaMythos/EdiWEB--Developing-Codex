import asyncio
import sqlite3
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database, apply_migrations
from main import update_watch_item
from core.watch_engine import WatchEngine


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()

    with Database(path=db_path) as db:
        apply_migrations(db)


def test_watch_engine_update_keeps_existing_image_when_none(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.watch_engine.Database", lambda: Database(path=db_path))

    item = WatchEngine.create_item(
        name="Solo Leveling",
        image_path="uploads/watch/solo-leveling.png",
        media_type="anime",
        status="watching",
    )

    updated = WatchEngine.update_item(
        item["id"],
        current_episode=7,
        image_path=None,
    )

    assert updated["image_path"] == "uploads/watch/solo-leveling.png"
    assert updated["current_episode"] == 7


def test_update_watch_item_route_does_not_overwrite_image_without_upload(monkeypatch):
    payload = {}

    def _fake_update_item(item_id, **changes):
        payload["item_id"] = item_id
        payload.update(changes)
        return {"id": item_id, "image_path": "uploads/watch/existing.png"}

    monkeypatch.setattr("main.WatchEngine.update_item", _fake_update_item)

    response = asyncio.run(
        update_watch_item(
            item_id=9,
            category_id=None,
            name="Blue Lock",
            media_type="anime",
            status="watching",
            description=None,
            watch_with=None,
            total_seasons=None,
            total_episodes=None,
            current_season=1,
            current_episode=12,
            image=None,
        )
    )

    assert response["success"] is True
    assert payload["item_id"] == 9
    assert "image_path" not in payload
    assert response["data"]["image_path"] == "uploads/watch/existing.png"
