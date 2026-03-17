from pathlib import Path
import asyncio
import sqlite3
import sys

from starlette.requests import Request


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import (
    WishItemPayload,
    WishItemUpdatePayload,
    shopping_wishlist,
    shopping_wishlist_create,
    shopping_wishlist_update,
)


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def _fake_request():
    return Request(
        {
            "type": "http",
            "scheme": "http",
            "server": ("127.0.0.1", 8000),
            "headers": [(b"host", b"127.0.0.1:8000")],
            "path": "/api/shopping/wishlist",
        }
    )


def test_shopping_wishlist_persists_remote_image_and_exposes_local_display_url(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.shopping_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "main._download_remote_image_to_uploads",
        lambda source_url, destination_dir: "uploads/remote_images/wishlist/persisted-image.jpg",
    )

    created = asyncio.run(
        shopping_wishlist_create(
            WishItemPayload(
                name="Curso HTML",
                price=99.9,
                link="https://example.com/curso",
                item_type="desejo",
                photo_url="https://cdn.example.com/course-cover.jpg",
            )
        )
    )
    listed = asyncio.run(shopping_wishlist(_fake_request()))

    assert created["success"] is True
    assert listed["data"][0]["photo_url"] == "uploads/remote_images/wishlist/persisted-image.jpg"
    assert listed["data"][0]["photo_display_url"].endswith("/uploads/remote_images/wishlist/persisted-image.jpg")


def test_shopping_wishlist_update_keeps_local_upload_path_without_redownload(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.shopping_engine.Database", lambda: Database(path=db_path))

    asyncio.run(
        shopping_wishlist_create(
            WishItemPayload(
                name="Mouse",
                price=150,
                link="https://example.com/mouse",
                item_type="necessidade",
                photo_url=None,
            )
        )
    )

    download_calls = []

    def _fake_download(source_url, destination_dir):
        download_calls.append(source_url)
        return source_url

    monkeypatch.setattr("main._download_remote_image_to_uploads", _fake_download)

    updated = asyncio.run(
        shopping_wishlist_update(
            1,
            WishItemUpdatePayload(
                name="Mouse",
                price=150,
                link="https://example.com/mouse",
                item_type="necessidade",
                photo_url="uploads/remote_images/wishlist/local-file.jpg",
                is_marked=False,
            ),
        )
    )

    assert updated["success"] is True
    assert download_calls == ["uploads/remote_images/wishlist/local-file.jpg"]
