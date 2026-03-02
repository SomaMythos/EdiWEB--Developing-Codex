from datetime import date, timedelta
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.analytics_engine import AnalyticsEngine
from data.database import Database


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO activities (title) VALUES ('Leitura')")
        conn.execute("INSERT INTO activities (title) VALUES ('Treino')")
        conn.commit()


def test_reports_daily_methods(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.analytics_engine.Database", lambda: Database(path=db_path))

    today = date.today()
    yesterday = today - timedelta(days=1)

    with Database(path=db_path) as db:
        db.execute("INSERT INTO daily_logs (date) VALUES (?)", (today.isoformat(),))
        db.execute("INSERT INTO daily_logs (date) VALUES (?)", (yesterday.isoformat(),))

        db.execute(
            """
            INSERT INTO daily_activity_logs (daily_log_id, activity_id, duration, completed)
            VALUES (1, 1, 40, 1), (1, 2, 20, 1), (2, 1, 15, 1)
            """
        )

    overview = AnalyticsEngine.daily_overview()
    streaks = AnalyticsEngine.streaks_summary()
    timeseries = AnalyticsEngine.daily_timeseries(7)
    detail = AnalyticsEngine.activity_detail(1)

    assert overview["today"]["completed"] == 2
    assert overview["week"]["completed"] == 3
    assert streaks["current_activity_streak"] == 2
    assert streaks["current_perfect_daily_streak"] == 2
    assert len(timeseries) == 2
    assert detail["activity"]["title"] == "Leitura"
    assert detail["week"]["completed"] == 2
    assert detail["month"]["total_duration"] == 55
