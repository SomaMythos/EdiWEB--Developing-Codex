from pathlib import Path
import json
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import core.auth_engine as auth_engine
import data.database as database_module
from data.database import Database


def test_database_migrates_from_legacy_backend_path(monkeypatch, tmp_path):
    storage_dir = tmp_path / "persist"
    legacy_db = tmp_path / "legacy" / "lifemanager.db"
    legacy_db.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(legacy_db) as conn:
        conn.execute("CREATE TABLE example (id INTEGER PRIMARY KEY, value TEXT)")
        conn.execute("INSERT INTO example (value) VALUES ('ok')")
        conn.commit()

    monkeypatch.setenv("EDI_STORAGE_DIR", str(storage_dir))
    monkeypatch.setattr(database_module, "_legacy_database_paths", lambda: [legacy_db])

    with Database() as db:
        row = db.fetchone("SELECT value FROM example WHERE id = 1")

    target_db = storage_dir / "lifemanager.db"
    assert target_db.exists()
    assert not legacy_db.exists()
    assert row["value"] == "ok"


def test_password_config_migrates_from_legacy_backend_path(monkeypatch, tmp_path):
    storage_dir = tmp_path / "persist"
    legacy_auth = tmp_path / "legacy" / "auth_config.json"
    legacy_auth.parent.mkdir(parents=True, exist_ok=True)
    legacy_auth.write_text(
        json.dumps({"version": 1, "salt": "c2FsdA==", "password_hash": "abc"}),
        encoding="utf-8",
    )

    monkeypatch.setenv("EDI_STORAGE_DIR", str(storage_dir))
    monkeypatch.setattr(auth_engine, "_legacy_password_config_paths", lambda: [legacy_auth])

    target_auth = auth_engine._password_config_path()

    assert target_auth.exists()
    assert not legacy_auth.exists()
    assert json.loads(target_auth.read_text(encoding="utf-8"))["password_hash"] == "abc"
