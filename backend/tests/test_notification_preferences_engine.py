from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.notification_center_engine import NotificationCenterEngine
from data.database import Database


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def _configure_temp_db(monkeypatch, db_path: Path):
    monkeypatch.setattr("core.notification_center_engine.Database", lambda: Database(path=db_path))


def _mock_goal_engine(monkeypatch):
    monkeypatch.setattr(
        "core.notification_center_engine.GoalEngine.list_goals",
        lambda: [{"id": 1, "title": "Meta de teste", "deadline": None}],
    )
    monkeypatch.setattr("core.notification_center_engine.GoalEngine.is_stalled", lambda _goal_id: True)
    monkeypatch.setattr("core.notification_center_engine.GoalEngine.calculate_progress", lambda _goal_id: 30)


def test_feature_disabled_does_not_generate_notification(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)
    _mock_goal_engine(monkeypatch)

    NotificationCenterEngine.save_preferences(
        [
            {
                "feature_key": "goals",
                "enabled": False,
                "channels": ["in_app", "sound"],
                "quiet_hours": None,
            }
        ]
    )

    NotificationCenterEngine._check_stalled_goals()

    notifications = NotificationCenterEngine.list_notifications(include_read=True)
    assert notifications == []


def test_feature_enabled_generates_notification(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)
    _mock_goal_engine(monkeypatch)

    NotificationCenterEngine.save_preferences(
        [
            {
                "feature_key": "goals",
                "enabled": True,
                "channels": ["in_app", "sound"],
                "quiet_hours": None,
            }
        ]
    )

    NotificationCenterEngine._check_stalled_goals()

    notifications = NotificationCenterEngine.list_notifications(include_read=True)
    assert len(notifications) == 1
    assert notifications[0]["source_feature"] == "goals"
    assert notifications[0]["notification_type"] == "stalled_goal"
