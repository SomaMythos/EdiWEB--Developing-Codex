import sqlite3
from pathlib import Path

from core.daily_discipline_engine import DailyDisciplineEngine
from data.database import Database


class _FakeDatabase:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def fetchall(self, query, params=None):
        return [
            {
                "id": 1,
                "title": "Flex",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "flex",
                "intercalate_days": None,
                "fixed_time": "08:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 2,
                "title": "Everyday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "everyday",
                "intercalate_days": None,
                "fixed_time": "09:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 3,
                "title": "Workday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "workday",
                "intercalate_days": None,
                "fixed_time": "10:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 4,
                "title": "Offday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "offday",
                "intercalate_days": None,
                "fixed_time": "11:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
        ]


def test_frequency_filter_respects_weekend_overridden_to_work(monkeypatch):
    monkeypatch.setattr("core.daily_discipline_engine.Database", _FakeDatabase)
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-02-22", 10)

    ids = [item["id"] for item in result]
    assert ids == [1, 2, 3]


def test_frequency_filter_respects_weekday_overridden_to_off(monkeypatch):
    monkeypatch.setattr("core.daily_discipline_engine.Database", _FakeDatabase)
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "off",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-02-18", 10)

    ids = [item["id"] for item in result]
    assert ids == [1, 2, 4]


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def test_intercalate_frequency_waits_minimum_days_after_last_registration(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Lavar Roupas", 30, 30, "intercalate", 5, "08:00", 10, 1, 0),
        )
        db.execute("INSERT INTO daily_logs (date) VALUES (?)", ("2026-04-03",))
        db.execute(
            """
            INSERT INTO daily_activity_logs (daily_log_id, activity_id, duration, completed, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (1, 1, 30, 1, "08:00:00"),
        )

    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result_before = DailyDisciplineEngine.build_today_activity_list("2026-04-07", 10)
    result_after = DailyDisciplineEngine.build_today_activity_list("2026-04-08", 10)

    assert result_before == []
    assert [item["title"] for item in result_after] == ["Lavar Roupas"]
    assert result_after[0]["is_disc"] == 0
    assert result_after[0]["is_fun"] == 0


def test_everyday_activity_without_fixed_time_is_always_included(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Treinar - Guitarra", 30, 45, "everyday", None, None, None, 1, 0),
        )
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Jogar", 30, 45, "flex", None, None, None, 0, 1),
        )

    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-03-16", 90)

    assert "Treinar - Guitarra" in [item["title"] for item in result]


def test_fun_activity_is_forced_when_fun_weight_positive_and_it_fits(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            UPDATE daily_config
            SET discipline_weight = 9,
                fun_weight = 1
            WHERE id = 1
            """
        )
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Programar", 30, 30, "flex", None, None, None, 1, 0),
        )
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Assistir", 30, 30, "flex", None, None, None, 0, 1),
        )

    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-03-17", 30)

    titles = [item["title"] for item in result]
    assert "Assistir" in titles


def test_due_intercalate_activity_is_reserved_before_optional_flex(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Brincar - Ravena", 30, 30, "intercalate", 1, None, None, 1, 0),
        )
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Programar", 30, 30, "flex", None, None, None, 1, 0),
        )
        db.execute("INSERT INTO daily_logs (date) VALUES (?)", ("2026-03-15",))
        db.execute(
            """
            INSERT INTO daily_activity_logs (daily_log_id, activity_id, duration, completed, timestamp)
            VALUES (?, ?, ?, ?, ?)
            """,
            (1, 1, 30, 1, "18:00:00"),
        )

    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-03-16", 30)

    titles = [item["title"] for item in result]
    assert titles == ["Brincar - Ravena"]


def test_first_flex_pick_of_each_category_uses_minimum_duration_anchor(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            UPDATE daily_config
            SET discipline_weight = 1,
                fun_weight = 1
            WHERE id = 1
            """
        )
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Jogar", 30, 90, "flex", None, None, None, 0, 1),
        )
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Leitura", 60, 60, "flex", None, None, None, 1, 0),
        )

    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-03-17", 120)

    jogar = next(item for item in result if item["title"] == "Jogar")
    leitura = next(item for item in result if item["title"] == "Leitura")

    assert jogar["planned_duration"] == 30
    assert leitura["planned_duration"] == 60


def test_intercalate_frequency_uses_completed_daily_plan_block_as_last_registration(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO activities (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("Hidratacao", 30, 30, "intercalate", 2, None, None, 1, 0),
        )
        db.execute(
            """
            INSERT INTO daily_plan_blocks (
                date,
                start_time,
                duration,
                source_type,
                activity_id,
                block_name,
                block_category,
                completed,
                updated_source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("2026-03-16", "19:40", 30, "template", 1, "Hidratacao", "disciplina", 1, "auto"),
        )

    monkeypatch.setattr("core.daily_discipline_engine.Database", lambda: Database(path=db_path))
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-03-17", 90)

    titles = [item["title"] for item in result]
    assert "Hidratacao" not in titles
