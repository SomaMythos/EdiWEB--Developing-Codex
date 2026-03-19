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
        conn.execute("INSERT INTO goal_categories (name) VALUES ('Estudos')")
        conn.execute("INSERT INTO goal_categories (name) VALUES ('Saúde')")
        conn.commit()


def test_reports_daily_methods(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.analytics_engine.Database", lambda: Database(path=db_path))

    today = date.today()
    yesterday = today - timedelta(days=1)
    previous_month_older = today - timedelta(days=max(today.day, 8))

    with Database(path=db_path) as db:
        db.execute("INSERT INTO daily_logs (date) VALUES (?)", (today.isoformat(),))
        db.execute("INSERT INTO daily_logs (date) VALUES (?)", (yesterday.isoformat(),))

        db.execute(
            """
            INSERT INTO daily_activity_logs (daily_log_id, activity_id, duration, completed)
            VALUES (1, 1, 40, 1), (1, 2, 20, 1), (2, 1, 15, 1)
            """
        )

        db.execute(
            """
            INSERT INTO goals (title, status, category_id, completed_at)
            VALUES
              ('Meta 1', 'concluida', 1, ?),
              ('Meta 2', 'concluida', 1, ?),
              ('Meta 3', 'concluida', 2, ?),
              ('Meta 4', 'concluida', NULL, ?),
              ('Meta 5', 'ativa', 2, NULL)
            """,
            (
                today.isoformat(),
                (today - timedelta(days=1)).isoformat(),
                today.isoformat(),
                previous_month_older.isoformat(),
            ),
        )

    overview = AnalyticsEngine.daily_overview()
    streaks = AnalyticsEngine.streaks_summary()
    timeseries = AnalyticsEngine.daily_timeseries(7)
    detail = AnalyticsEngine.activity_detail(1)
    goals_summary = AnalyticsEngine.goals_summary_report()

    assert overview["today"]["completed"] == 2
    assert overview["week"]["completed"] == 3
    assert streaks["current_activity_streak"] == 2
    assert streaks["current_perfect_daily_streak"] == 2
    assert len(timeseries) == 2
    assert detail["activity"]["title"] == "Leitura"
    assert detail["week"]["completed"] == 2
    assert detail["month"]["total_duration"] == 55

    assert goals_summary["completed_week"] == 3
    assert goals_summary["completed_month"] == 3
    assert goals_summary["ranking"]["most_completed"]["category"] == "Estudos"
    assert goals_summary["ranking"]["least_completed"]["category"] == "Sem categoria"


def test_hobbies_log_aggregation(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.analytics_engine.Database", lambda: Database(path=db_path))

    with Database(path=db_path) as db:
        db.execute("INSERT INTO paintings (title, created_at, finished_at, status) VALUES ('Lago', '2026-01-01T10:00:00', '2026-01-03T18:00:00', 'concluida')")
        db.execute("INSERT INTO painting_progress (painting_id, update_title, time_spent, timestamp) VALUES (1, 'Base pronta', 40, '2026-01-02T09:30:00')")

        db.execute("INSERT INTO books (title, status, created_at, finished_at, total_pages, current_page) VALUES ('Duna', 'concluido', '2026-01-01T08:00:00', '2026-01-04T22:00:00', 500, 500)")
        db.execute("INSERT INTO reading_sessions (book_id, pages_read, start_page, end_page, duration, date, read_at) VALUES (1, 35, 10, 45, 55, '2026-01-02', '2026-01-02T20:00:00')")

        db.execute("INSERT INTO watch_categories (name) VALUES ('Filme')")
        db.execute("INSERT INTO watch_items (category_id, name, watched_at) VALUES (1, 'Interstellar', '2026-01-03T21:00:00')")

        db.execute("INSERT INTO music_artists (name) VALUES ('Muse')")
        db.execute("INSERT INTO music_training_tabs (name, instrument, image_path) VALUES ('Escalas', 'guitar', 'img.png')")
        db.execute("INSERT INTO music_training_sessions (training_id, bpm, created_at) VALUES (1, 120, '2026-01-03T07:00:00')")
        db.execute("INSERT INTO music_albums (artist_id, name, status, created_at) VALUES (1, 'Absolution', 'listened', '2026-01-03T23:00:00')")

    events = AnalyticsEngine.hobbies_log(limit=20)
    leitura_events = AnalyticsEngine.hobbies_log(limit=20, modules=['leitura'])

    assert events
    assert all({'timestamp', 'module', 'event_type', 'title', 'details'} <= set(item.keys()) for item in events)
    assert any(item['event_type'] == 'painting_progress' for item in events)
    assert any(item['event_type'] == 'book_finished' for item in events)
    assert any(item['event_type'] == 'watch_completed' for item in events)
    assert any(item['event_type'] == 'album_listened_confirmation' for item in events)

    assert leitura_events
    assert all(item['module'] == 'leitura' for item in leitura_events)
