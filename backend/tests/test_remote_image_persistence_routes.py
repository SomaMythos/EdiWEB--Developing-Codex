from pathlib import Path
import asyncio
import sqlite3
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.book_engine import BookEngine
from core.user_profile_engine import UserProfileEngine
from data.database import Database
from main import BookPayload, ProfilePayload, books_create, profile_save


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def test_books_create_persists_remote_cover_image(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.book_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "main._download_remote_image_to_uploads",
        lambda source_url, destination_dir: "uploads/remote_images/books/clean-code.jpg",
    )

    created = asyncio.run(
        books_create(
            BookPayload(
                title="Clean Code",
                total_pages=464,
                book_type="Livro",
                cover_image="https://cdn.example.com/covers/clean-code.jpg",
            )
        )
    )
    saved_book = BookEngine.list_books()[0]

    assert created["success"] is True
    assert saved_book["cover_image"] == "uploads/remote_images/books/clean-code.jpg"


def test_profile_save_persists_remote_profile_photo(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("main.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.user_profile_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "main._download_remote_image_to_uploads",
        lambda source_url, destination_dir: "uploads/remote_images/profile/avatar.jpg",
    )

    saved = asyncio.run(
        profile_save(
            ProfilePayload(
                name="Rafael",
                birth_date="1990-01-01",
                height=180,
                gender="masculino",
                photo_path="https://cdn.example.com/profile/avatar.jpg",
            )
        )
    )
    profile = UserProfileEngine.get_profile()

    assert saved["success"] is True
    assert profile["photo_path"] == "uploads/remote_images/profile/avatar.jpg"
