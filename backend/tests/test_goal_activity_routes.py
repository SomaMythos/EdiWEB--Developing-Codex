from pathlib import Path
import asyncio
import sqlite3
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import GoalActivityLink, link_goal_activity


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO goals (title) VALUES (?)", ("Meta de teste",))
        conn.commit()


def test_link_goal_activity_returns_404_when_activity_does_not_exist(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.goal_engine.Database", lambda: Database(path=db_path))

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            link_goal_activity(GoalActivityLink(goal_id=1, activity_id=999))
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Atividade 999 não encontrada"
