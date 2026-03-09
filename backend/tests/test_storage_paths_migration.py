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

    conn = sqlite3.connect(legacy_db)
    try:
        conn.execute("CREATE TABLE example (id INTEGER PRIMARY KEY, value TEXT)")
        conn.execute("INSERT INTO example (value) VALUES ('ok')")
        conn.commit()
    finally:
        conn.close()

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


def test_database_migrates_from_cwd_path(monkeypatch, tmp_path):
    storage_dir = tmp_path / "persist"
    legacy_db = tmp_path / "lifemanager.db"

    conn = sqlite3.connect(legacy_db)
    try:
        conn.execute("CREATE TABLE example (id INTEGER PRIMARY KEY, value TEXT)")
        conn.execute("INSERT INTO example (value) VALUES ('cwd')")
        conn.commit()
    finally:
        conn.close()

    monkeypatch.setenv("EDI_STORAGE_DIR", str(storage_dir))
    monkeypatch.chdir(tmp_path)

    with Database() as db:
        row = db.fetchone("SELECT value FROM example WHERE id = 1")

    assert row["value"] == "cwd"
    assert (storage_dir / "lifemanager.db").exists()
    assert not legacy_db.exists()


def test_password_config_migrates_from_cwd_path(monkeypatch, tmp_path):
    storage_dir = tmp_path / "persist"
    legacy_auth = tmp_path / "auth_config.json"
    legacy_auth.write_text(
        json.dumps({"version": 1, "salt": "c2FsdA==", "password_hash": "cwdhash"}),
        encoding="utf-8",
    )

    monkeypatch.setenv("EDI_STORAGE_DIR", str(storage_dir))
    monkeypatch.chdir(tmp_path)

    target_auth = auth_engine._password_config_path()

    assert target_auth.exists()
    assert json.loads(target_auth.read_text(encoding="utf-8"))["password_hash"] == "cwdhash"
    assert not legacy_auth.exists()


def test_initial_password_is_bootstrapped_in_persistent_storage(monkeypatch, tmp_path):
    storage_dir = tmp_path / "persist"
    monkeypatch.setenv("EDI_STORAGE_DIR", str(storage_dir))
    monkeypatch.delenv("EDI_DEFAULT_PASSWORD", raising=False)

    config = auth_engine._load_or_create_password_config()

    bootstrap_file = storage_dir / "auth_password.txt"
    assert bootstrap_file.exists()
    generated_password = bootstrap_file.read_text(encoding="utf-8").strip()
    assert generated_password
    assert auth_engine.verify_password(generated_password)
    assert config["password_hash"]


def test_env_default_password_skips_bootstrap_file(monkeypatch, tmp_path):
    storage_dir = tmp_path / "persist"
    monkeypatch.setenv("EDI_STORAGE_DIR", str(storage_dir))
    monkeypatch.setenv("EDI_DEFAULT_PASSWORD", "senha-do-ambiente")

    auth_engine._load_or_create_password_config()

    assert auth_engine.verify_password("senha-do-ambiente")
    assert not (storage_dir / "auth_password.txt").exists()


def test_bootstrap_password_file_can_be_edited_after_first_start(monkeypatch, tmp_path):
    storage_dir = tmp_path / "persist"
    monkeypatch.setenv("EDI_STORAGE_DIR", str(storage_dir))
    monkeypatch.delenv("EDI_DEFAULT_PASSWORD", raising=False)

    auth_engine._load_or_create_password_config()

    bootstrap_file = storage_dir / "auth_password.txt"
    bootstrap_file.write_text("minha-nova-senha\n", encoding="utf-8")

    assert auth_engine.verify_password("minha-nova-senha")
    assert not auth_engine.verify_password("senha-antiga")


def test_update_password_updates_bootstrap_password_file(monkeypatch, tmp_path):
    storage_dir = tmp_path / "persist"
    monkeypatch.setenv("EDI_STORAGE_DIR", str(storage_dir))
    monkeypatch.delenv("EDI_DEFAULT_PASSWORD", raising=False)

    auth_engine._load_or_create_password_config()

    bootstrap_file = storage_dir / "auth_password.txt"
    current_password = bootstrap_file.read_text(encoding="utf-8").strip()

    assert auth_engine.update_password(current_password, "senha-escolhida")
    assert bootstrap_file.read_text(encoding="utf-8").strip() == "senha-escolhida"
    assert auth_engine.verify_password("senha-escolhida")
