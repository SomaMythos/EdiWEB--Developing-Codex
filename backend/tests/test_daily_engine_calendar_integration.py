from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.daily_engine import DailyEngine
from data.database import Database


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.execute(
            """
            UPDATE daily_config
            SET sleep_start = '23:00',
                sleep_end = '07:00',
                work_start = '09:00',
                work_end = '18:00',
                buffer_between = 10,
                granularity_min = 5,
                discipline_weight = 5,
                fun_weight = 5,
                avoid_category_adjacent = 0
            WHERE id = 1
            """
        )
        conn.commit()


def test_get_day_includes_calendar_event_blocks(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.daily_engine.Database", lambda: Database(path=db_path))

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO calendar_events (event_date, title, description, start_time, end_time, is_completed)
            VALUES ('2026-03-20', 'Consulta médica', 'Retorno', '15:00', '16:30', 0)
            """
        )

    blocks = DailyEngine.get_day("2026-03-20")
    summary = DailyEngine.get_day_summary("2026-03-20")

    assert len(blocks) == 1
    assert blocks[0]["source_type"] == "calendar"
    assert blocks[0]["activity_title"] == "Consulta médica"
    assert blocks[0]["start_time"] == "15:00"
    assert blocks[0]["duration"] == 90
    assert summary["total_blocks"] == 1
    assert summary["completed_blocks"] == 0


def test_generate_day_treats_calendar_event_as_fixed_reservation(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.daily_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO calendar_events (event_date, title, start_time, end_time, is_completed)
            VALUES ('2026-03-20', 'Dentista', '14:00', '15:00', 0)
            """
        )

    captured = {}

    def fake_schedule(fixed_events, templates, **kwargs):
        captured["fixed_events"] = fixed_events
        captured["templates"] = templates
        return {"scheduled": [], "not_scheduled": [], "diagnostics": {}}

    monkeypatch.setattr("core.daily_engine.generate_day_schedule", fake_schedule)
    monkeypatch.setattr("core.daily_engine.DailyDisciplineEngine.build_today_activity_list", lambda *_args, **_kwargs: [])

    DailyEngine.generate_day("2026-03-20")

    calendar_fixed = [item for item in captured["fixed_events"] if item["id"] == "calendar_event:1"]
    assert len(calendar_fixed) == 1
    assert calendar_fixed[0]["start_hm"] == "14:00"
    assert calendar_fixed[0]["end_hm"] == "15:00"
    assert calendar_fixed[0]["category"] == "calendar"


def test_generate_day_uses_neutral_category_for_everyday_and_fixed_activities(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.daily_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))

    captured = {}

    def fake_schedule(fixed_events, templates, **kwargs):
        captured["fixed_events"] = fixed_events
        captured["templates"] = templates
        return {"scheduled": [], "not_scheduled": [], "diagnostics": {}}

    monkeypatch.setattr("core.daily_engine.generate_day_schedule", fake_schedule)
    monkeypatch.setattr(
        "core.daily_engine.DailyDisciplineEngine.build_today_activity_list",
        lambda *_args, **_kwargs: [
            {
                "id": 1,
                "title": "Treinar - Guitarra",
                "min_duration": 30,
                "max_duration": 45,
                "frequency_type": "everyday",
                "fixed_time": None,
                "fixed_duration": None,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 2,
                "title": "Cafe da Manha",
                "min_duration": 20,
                "max_duration": 20,
                "frequency_type": "workday",
                "fixed_time": "07:00",
                "fixed_duration": 20,
                "is_disc": 0,
                "is_fun": 1,
            },
        ],
    )

    DailyEngine.generate_day("2026-03-20")

    everyday_template = next(item for item in captured["templates"] if item["id"] == 1)
    fixed_activity = next(item for item in captured["fixed_events"] if item["id"] == "fixed_activity:2")

    assert everyday_template["category"] == "base"
    assert fixed_activity["category"] == "base"


def test_toggle_sleep_block_completion_updates_both_sleep_segments(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.daily_engine.Database", lambda: Database(path=db_path))

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO daily_plan_blocks (date, start_time, duration, source_type, block_name, block_category, completed, updated_source)
            VALUES
                ('2026-03-16', '00:00', 420, 'fixed', 'Dormir', 'sleep', 0, 'auto'),
                ('2026-03-16', '23:00', 60, 'fixed', 'Dormir', 'sleep', 0, 'auto')
            """
        )

    blocks_before = DailyEngine.get_day("2026-03-16")
    sleep_block_before = next(block for block in blocks_before if block["activity_title"] == "Dormir")
    assert bool(sleep_block_before["completed"]) is False
    assert sleep_block_before["linked_block_ids"] == [2, 1]

    DailyEngine.toggle_block_completion(2, True)

    with Database(path=db_path) as db:
        completion_rows = db.fetchall(
            """
            SELECT completed
            FROM daily_plan_blocks
            WHERE date = '2026-03-16' AND block_category = 'sleep'
            ORDER BY id
            """
        )

    assert [row["completed"] for row in completion_rows] == [1, 1]

    blocks_after = DailyEngine.get_day("2026-03-16")
    sleep_block_after = next(block for block in blocks_after if block["activity_title"] == "Dormir")
    assert bool(sleep_block_after["completed"]) is True
    assert sleep_block_after["linked_block_ids"] == [2, 1]
